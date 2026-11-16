"""Ensaio R10 local; sem rede externa, sem dependências extras."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import unquote
import subprocess

HERE = Path(__file__).resolve().parent
SITE = HERE.parents[4]
BASELINE = "64689dff81f0b9dd1971019a250c3b8fd52b36c4"
RUN = HERE.parent / "run" / "r10-baseline"
RUN.mkdir(parents=True, exist_ok=True)
for name in ["maquete5_scene.mjs", "maquete5_building.mjs", "maquete5_transicao.mjs"]:
    data = subprocess.check_output(["git", "show", f"{BASELINE}:orcamento-src/src/{name}"], cwd=SITE)
    (RUN / name).write_bytes(data)

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript", ".js": "text/javascript"}
    def translate_path(self, path):
        path = unquote(path.split("?", 1)[0])
        if ".." in path.split("/"):
            return str(HERE / "absent")
        if path.startswith("/assets/"):
            return str(SITE / path.lstrip("/"))
        if path.startswith("/before/"):
            return str(RUN / path[len("/before/"):])
        if path.startswith("/after/"):
            return str(SITE / "orcamento-src/src" / path[len("/after/"):])
        return str(HERE / path.lstrip("/"))
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def log_message(self, *args):
        pass

print("R10: http://127.0.0.1:4192/verify.html", flush=True)
ThreadingHTTPServer(("127.0.0.1", 4192), Handler).serve_forever()
