"""R07/R15/R16 — roteiro TÉCNICO do Gate B no perfil de teste local (passo 7 do HANDOFF_OPUS_R4_V03, parte técnica).

Sobe uma rodada nova (fator 60%, revisão 1, nenhum cupom), percorre a cadeia comercial com os componentes reais e
registra cada verificação (esperado x obtido):
  Portal (rotas reais, CSRF)  -> fator e cupons no SQLite da rodada
  site (módulos reais)        -> consulta do cupom, prévia, oferta, pedido
  Worker R4 (código real)     -> recálculo, cupom no servidor, idempotência, registro
  /verificar/ (página real)   -> destino do QR no ambiente local, valores e código
  intake + Portal             -> o pedido capturado passa no validador e aparece na revisão de entrada
Nada sai deste computador; contatos são fictícios (.invalid). A revisão da interface real (navegador) e o aceite humano
são registrados à parte. Saída: run/<rodada>/gate_b.json e gate_b.md (ignorados pelo Git).

Uso: python gate_b.py [--eng <worktree r4-eng>] [--manter]   (--manter: não apaga a rodada ao final)
"""
from __future__ import annotations

import argparse
import importlib
import json
import os
import sqlite3
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import iniciar  # noqa: E402

RESULTADOS: list[dict] = []


def confere(item: str, descricao: str, esperado, obtido, ok: bool | None = None) -> bool:
    ok = (esperado == obtido) if ok is None else bool(ok)
    RESULTADOS.append({"item": item, "descricao": descricao, "esperado": esperado, "obtido": obtido, "ok": ok})
    print(f"[{'OK ' if ok else 'FALHA'}] {item} {descricao}: esperado={esperado!r} obtido={obtido!r}", flush=True)
    return ok


def site(cmd: dict) -> dict:
    out = subprocess.run(["node", str(AQUI / "cadeia_site.mjs"), json.dumps(cmd)], capture_output=True, text=True,
                         encoding="utf-8", timeout=120)
    linhas = [ln for ln in out.stdout.splitlines() if ln.strip()]
    if not linhas:
        raise RuntimeError(f"cadeia_site sem saída: {out.stderr[-2000:]}")
    r = json.loads(linhas[-1])
    if "exception" in r:
        raise RuntimeError(r["exception"])
    return r


class Portal:
    """O Portal R4 em processo, com as variáveis da rodada (backends falsos), dirigido pelas rotas reais."""

    def __init__(self, run: Path, eng: Path):
        os.environ.update(iniciar.portal_env(run, eng))
        sys.path.insert(0, str(eng))
        import portal.app.config as config  # noqa: PLC0415
        config.reset_settings_for_tests()
        import portal.app.main as main  # noqa: PLC0415
        importlib.reload(main)
        from starlette.testclient import TestClient  # noqa: PLC0415
        self.settings = config.get_settings()
        self.c = TestClient(main.app)
        self.c.get(f"/bootstrap?nonce={self.settings.bootstrap_nonce}")

    def post(self, url: str, data: dict):
        self.c.get("/comercial")
        token = self.c.cookies["demello_csrf"]
        return self.c.post(url, data={**data, "csrf_token": token}, headers={"x-csrf-token": token}, follow_redirects=False)

    def criar(self, codigo, tipo, valor):
        return self.post("/comercial/cupons", {"codigo": codigo, "tipo": tipo, "valor": valor, "validade": "", "nota": "gate B (teste)"}).status_code

    def acao(self, codigo, acao, validade=""):
        return self.post(f"/comercial/cupons/{codigo}/{acao}", {"validade": validade}).status_code

    def fator(self, percentual):
        return self.post("/comercial/fator", {"percentual": percentual, "nota": "gate B (teste)"}).status_code

    def entrada(self, sid):
        return self.c.get(f"/entradas/{sid}").text


def total(r):
    return ((r.get("record") or {}).get("preview") or {}).get("pricing", {}).get("total_demello")


def comercial(r):
    return ((r.get("record") or {}).get("preview") or {}).get("commercial")


def codigo(r):
    return (r.get("record") or {}).get("verification_code")


def roteiro(run: Path, eng: Path, portal: Portal, filhos: list, log) -> None:
    db = iniciar.banco(run)
    usos = lambda code: sqlite3.connect(db).execute("SELECT COUNT(*) FROM preview_emissions WHERE coupon_code = ?", (code,)).fetchone()[0]

    # --- estado inicial ---------------------------------------------------------------------------------------------
    cfg = sqlite3.connect(db).execute("SELECT revision, factor_demello FROM pricing_config ORDER BY revision DESC LIMIT 1").fetchone()
    confere("G0", "rodada nova: fator semeado", [1, "0.60"], list(cfg))
    confere("G0", "rodada nova: nenhum cupom cadastrado", 0, sqlite3.connect(db).execute("SELECT COUNT(*) FROM coupons").fetchone()[0])

    base = site({"cmd": "emitir"})
    confere("G1", "prévia sem cupom (sobrado 320/160, 4 serviços)", [201, "12509.76", None], [base["status"], total(base), comercial(base)])
    vb = site({"cmd": "verificar", "code": codigo(base)})
    confere("G1", "/verificar/ local aponta para a prévia local", True, vb["endpoint_local"])
    confere("G1", "/verificar/ confere código e valor da prévia", True,
            codigo(base) in vb["text"] and "R$ 12.509,76" in vb["text"] and "com cupom" not in vb["text"])

    # --- cupons criados no Portal -----------------------------------------------------------------------------------
    confere("G2", "Portal cria TESTE-10 (10%) inativo", 303, portal.criar("TESTE-10", "PERCENT", "10"))
    confere("G2", "cupom inativo não vale no site", "not-found", site({"cmd": "cupom", "code": "TESTE-10"}).get("error"))
    confere("G2", "Portal ativa TESTE-10", 303, portal.acao("TESTE-10", "ativar"))
    c10 = site({"cmd": "cupom", "code": " teste-10 "})
    confere("G2", "código digitado em minúsculas/espaços é normalizado e vale", [True, "TESTE-10"], [c10.get("ok"), (c10.get("coupon") or {}).get("code")])

    p10 = site({"cmd": "emitir", "coupon_code": "TESTE-10"})
    cm = comercial(p10) or {}
    confere("G3", "10% sobre R$ 12.509,76", [201, "12509.76", "1250.98", "11258.78"],
            [p10["status"], cm.get("base_total"), cm.get("discount"), cm.get("final_total")])
    v10 = site({"cmd": "verificar", "code": codigo(p10)})
    confere("G3", "/verificar/ mostra total com cupom, valor-base, cupom e desconto", True,
            all(t in v10["text"] for t in ("Previsão DEMELLO com cupom", "R$ 11.258,78", "R$ 12.509,76", "TESTE-10 (10%)", "R$ 1.250,98", codigo(p10))))

    confere("G4", "Portal cria e ativa TESTE-500 (R$ 500)", [303, 303], [portal.criar("TESTE-500", "FIXED", "500"), portal.acao("TESTE-500", "ativar")])
    p500 = site({"cmd": "emitir", "coupon_code": "TESTE-500"})
    confere("G4", "R$ 500 sobre R$ 12.509,76", "12009.76", (comercial(p500) or {}).get("final_total"))
    confere("G4", "Portal cria e ativa TESTE-100 (100%)", [303, 303], [portal.criar("TESTE-100", "PERCENT", "100"), portal.acao("TESTE-100", "ativar")])
    confere("G4", "100% leva a R$ 0,00", "0.00", (comercial(site({"cmd": "emitir", "coupon_code": "TESTE-100"})) or {}).get("final_total"))
    confere("G4", "Portal cria e ativa TESTE-20000 (acima do saldo)", [303, 303], [portal.criar("TESTE-20000", "FIXED", "20000"), portal.acao("TESTE-20000", "ativar")])
    alto = comercial(site({"cmd": "emitir", "coupon_code": "TESTE-20000"})) or {}
    confere("G4", "desconto fixo limitado ao saldo", ["12509.76", "0.00"], [alto.get("discount"), alto.get("final_total")])

    # --- código compartilhado, repetição e idempotência ----------------------------------------------------------------
    antes = usos("TESTE-10")
    s1, s2 = site({"cmd": "emitir", "coupon_code": "TESTE-10"}), site({"cmd": "emitir", "coupon_code": "TESTE-10"})
    confere("G5", "o mesmo código em duas sessões: duas prévias distintas com desconto", [201, 201, True, "11258.78", "11258.78"],
            [s1["status"], s2["status"], codigo(s1) != codigo(s2), (comercial(s1) or {}).get("final_total"), (comercial(s2) or {}).get("final_total")])
    confere("G5", "uso por código conta as prévias emitidas", antes + 2, usos("TESTE-10"))
    chave = "gate-b-retentativa-0001"
    k1 = site({"cmd": "emitir", "coupon_code": "TESTE-10", "emission_key": chave})
    k2 = site({"cmd": "emitir", "coupon_code": "TESTE-10", "emission_key": chave})
    confere("G6", "retentativa técnica (mesma chave, mesmo pedido) devolve o MESMO registro", [201, True], [k2["status"], codigo(k1) == codigo(k2)])
    confere("G6", "retentativa não conta uso novo", antes + 3, usos("TESTE-10"))
    k3 = site({"cmd": "emitir", "coupon_code": "TESTE-10", "emission_key": chave, "area": "200"})
    confere("G6", "mesma chave com pedido diferente é recusada", [409, "EMISSION_KEY_REUSED"], [k3["status"], k3["error"]])

    # --- desativação, reativação e validade ----------------------------------------------------------------------------
    cache = c10["coupon"]                       # o que a tela guardou ao aplicar o cupom
    confere("G7", "Portal desativa TESTE-10", 303, portal.acao("TESTE-10", "desativar"))
    confere("G7", "cupom desativado não vale ao aplicar", "not-found", site({"cmd": "cupom", "code": "TESTE-10"}).get("error"))
    d = site({"cmd": "emitir", "coupon_cached": cache})
    confere("G7", "cupom desativado depois de aplicado: 409, sem emitir sozinho", [409, True, None], [d["status"], d["flags"]["couponInvalid"], d["record"]])
    confere("G7", "prévia histórica com o cupom continua verificável após a desativação", True,
            "R$ 11.258,78" in site({"cmd": "verificar", "code": codigo(p10)})["text"])
    confere("G8", "Portal reativa TESTE-10", 303, portal.acao("TESTE-10", "ativar"))
    r = site({"cmd": "emitir", "coupon_cached": cache})
    confere("G8", "revisão do cupom mudou desde que foi aplicado: aviso de cupom alterado", [409, True], [r["status"], r["flags"]["couponChanged"]])
    r2 = site({"cmd": "emitir", "coupon_code": "TESTE-10"})
    confere("G8", "reconsultado após reativação, volta a emitir com desconto", [201, "11258.78"], [r2["status"], (comercial(r2) or {}).get("final_total")])
    ontem = (datetime.now(timezone(timedelta(hours=-3))) - timedelta(days=1)).strftime("%Y-%m-%d")
    confere("G9", "Portal define validade no passado para TESTE-500", 303, portal.acao("TESTE-500", "validade", ontem))
    confere("G9", "cupom expirado não vale", "not-found", site({"cmd": "cupom", "code": "TESTE-500"}).get("error"))
    confere("G9", "prévia histórica do cupom expirado continua verificável", True,
            "R$ 12.009,76" in site({"cmd": "verificar", "code": codigo(p500)})["text"])

    # --- códigos inválidos --------------------------------------------------------------------------------------------
    confere("G10", "cupom inexistente", "not-found", site({"cmd": "cupom", "code": "NAO-EXISTE"}).get("error"))
    confere("G10", "cupom malformado nem consulta o Worker", "invalid-code", site({"cmd": "cupom", "code": "a!"}).get("error"))
    inv = site({"cmd": "verificar", "code": "aaaaaaaaaaaaaaaa"})["text"]
    confere("G10", "código de verificação inexistente: a página diz que não encontrou", True, "não" in inv.lower() and "R$" not in inv)
    confere("G10", "código de verificação malformado: a página recusa sem consultar", True, "inválido" in site({"cmd": "verificar", "code": "ABC!"})["text"].lower())

    # --- fator alterado no Portal (R16) ----------------------------------------------------------------------------------
    confere("G11", "Portal salva fator 62%", 303, portal.fator("62"))
    f62 = site({"cmd": "emitir"})
    confere("G11", "a calculadora passa a usar a revisão nova e o Worker concorda", [201, 2, True],
            [f62["status"], f62["factor_config_revision"], total(f62) != "12509.76"])
    confere("G11", "prévia anterior à mudança mantém o valor registrado", True, "R$ 12.509,76" in site({"cmd": "verificar", "code": codigo(base)})["text"])
    confere("G11", "Portal restaura 60% (estado inicial da candidata)", 303, portal.fator("60"))
    f60 = site({"cmd": "emitir"})
    confere("G11", "de volta a 60%: mesmo valor da semente, revisão nova", [201, 3, "12509.76"], [f60["status"], f60["factor_config_revision"], total(f60)])

    # --- pedido: intake e revisão de entrada -----------------------------------------------------------------------------
    ped = site({"cmd": "pedido", "record": r2["record"], "coupon": r2["coupon"]})
    confere("G12", "pedido com cupom aceito pelo harness local", [True, 202, "11258.78", codigo(r2)],
            [ped["ok"], ped["status"], (ped["commercial_offer"] or {}).get("final_total"), ped["preview_verification_code"]])
    gravado = json.loads((run / "portal" / "fake_d1" / f"{ped['submission_id']}.json").read_text(encoding="utf-8"))
    sys.path.insert(0, str(eng / "scripts"))
    validador = importlib.import_module("validate_site_intake")
    confere("G12", "pedido capturado passa no validador de intake (oferta reproduzida)", [], validador.validate_payload_v2(gravado["payload"]))
    html = portal.entrada(ped["submission_id"])
    confere("G12", "revisão de entrada mostra o valor com cupom que o cliente viu", True,
            "Valor previsto mostrado ao cliente, com cupom: R$ 11.258,78" in html and codigo(r2) in html)
    ped0 = site({"cmd": "pedido", "record": None, "coupon": None})
    gravado0 = json.loads((run / "portal" / "fake_d1" / f"{ped0['submission_id']}.json").read_text(encoding="utf-8"))
    confere("G12", "pedido sem cupom: validado e mostrado como antes", [[], True, None],
            [validador.validate_payload_v2(gravado0["payload"]), "Valor previsto mostrado ao cliente: R$ 12.509,76" in portal.entrada(ped0["submission_id"]),
             gravado0["payload"].get("commercial_offer")])

    # --- indisponibilidade ----------------------------------------------------------------------------------------------
    previa = filhos[0]
    previa.terminate(); previa.wait(timeout=10)
    confere("G13", "prévia fora do ar: aplicar cupom informa indisponibilidade", "network", site({"cmd": "cupom", "code": "TESTE-10"}).get("error"))
    fora = site({"cmd": "emitir"})
    confere("G13", "prévia fora do ar: emissão falha sem lançar (a estimativa segue na tela)", [False, None], [fora["ok"], fora["record"]])
    vf = site({"cmd": "verificar", "code": codigo(base)})["text"]
    confere("G13", "prévia fora do ar: /verificar/ informa a falha, sem valor", True, "R$" not in vf and len(vf) > 0)
    filhos[0] = iniciar.iniciar_previa(run, eng, log)
    confere("G13", "prévia de volta: registros preservados", True, "R$ 12.509,76" in site({"cmd": "verificar", "code": codigo(base)})["text"])


def relatorio(run: Path, eng: Path) -> Path:
    git = lambda repo: subprocess.run(["git", "-C", str(repo), "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
    meta = {"rodada": run.name, "quando": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "site": git(iniciar.SITE_ROOT), "eng": git(eng), "total": len(RESULTADOS), "falhas": sum(not r["ok"] for r in RESULTADOS)}
    (run / "gate_b.json").write_text(json.dumps({"meta": meta, "resultados": RESULTADOS}, ensure_ascii=False, indent=2), encoding="utf-8")
    linhas = [f"# Gate B — roteiro técnico local ({meta['quando']})", "",
              f"site `{meta['site']}` · eng `{meta['eng']}` · {meta['total']} verificações · {meta['falhas']} falhas", "",
              "| Item | Verificação | Resultado |", "|---|---|---|"]
    linhas += [f"| {r['item']} | {r['descricao']} | {'OK' if r['ok'] else 'FALHA: ' + repr(r['obtido'])} |" for r in RESULTADOS]
    out = run / "gate_b.md"
    out.write_text("\n".join(linhas) + "\n", encoding="utf-8")
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--eng", default=str(iniciar.ENG_PADRAO))
    ap.add_argument("--manter", action="store_true")
    a = ap.parse_args()
    eng = Path(a.eng).resolve()
    run = iniciar.nova_rodada("gate-b-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
    log = open(run / "servicos.log", "w", encoding="utf-8")
    filhos = iniciar.iniciar(run, eng, portal=False, log=log)
    try:
        roteiro(run, eng, Portal(run, eng), filhos, log)
    finally:
        iniciar.encerrar(filhos)
        log.close()
    out = relatorio(run, eng)
    falhas = sum(not r["ok"] for r in RESULTADOS)
    print(f"\n{len(RESULTADOS)} verificações, {falhas} falhas. Relatório: {out}")
    sys.exit(1 if falhas else 0)
