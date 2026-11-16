"""R07 — servidor LOCAL do perfil de teste da calculadora R4. Não publica nada; só escuta em 127.0.0.1.

Serve a worktree do site com os mesmos caminhos do site publicado, com três trocas:
  /orcamento/...        -> a compilação do perfil de teste (teste/app/orcamento, fora da allowlist e do Git)
  /verificar/           -> a MESMA página versionada, com o endereço da prévia da nuvem trocado pelo da prévia local
  coletores remotos     -> analytics-sink.js e meta-pixel.js respondem 204 (nenhum script de terceiros é carregado)

Uso: python servidor_local.py [porta] [porta_previa]      (padrão 8796 e 8797)
TESTE_LOG=1 imprime cada arquivo entregue (para conferir os recursos efetivamente carregados).
"""
import http.server
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..', '..', '..'))
APP = os.path.join(AQUI, 'app', 'orcamento')
PREVIA_NUVEM = b'https://ma-demello-preview.ma-demello.workers.dev/api/previews/v1/'
STUBS = ('/assets/js/analytics-sink.js', '/assets/js/meta-pixel.js')


def previa_local(porta_previa: int) -> bytes:
    return f'http://127.0.0.1:{porta_previa}/api/previews/v1/'.encode()


def pagina_verificar(porta_previa: int) -> bytes:
    """A página publicada, byte a byte, salvo o endereço da prévia (uma única ocorrência, conferida)."""
    corpo = open(os.path.join(RAIZ, 'verificar', 'index.html'), 'rb').read()
    if corpo.count(PREVIA_NUVEM) != 1:
        raise RuntimeError('verificar/index.html: endereço da prévia da nuvem não encontrado exatamente uma vez')
    return corpo.replace(PREVIA_NUVEM, previa_local(porta_previa))


class Handler(http.server.SimpleHTTPRequestHandler):
    porta_previa = 8797
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.mjs': 'text/javascript', '.js': 'text/javascript'}

    def translate_path(self, path):
        limpo = path.split('?', 1)[0].split('#', 1)[0]
        if limpo == '/orcamento' or limpo.startswith('/orcamento/'):
            resto = limpo[len('/orcamento'):].lstrip('/')
            alvo = os.path.normpath(os.path.join(APP, resto))
            return alvo if alvo.startswith(APP) else APP
        return super().translate_path(path)

    def send_head(self):
        if os.environ.get('TESTE_LOG'):
            print('ARQUIVO', os.path.relpath(self.translate_path(self.path), RAIZ).replace(os.sep, '/'), flush=True)
        return super().send_head()

    def do_GET(self):
        limpo = self.path.split('?', 1)[0]
        if limpo in STUBS:
            self.send_response(204)
            self.end_headers()
            return
        if limpo in ('/verificar', '/verificar/', '/verificar/index.html'):
            corpo = pagina_verificar(self.porta_previa)
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(corpo)))
            self.end_headers()
            self.wfile.write(corpo)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8796
    Handler.porta_previa = int(sys.argv[2]) if len(sys.argv) > 2 else 8797
    if not os.path.isfile(os.path.join(APP, 'index.html')):
        sys.exit('Compilação de teste ausente: rode, em orcamento-src, "vite build --mode teste".')
    os.chdir(RAIZ)
    print(f'Site local (perfil de teste): http://127.0.0.1:{porta}/orcamento/   (Ctrl+C para parar)', flush=True)
    http.server.ThreadingHTTPServer(('127.0.0.1', porta), Handler).serve_forever()
