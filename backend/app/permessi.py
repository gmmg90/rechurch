"""Permessi per chiesa.

Un utente con ``chiesa_id`` impostato e ruolo diverso da ``admin`` è *limitato*
a quella chiesa: vede e modifica solo sacramenti, movimenti contabili ed eventi
di quella chiesa, e non accede ai dati di tutta la parrocchia (rubrica anime,
import, impostazioni). Gli amministratori e gli utenti senza chiesa vedono tutto.
"""
from typing import Optional

from fastapi import Depends, HTTPException, status

from app import models
from app.auth import get_current_user


def chiesa_utente(user: Optional[models.Utente]) -> Optional[int]:
    """Id della chiesa a cui l'utente è limitato, o None se vede tutta la parrocchia."""
    if user is None or user.ruolo == "admin":
        return None
    return getattr(user, "chiesa_id", None) or None


def filtra_query(q, Model, user):
    """Restringe una query ai record della chiesa dell'utente (se limitato)."""
    cid = chiesa_utente(user)
    if cid is not None:
        q = q.filter(Model.chiesa_id == cid)
    return q


def verifica_record(obj, user, messaggio: str = "Record non trovato") -> None:
    """404 se il record appartiene a un'altra chiesa (non ne riveliamo l'esistenza)."""
    cid = chiesa_utente(user)
    if cid is not None and getattr(obj, "chiesa_id", None) != cid:
        raise HTTPException(status_code=404, detail=messaggio)


def forza_chiesa(obj, user) -> None:
    """Per un utente limitato, il record appartiene sempre alla sua chiesa."""
    cid = chiesa_utente(user)
    if cid is None:
        return
    attuale = getattr(obj, "chiesa_id", None)
    if attuale not in (None, cid):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Puoi registrare dati solo per la tua chiesa",
        )
    obj.chiesa_id = cid


def solo_parrocchia(user: models.Utente = Depends(get_current_user)) -> models.Utente:
    """Dipendenza: vieta l'accesso agli utenti limitati a una chiesa."""
    if chiesa_utente(user) is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Funzione non disponibile per gli utenti di una singola chiesa",
        )
    return user
