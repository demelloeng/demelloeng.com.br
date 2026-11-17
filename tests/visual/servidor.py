"""Servidor estático só em 127.0.0.1 para os testes headless (CONDUTA §5).

O `python -m http.server` tem fila de 5 conexões e recusa pedidos sob testes em paralelo (ERR_CONNECTION_REFUSED),
o que derruba CSS e produz falso defeito de layout. Aqui: threads e fila de 256.
Uso: python servidor.py <porta> <raiz>
"""
import functools
import http.server
import sys


class Servidor(http.server.ThreadingHTTPServer):
    request_queue_size = 256
    daemon_threads = True


class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


porta, raiz = int(sys.argv[1]), sys.argv[2]
Servidor(("127.0.0.1", porta), functools.partial(Silencioso, directory=raiz)).serve_forever()
