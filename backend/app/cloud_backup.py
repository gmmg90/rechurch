"""
Backup del database su cloud (opzionale).

Attivato tramite variabili d'ambiente; se non configurato è un no-op silenzioso,
così l'app funziona identica in locale/desktop senza alcun servizio cloud.

Provider supportati (CLOUD_BACKUP_PROVIDER):
  - "gdrive"  → Google Drive tramite service account
  - "dropbox" → Dropbox tramite refresh token (app OAuth)
  - "none" / assente → disabilitato

Google Drive (service account):
  CLOUD_BACKUP_PROVIDER=gdrive
  GDRIVE_SERVICE_ACCOUNT_JSON=/path/credenziali.json   (oppure GDRIVE_SERVICE_ACCOUNT_INFO con il JSON inline)
  GDRIVE_FOLDER_ID=<id cartella condivisa col service account>

Dropbox (app con refresh token):
  CLOUD_BACKUP_PROVIDER=dropbox
  DROPBOX_APP_KEY=...
  DROPBOX_APP_SECRET=...
  DROPBOX_REFRESH_TOKEN=...
  DROPBOX_FOLDER=/ReChurch            (opzionale, default /ReChurch)

Comune:
  CLOUD_BACKUP_KEEP=30                 (quanti backup tenere nel cloud, se il provider lo supporta)
"""
from __future__ import annotations

import os
from pathlib import Path


def cloud_backup_enabled() -> bool:
    return (os.getenv("CLOUD_BACKUP_PROVIDER", "none").lower() not in ("", "none", "off", "0", "false"))


def provider_name() -> str:
    return os.getenv("CLOUD_BACKUP_PROVIDER", "none").lower()


def upload_backup(local_path: Path) -> str | None:
    """Carica il file di backup sul provider configurato.

    Restituisce un identificatore/nome remoto in caso di successo, None se disabilitato.
    Solleva un'eccezione in caso di errore (gestita dal chiamante).
    """
    if not cloud_backup_enabled():
        return None

    prov = provider_name()
    local_path = Path(local_path)
    if not local_path.exists():
        raise FileNotFoundError(f"Backup locale non trovato: {local_path}")

    if prov == "gdrive":
        return _upload_gdrive(local_path)
    if prov == "dropbox":
        return _upload_dropbox(local_path)
    raise ValueError(f"CLOUD_BACKUP_PROVIDER non supportato: {prov}")


# ── Google Drive ──────────────────────────────────────────────────────────────
def _upload_gdrive(local_path: Path) -> str:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    folder_id = os.getenv("GDRIVE_FOLDER_ID")
    if not folder_id:
        raise RuntimeError("GDRIVE_FOLDER_ID non impostato")

    info_env = os.getenv("GDRIVE_SERVICE_ACCOUNT_INFO")
    json_path = os.getenv("GDRIVE_SERVICE_ACCOUNT_JSON")
    scopes = ["https://www.googleapis.com/auth/drive.file"]

    if info_env:
        import json
        creds = service_account.Credentials.from_service_account_info(json.loads(info_env), scopes=scopes)
    elif json_path:
        creds = service_account.Credentials.from_service_account_file(json_path, scopes=scopes)
    else:
        raise RuntimeError("Credenziali Google mancanti (GDRIVE_SERVICE_ACCOUNT_JSON o _INFO)")

    service = build("drive", "v3", credentials=creds, cache_discovery=False)
    metadata = {"name": local_path.name, "parents": [folder_id]}
    media = MediaFileUpload(str(local_path), mimetype="application/octet-stream", resumable=False)
    created = service.files().create(body=metadata, media_body=media, fields="id, name").execute()

    _gdrive_prune(service, folder_id)
    return created.get("id")


def _gdrive_prune(service, folder_id: str) -> None:
    """Mantiene solo gli ultimi CLOUD_BACKUP_KEEP file rechurch_*.db nella cartella."""
    keep = int(os.getenv("CLOUD_BACKUP_KEEP", "30"))
    if keep <= 0:
        return
    resp = service.files().list(
        q=f"'{folder_id}' in parents and name contains 'rechurch_' and trashed=false",
        orderBy="createdTime desc",
        fields="files(id, name, createdTime)",
        pageSize=1000,
    ).execute()
    files = resp.get("files", [])
    for f in files[keep:]:
        try:
            service.files().delete(fileId=f["id"]).execute()
        except Exception:
            pass


# ── Dropbox ───────────────────────────────────────────────────────────────────
def _upload_dropbox(local_path: Path) -> str:
    import dropbox

    app_key = os.getenv("DROPBOX_APP_KEY")
    app_secret = os.getenv("DROPBOX_APP_SECRET")
    refresh = os.getenv("DROPBOX_REFRESH_TOKEN")
    if not (app_key and app_secret and refresh):
        raise RuntimeError("Credenziali Dropbox mancanti (APP_KEY/APP_SECRET/REFRESH_TOKEN)")

    folder = os.getenv("DROPBOX_FOLDER", "/ReChurch").rstrip("/")
    dest = f"{folder}/{local_path.name}"

    dbx = dropbox.Dropbox(
        app_key=app_key,
        app_secret=app_secret,
        oauth2_refresh_token=refresh,
    )
    with local_path.open("rb") as fh:
        dbx.files_upload(fh.read(), dest, mode=dropbox.files.WriteMode.overwrite)

    _dropbox_prune(dbx, folder)
    return dest


def _dropbox_prune(dbx, folder: str) -> None:
    keep = int(os.getenv("CLOUD_BACKUP_KEEP", "30"))
    if keep <= 0:
        return
    try:
        res = dbx.files_list_folder(folder)
        entries = [e for e in res.entries if getattr(e, "name", "").startswith("rechurch_")]
        entries.sort(key=lambda e: e.name, reverse=True)
        for e in entries[keep:]:
            try:
                dbx.files_delete_v2(f"{folder}/{e.name}")
            except Exception:
                pass
    except Exception:
        pass
