"""
Launcher per ReChurch in modalità desktop.

- Avvia il server FastAPI in un thread
- Apre il browser predefinito sull'URL dell'app
- Mostra una piccola GUI (Tk) con info e bottone Esci, in modo che chiudere
  l'app fermi il server (e quindi il browser perda la connessione)

Quando impacchettato con PyInstaller --windowed, non appare la console.
"""
import os
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path


def _resource_path(rel: str) -> str:
    """Compatibile con PyInstaller (sys._MEIPASS) e modalità sviluppo."""
    base = getattr(sys, "_MEIPASS", None)
    if base:
        return os.path.join(base, rel)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), rel)


def find_free_port(preferred: int = 8765) -> int:
    """Cerca una porta libera, preferendo quella indicata."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", preferred))
        s.close()
        return preferred
    except OSError:
        s.close()
        # Lascia che il sistema scelga
        s2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s2.bind(("127.0.0.1", 0))
        port = s2.getsockname()[1]
        s2.close()
        return port


def wait_until_ready(url: str, timeout: float = 15.0) -> bool:
    """Attende che il server risponda."""
    import urllib.request
    end = time.time() + timeout
    while time.time() < end:
        try:
            with urllib.request.urlopen(url, timeout=1):
                return True
        except Exception:
            time.sleep(0.2)
    return False


def run_server(port: int, log_path: Path):
    """Avvia uvicorn in modalità in-process. Eccezioni vanno nel log file."""
    try:
        # In modalità --windowed (PyInstaller noconsole) sys.stdout/sys.stderr possono
        # essere None: uvicorn lo gestisce male se prova a usare i formatter colorati.
        # Sostituiamo con DEVNULL e disabilitiamo il log_config di uvicorn.
        if sys.stdout is None:
            sys.stdout = open(os.devnull, "w", encoding="utf-8")
        if sys.stderr is None:
            sys.stderr = open(os.devnull, "w", encoding="utf-8")

        import uvicorn
        from app.main import app
        with log_path.open("a", encoding="utf-8") as f:
            f.write(f"[server] avvio uvicorn su 127.0.0.1:{port}\n")
        uvicorn.run(app, host="127.0.0.1", port=port, log_config=None, log_level="warning")
    except Exception as e:
        import traceback
        with log_path.open("a", encoding="utf-8") as f:
            f.write(f"[server] ERRORE: {e}\n")
            f.write(traceback.format_exc())
            f.write("\n")


def main():
    # Inizializza la cartella dati
    from app.paths import get_data_dir, ensure_seed_db, get_seed_db_path
    data_dir = get_data_dir()
    log_path = data_dir / "rechurch.log"

    # Header log
    with log_path.open("a", encoding="utf-8") as f:
        f.write(f"\n=== {time.strftime('%Y-%m-%d %H:%M:%S')} avvio launcher ===\n")

    # Seed: al primo avvio (DB assente) copia il rechurch_seed.db incluso, se presente
    try:
        seed = get_seed_db_path()
        ensure_seed_db()
        if seed is not None:
            with log_path.open("a", encoding="utf-8") as f:
                f.write(f"[seed] disponibile: {seed}\n")
    except Exception as e:
        with log_path.open("a", encoding="utf-8") as f:
            f.write(f"[seed] errore: {e}\n")

    port = find_free_port(8765)
    url = f"http://127.0.0.1:{port}/"

    # Avvia il server in background
    server_thread = threading.Thread(target=run_server, args=(port, log_path), daemon=True)
    server_thread.start()

    # Aspetta che sia pronto, poi apri il browser
    if wait_until_ready(f"{url}health"):
        webbrowser.open(url)

    # Piccola GUI di controllo (Tk è builtin in Python su Windows)
    try:
        import tkinter as tk
        from tkinter import messagebox

        root = tk.Tk()
        root.title("ReChurch")
        root.geometry("420x230")
        root.resizable(False, False)

        # Icona se disponibile
        try:
            icon_path = _resource_path("icon.ico")
            if os.path.exists(icon_path):
                root.iconbitmap(icon_path)
        except Exception:
            pass

        frm = tk.Frame(root, padx=20, pady=20)
        frm.pack(fill="both", expand=True)

        tk.Label(frm, text="ReChurch", font=("Segoe UI", 18, "bold")).pack(pady=(0, 4))
        tk.Label(frm, text="Gestione certificati ecclesiastici", font=("Segoe UI", 9), fg="#666").pack()

        tk.Label(frm, text=f"In esecuzione su {url}", font=("Segoe UI", 9), fg="#1e40af").pack(pady=(14, 2))
        tk.Label(frm, text=f"Dati: {data_dir}", font=("Segoe UI", 8), fg="#666").pack()

        btn_frame = tk.Frame(frm)
        btn_frame.pack(pady=20)

        def open_browser():
            webbrowser.open(url)

        def quit_app():
            if messagebox.askyesno("ReChurch", "Chiudere l'applicazione?"):
                root.destroy()
                os._exit(0)

        tk.Button(btn_frame, text="Apri nel browser", command=open_browser,
                  width=18, bg="#4f46e5", fg="white", relief="flat", padx=8, pady=6).pack(side="left", padx=5)
        tk.Button(btn_frame, text="Esci", command=quit_app,
                  width=10, bg="#ef4444", fg="white", relief="flat", padx=8, pady=6).pack(side="left", padx=5)

        # Quando si chiude la finestra, esce
        root.protocol("WM_DELETE_WINDOW", quit_app)
        root.mainloop()
    except Exception:
        # Se Tk non è disponibile, tieni il thread vivo
        try:
            while True:
                time.sleep(60)
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
