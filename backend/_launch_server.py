"""Detached launcher for the unified backend service.

Spawns `main.py` as a fully detached Windows process (new process group,
no console, not tied to this process tree) so it keeps running after the
launcher exits. Logs go to backend/_server.log and backend/_server.err.
"""
import subprocess
import sys
import os

DETACHED_PROCESS = 0x00000008
CREATE_NEW_PROCESS_GROUP = 0x00000200
CREATE_NO_WINDOW = 0x08000000

backend_dir = os.path.dirname(os.path.abspath(__file__))
# The venv python.exe is a shim that dies when fully detached on Windows;
# use the base interpreter that the original server was started with.
python = r"C:\Program Files\Python311\python.exe"

log_out = open(os.path.join(backend_dir, "_server.log"), "wb", buffering=0)
log_err = open(os.path.join(backend_dir, "_server.err"), "wb", buffering=0)

proc = subprocess.Popen(
    [python, "-u", "main.py"],
    cwd=backend_dir,
    stdout=log_out,
    stderr=log_err,
    stdin=subprocess.DEVNULL,
    creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW,
    close_fds=True,
)
print(f"spawned pid={proc.pid}")
sys.exit(0)
