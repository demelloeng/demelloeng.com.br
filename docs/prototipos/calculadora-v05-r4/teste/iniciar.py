"""R07 — sobe o perfil de TESTE local da R4 inteiro, numa rodada nova e isolada (tudo em 127.0.0.1).

  site        http://127.0.0.1:8796/orcamento/   compilação `vite build --mode teste` (fora da allowlist e do Git)
  verificar   http://127.0.0.1:8796/verificar/   a página versionada, apontada para a prévia local
  prévia      http://127.0.0.1:8797              código real do Worker R4 (worktree r4-eng) sobre o SQLite da rodada
  pedido      http://127.0.0.1:8788              harness de intake do r4-eng, gravando onde o Portal lê
  Portal      http://127.0.0.1:8766              Portal R4 com CRM, D1 e preparo FALSOS (fator e cupons no mesmo SQLite)

Cada rodada vive em teste/run/<carimbo>/ (ignorado pelo Git): começa com o fator semeado (60%, revisão 1) e nenhum
cupom; apagar a pasta descarta todos os dados de teste. Nenhum serviço fala com a nuvem; contatos são fictícios.

Uso: python iniciar.py [--eng <worktree r4-eng>] [--sem-portal]      Ctrl+C encerra tudo.
"""
from __future__ import annotations

import argparse
import os
import secrets
import socket
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.request import urlopen

AQUI = Path(__file__).resolve().parent
SITE_ROOT = AQUI.parents[3]
ENG_PADRAO = SITE_ROOT.parent / "r4-eng"
PORTAS = {"site": 8796, "previa": 8797, "pedido": 8788, "portal": 8766}
ORIGEM = f"http://127.0.0.1:{PORTAS['site']}"


def nova_rodada(nome: str | None = None) -> Path:
    run = AQUI / "run" / (nome or datetime.now().strftime("%Y%m%d-%H%M%S"))
    (run / "portal" / "fake_d1").mkdir(parents=True, exist_ok=False)
    return run


def banco(run: Path) -> Path:
    return run / "portal" / "fake_d1" / "comercial.sqlite"


def portal_env(run: Path, eng: Path) -> dict[str, str]:
    """O mesmo isolamento dos testes do Portal: backends falsos e pastas da rodada; nenhuma credencial da nuvem."""
    env = {k: v for k, v in os.environ.items() if not k.startswith(("CF_", "PORTAL_"))}
    env.update({
        "PORTAL_RUN_ROOT": str(run / "portal"), "PORTAL_CRM_BACKEND": "fake", "PORTAL_D1_BACKEND": "fake",
        "PORTAL_PREP_BACKEND": "fake", "PORTAL_SECRET": secrets.token_hex(24), "PORTAL_PORT": str(PORTAS["portal"]),
        "PORTAL_AUDIENCIA_ROOT": str(run / "portal" / "audiencia_absent"),
        "PORTAL_MESA_ANALISE_ROOT": str(run / "portal" / "mesa_analise"),
        "PYTHONPATH": str(eng), "PYTHONDONTWRITEBYTECODE": "1",
    })
    env.pop("PORTAL_ESTOQUE_DB", None)
    return env


def _livre(porta: int) -> None:
    with socket.socket() as s:
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            s.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        s.bind(("127.0.0.1", porta))


def _espera(url: str, filhos: list, nome: str) -> None:
    for _ in range(150):
        if any(p.poll() is not None for p in filhos):
            raise RuntimeError(f"um serviço local encerrou durante a subida ({nome})")
        try:
            with urlopen(url, timeout=1):
                return
        except OSError as exc:
            if getattr(exc, "code", None):     # HTTPError: o serviço respondeu
                return
            time.sleep(0.1)
    raise RuntimeError(f"{nome} não respondeu em {url}")


def iniciar_previa(run: Path, eng: Path, log=None) -> subprocess.Popen:
    p = subprocess.Popen(["node", str(AQUI / "previa_local.mjs"), "--db", str(banco(run)), "--eng", str(eng),
                          "--port", str(PORTAS["previa"]), "--origin", ORIGEM], cwd=AQUI, stdout=log, stderr=log)
    _espera(f"http://127.0.0.1:{PORTAS['previa']}/api/previews/v1/pricing-config", [p], "prévia")
    return p


def iniciar(run: Path, eng: Path, *, portal: bool = True, log=None) -> list[subprocess.Popen]:
    if not (SITE_ROOT / "docs/prototipos/calculadora-v05-r4/teste/app/orcamento/index.html").is_file():
        raise RuntimeError('compilação de teste ausente: em orcamento-src, rode "vite build --mode teste"')
    for nome, porta in PORTAS.items():
        if nome != "portal" or portal:
            _livre(porta)
    filhos: list[subprocess.Popen] = []
    try:
        filhos.append(iniciar_previa(run, eng, log))   # primeiro: aplica o schema.sql no SQLite da rodada
        filhos.append(subprocess.Popen([sys.executable, "-B", str(AQUI / "servidor_local.py"), str(PORTAS["site"]), str(PORTAS["previa"])],
                                       cwd=AQUI, stdout=log, stderr=log))
        filhos.append(subprocess.Popen([sys.executable, "-B", str(eng / "scripts" / "site_intake_http_ingest.py"),
                                        "--port", str(PORTAS["pedido"]), "--store-dir", str(run / "portal" / "fake_d1")],
                                       cwd=eng, env={**os.environ, "INTAKE_ALLOWED_ORIGIN": ORIGEM}, stdout=log, stderr=log))
        if portal:
            filhos.append(subprocess.Popen([sys.executable, "-B", "-m", "portal.app.main"], cwd=eng, env=portal_env(run, eng),
                                           stdout=log, stderr=log))
        _espera(f"{ORIGEM}/orcamento/", filhos, "site")
        _espera(f"http://127.0.0.1:{PORTAS['pedido']}/api/site-intake", filhos, "pedido")
        if portal:
            _espera(f"http://127.0.0.1:{PORTAS['portal']}/", filhos, "Portal")
        return filhos
    except Exception:
        encerrar(filhos)
        raise


def encerrar(filhos: list[subprocess.Popen]) -> None:
    for p in filhos:
        if p.poll() is None:
            p.terminate()
    for p in filhos:
        try:
            p.wait(timeout=10)
        except subprocess.TimeoutExpired:
            p.kill()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--eng", default=str(ENG_PADRAO))
    ap.add_argument("--sem-portal", action="store_true")
    a = ap.parse_args()
    run = nova_rodada()
    filhos = iniciar(run, Path(a.eng).resolve(), portal=not a.sem_portal)
    print(f"Rodada: {run}")
    print(f"Calculadora: {ORIGEM}/orcamento/")
    if not a.sem_portal:
        print(f"Portal (fake): o endereço de entrada (bootstrap) aparece acima, na saída do Portal; porta {PORTAS['portal']}.")
    print("Ctrl+C encerra todos os serviços.", flush=True)
    try:
        while all(p.poll() is None for p in filhos):
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        encerrar(filhos)
