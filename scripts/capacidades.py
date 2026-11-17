# GERADO pelo canônico (mentes-afiadas-demello-engineering: scripts/hooks/capacidades_runtime.py) por
# `python scripts/capacidades.py gerar-site`. Não editar aqui: a mudança se faz no canônico e se regera.
"""Executor das capacidades dos agentes (preflight, evidência, git hooks e gate de PR).

Fonte única: scripts/hooks/capacidades_runtime.py no canônico. No site ele é copiado, por
`python scripts/capacidades.py gerar-site`, para scripts/capacidades.py junto de capacidades.site.json.
Só biblioteca padrão. Regra em integrations/agents/CONDUTA_AGENTES.md §4.

Comandos (rodar na raiz do repositório):
  usar mwg "<consulta>"            busca guias do Modern Web Guidance na versão aprovada
  usar mwg --retrieve <id,id>      lê os guias e grava a evidência de consulta
  usar frontend-design <N1|N2|N3>  confere a skill, mostra o perfil DEMELLO e grava a evidência
  checar <arquivo...>              diz se cada arquivo exige preflight e se ele vale aqui
  isentar --motivo "<ordem>"       isenção registrada (só com ordem de Marcos; aparece no PR)
  pre-commit | commit-msg <arq>    chamados pelos git hooks de .githooks/
  ci --base <sha> --head <sha>     gate do PR: trailers, versões e atualidade do mapa
  mapa [--base <ref>]              mudança estrutural desde a âncora do mapa (ou desde <ref>)
  testes                           lista os testes node do pages.yml e acusa os que faltam nele

Evidência de consulta NÃO é prova de aplicação correta: ela mostra que a orientação foi lida,
em qual versão, nesta worktree e nesta branch. A aplicação é conferida por testes e revisão.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path

MANIFESTO = "capacidades.site.json"
TRAILER = "Capacidades:"
NIVEIS = ("N1", "N2", "N3")
CRLF, LF = bytes([13, 10]), bytes([10])
AQUI = Path(__file__).resolve().parent

for _s in (sys.stdout, sys.stderr):   # Windows: pipe em cp1252 corrompe acentos e quebra quem lê em UTF-8
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")


# ---------------------------------------------------------------- utilidades
def _git(raiz, *args, check=True):
    r = subprocess.run(["git", "-C", str(raiz), *args], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip()}")
    return r.stdout.strip() if r.returncode == 0 else ""


def raiz_repo(caminho) -> Path | None:
    p = Path(caminho)
    while not p.exists() and p != p.parent:
        p = p.parent
    if p.is_file():
        p = p.parent
    out = _git(p, "rev-parse", "--show-toplevel", check=False)
    return Path(out) if out else None


def versao_tupla(v) -> tuple:
    return tuple(int(x) for x in re.findall(r"\d+", str(v or "0"))[:4]) or (0,)


def _glob_re(padrao: str) -> re.Pattern:
    """Glob com ** (qualquer profundidade), * (sem barra) e ?."""
    i, out = 0, []
    while i < len(padrao):
        c = padrao[i]
        if padrao.startswith("**/", i):
            out.append("(?:.*/)?"); i += 3; continue
        if padrao.startswith("**", i):
            out.append(".*"); i += 2; continue
        out.append("[^/]*" if c == "*" else "[^/]" if c == "?" else re.escape(c)); i += 1
    return re.compile("^" + "".join(out) + "$")


def casa(rel: str, padroes) -> bool:
    rel = rel.replace("\\", "/")
    while rel.startswith("./"):
        rel = rel[2:]
    return any(_glob_re(p).match(rel) for p in padroes or [])


def sha256(caminho) -> str:
    """SHA-256 do conteúdo com fim de linha normalizado (LF): core.autocrlf no Windows não muda a identidade."""
    return hashlib.sha256(Path(caminho).read_bytes().replace(CRLF, LF)).hexdigest()


def agora() -> _dt.datetime:
    fixo = os.environ.get("CAPACIDADES_AGORA")
    return _dt.datetime.fromisoformat(fixo) if fixo else _dt.datetime.now(_dt.timezone.utc)


# ---------------------------------------------------------------- manifesto
def manifesto(raiz) -> dict | None:
    """O manifesto do próprio repositório; sem ele, a cópia instalada junto deste arquivo, se o remoto casar."""
    proprio = Path(raiz) / MANIFESTO
    if proprio.exists():
        return json.loads(proprio.read_text(encoding="utf-8"))
    reserva = AQUI / MANIFESTO
    if reserva.exists():
        m = json.loads(reserva.read_text(encoding="utf-8"))
        remoto = _git(raiz, "remote", "get-url", "origin", check=False)
        if any(r in remoto for r in m["site"].get("remotos", [])):
            m["_reserva"] = True
            return m
    return None


def cap(m, ident) -> dict:
    return next(c for c in m["capacidades"] if c["id"] == ident)


def classificar(rel: str, m: dict) -> str:
    s = m["site"]
    if casa(rel, s["bloqueados"]):
        return "bloqueado"
    if casa(rel, s["isentos"]):
        return "isento"
    if casa(rel, s["frontend"]):
        return "frontend"
    return "outro"


# ---------------------------------------------------------------- evidência
def _log(raiz) -> Path:
    gd = Path(_git(raiz, "rev-parse", "--absolute-git-dir"))
    return gd / "capacidades" / "evidencias.jsonl"


def _identidade(raiz) -> dict:
    return {
        "worktree": _git(raiz, "rev-parse", "--absolute-git-dir"),
        "branch": _git(raiz, "rev-parse", "--abbrev-ref", "HEAD", check=False) or "?",
        "head": _git(raiz, "rev-parse", "HEAD", check=False),
    }


def registrar(raiz, ferramenta: str, **dados) -> dict:
    e = {"ts": agora().isoformat(), "ferramenta": ferramenta, **_identidade(raiz), **dados}
    log = _log(raiz)
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("a", encoding="utf-8") as f:
        f.write(json.dumps(e, ensure_ascii=False) + "\n")
    return e


def evidencias(raiz) -> list[dict]:
    log = _log(raiz)
    if not log.exists():
        return []
    out = []
    for linha in log.read_text(encoding="utf-8").splitlines():
        try:
            out.append(json.loads(linha))
        except json.JSONDecodeError:
            continue
    return out


def _vale(e: dict, raiz, m: dict) -> str | None:
    """Motivo pelo qual a evidência NÃO vale aqui, ou None se vale."""
    ident = _identidade(raiz)
    if e.get("worktree") != ident["worktree"]:
        return "de outra worktree"
    if e.get("branch") != ident["branch"]:
        return f"de outra branch ({e.get('branch')})"
    idade = agora() - _dt.datetime.fromisoformat(e["ts"])
    if idade.total_seconds() > m["site"]["validade_horas"] * 3600:
        return f"vencida ({idade.total_seconds() / 3600:.0f} h)"
    if e.get("head") and ident["head"] and e["head"] != ident["head"]:
        r = subprocess.run(["git", "-C", str(raiz), "merge-base", "--is-ancestor", e["head"], ident["head"]])
        if r.returncode != 0:
            return "de outra revisão (a HEAD da evidência não é ancestral da atual)"
    if e["ferramenta"] != "isencao":
        aprov = cap(m, e["ferramenta"])["versao_aprovada"]
        if versao_tupla(e.get("versao")) < versao_tupla(aprov):
            return f"versão {e.get('versao')} abaixo da aprovada {aprov}"
    return None


def evidencia_valida(raiz, m, ferramenta) -> tuple[dict | None, list[str]]:
    recusas = []
    for e in reversed(evidencias(raiz)):
        if e["ferramenta"] not in (ferramenta, "isencao"):
            continue
        if ferramenta == "modern-web-guidance" and e["ferramenta"] != "isencao" and not e.get("guias"):
            continue   # busca sem retrieve não conta
        motivo = _vale(e, raiz, m)
        if motivo is None:
            return e, recusas
        recusas.append(motivo)
    return None, recusas


def faltas_evidencia(raiz, m) -> list[str]:
    """As duas skills obrigatórias do frontend, com evidência válida aqui; lista vazia = ok."""
    msgs = []
    for ferr, cmd in (("modern-web-guidance", 'usar mwg "<consulta>" e depois usar mwg --retrieve <ids>'),
                      ("frontend-design", "usar frontend-design <N1|N2|N3>")):
        e, recusas = evidencia_valida(raiz, m, ferr)
        if e is None:
            extra = f" (encontrada, mas {recusas[0]})" if recusas else ""
            msgs.append(f"{ferr}: sem consulta válida nesta worktree e branch{extra}. "
                        f"Rode na raiz do repositório: python scripts/capacidades.py {cmd}")
    return msgs


def relativo(raiz, a) -> str:
    p = Path(a)
    if p.is_absolute():
        return p.resolve().relative_to(Path(raiz).resolve()).as_posix()
    return p.as_posix()


def faltas(raiz, m, arquivos) -> list[str]:
    """Pendências para o AGENTE editar estes arquivos agora; lista vazia = liberado."""
    msgs, precisa = [], False
    for a in arquivos:
        rel = relativo(raiz, a)
        tipo = classificar(rel, m)
        if tipo == "bloqueado":
            msgs.append(f"{rel}: arquivo gerado ou travado; não se edita à mão (o bundle do orcamento/ sai do build; o lockfile sai do gerenciador).")
        elif tipo == "frontend":
            precisa = True
    return msgs + (faltas_evidencia(raiz, m) if precisa else [])


# ---------------------------------------------------------------- ferramentas
def _mwg_cmd(m) -> list[str]:
    sob = os.environ.get("CAPACIDADES_MWG_CMD")
    if sob:
        return json.loads(sob)
    c = cap(m, "modern-web-guidance")
    npx = "npx.cmd" if os.name == "nt" else "npx"
    return [npx, "-y", f"{c['origem_oficial']['npm']}@{c['versao_aprovada']}"]


def usar_mwg(raiz, m, consulta=None, retrieve=None) -> int:
    c = cap(m, "modern-web-guidance")
    base = _mwg_cmd(m)
    if consulta:
        r = subprocess.run(base + ["search", consulta, "--skill-version", c["skill_version"]],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        print(r.stdout or r.stderr)
        return r.returncode
    ids = [i.strip() for i in (retrieve or "").split(",") if i.strip()]
    if not ids:
        print("Informe a consulta ou --retrieve <id,id>.", file=sys.stderr)
        return 2
    r = subprocess.run(base + ["retrieve", ",".join(ids)], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    print(r.stdout or r.stderr)
    if r.returncode != 0 or not r.stdout.strip():
        print("retrieve falhou: nenhuma evidência gravada.", file=sys.stderr)
        return 1
    registrar(raiz, "modern-web-guidance", versao=c["versao_aprovada"], guias=ids,
              conteudo_sha=hashlib.sha256(r.stdout.encode("utf-8")).hexdigest()[:16])
    print(f"\nEvidência gravada: modern-web-guidance {c['versao_aprovada']} guias={','.join(ids)}")
    return 0


def localizar_frontend_design(raiz, m) -> tuple[Path | None, str | None, str]:
    """(caminho do SKILL.md, versão, origem). Repositório primeiro (Codex), depois o plugin do Claude."""
    c = cap(m, "frontend-design")
    aprovado = c["origem_oficial"]["skill_sha256"]
    sob = os.environ.get("CAPACIDADES_FD_SKILL")
    if sob:
        candidatos = [(Path(sob), "repo", None)]
    else:
        home = Path(os.environ.get("CAPACIDADES_CLAUDE_HOME", Path.home() / ".claude"))
        plugin = sorted((home / "plugins" / "cache" / "claude-plugins-official" / "frontend-design").glob("*/skills/frontend-design/SKILL.md"),
                        key=lambda p: versao_tupla(p.parts[-4]), reverse=True)
        candidatos = [(Path(raiz) / c["codex"]["skill_repo"], "repo", None)] + [(p, "plugin", p.parts[-4]) for p in plugin]
    for p, origem, versao_pasta in candidatos:
        if not p.exists():
            continue
        if sha256(p) == aprovado:   # cópia idêntica à oficial aprovada
            return p, c["versao_aprovada"], origem
        if versao_pasta and versao_tupla(versao_pasta) >= versao_tupla(c["versao_aprovada"]):
            return p, versao_pasta, origem   # plugin oficial mais novo que o aprovado
    return None, None, "ausente"


def usar_frontend_design(raiz, m, nivel) -> int:
    if nivel not in NIVEIS:
        print(f"Nível deve ser um de {NIVEIS}.", file=sys.stderr)
        return 2
    skill, versao, origem = localizar_frontend_design(raiz, m)
    if skill is None:
        print("frontend-design AUSENTE: nem .agents/skills/frontend-design (Codex) nem o plugin do Claude "
              "na versão aprovada. Não há evidência sem a skill.", file=sys.stderr)
        return 1
    perfil = Path(raiz) / m["site"]["perfil_frontend_design"]
    print(f"frontend-design {versao} ({origem}): leia e aplique {skill}")
    if perfil.exists():
        texto = perfil.read_text(encoding="utf-8")
        bloco = re.search(rf"^## {nivel}\b.*?(?=^## |\Z)", texto, re.S | re.M)
        print("\n" + (bloco.group(0) if bloco else texto))
    else:
        print(f"Perfil DEMELLO não encontrado em {perfil}: aplique a skill sem redesenhar o aprovado.")
    registrar(raiz, "frontend-design", versao=versao, nivel=nivel, skill_sha=sha256(skill)[:16])
    print(f"Evidência gravada: frontend-design {versao} nível {nivel}")
    return 0


# ---------------------------------------------------------------- decisão das hooks dos agentes
WEB = re.compile(r"\.(html?|css|js|mjs|cjs|jsx|ts|tsx|glsl)$", re.I)
ESCRITA = re.compile(r"\bsed\s+(-\w*\s+)*-i|\bperl\s+-\w*i|\btee\b|\b(cp|mv|install|rsync|truncate)\b|\bSet-Content\b|\bOut-File\b|"
                     r"\bAdd-Content\b|\bCopy-Item\b|\bMove-Item\b|\bNew-Item\b|write_text|writeFile|open\([^)]*['\"][wa]", re.I)
REDIRECAO = re.compile(r"(?<![0-9&])>>?\s*([\"']?)([^\s\"'|;&<>]+)\1")
GERADOR = re.compile(r"(scripts[/\\](?:gerar-[\w-]+|layout_\w+)\.py)")
PATCH = re.compile(r"^\*\*\* (?:Add|Update|Delete) File: (.+)$", re.M)


def _tokens(cmd: str) -> list[str]:
    return [a or b or c for a, b, c in re.findall(r"\"([^\"]+)\"|'([^']+)'|(\S+)", cmd)]


MSYS = re.compile(r"^/([a-zA-Z])(/|$)")
SEGMENTO = re.compile(r"&&|\|\||;|\n|\|")
MUDA_DIR = re.compile(r"^\s*(?:cd|pushd|Set-Location|sl|chdir)\s+(?:-LiteralPath\s+|-Path\s+)?([\"']?)(.+?)\1\s*$", re.I)


def _caminho(texto: str, cwd: Path) -> Path:
    """Caminho de shell -> Path: aceita /c/... (Git Bash), ~ e relativo ao diretório corrente do comando."""
    texto = MSYS.sub(lambda m: f"{m.group(1).upper()}:/", texto.strip().strip("\"'"))
    p = Path(os.path.expanduser(texto))
    return p if p.is_absolute() else (cwd / p)


def alvos_shell(cmd: str, cwd) -> list[Path]:
    """Arquivos que um comando de shell provavelmente grava, seguindo cd/pushd/Set-Location entre os segmentos.
    Heurística: o barramento definitivo é o commit e o PR."""
    atual = Path(cwd or ".")
    vistos, out = set(), []
    for seg in SEGMENTO.split(cmd):
        mud = MUDA_DIR.match(seg)
        if mud:
            atual = _caminho(mud.group(2), atual)
            continue
        alvos = [t for _, t in REDIRECAO.findall(seg) if WEB.search(t)]
        if ESCRITA.search(seg):
            alvos += [t.rstrip(");,") for t in _tokens(seg) if WEB.search(t.rstrip(");,"))]
        alvos += GERADOR.findall(seg)   # gerador de página grava HTML
        for a in alvos:
            p = _caminho(a, atual)
            if str(p) not in vistos:
                vistos.add(str(p)); out.append(p)
    return out


def alvos_patch(texto: str, cwd) -> list[Path]:
    cwd = Path(cwd or ".")
    return [Path(p.strip()) if Path(p.strip()).is_absolute() else cwd / p.strip() for p in PATCH.findall(texto)]


def mwg_claude_instalado() -> tuple[str | None, str | None]:
    """(versão, marketplace) do Modern Web Guidance instalado no Claude Code."""
    home = Path(os.environ.get("CAPACIDADES_CLAUDE_HOME", Path.home() / ".claude"))
    arq = home / "plugins" / "installed_plugins.json"
    if not arq.exists():
        return None, None
    d = json.loads(arq.read_text(encoding="utf-8"))
    d = d.get("plugins", d)
    for chave, regs in d.items():
        if chave.startswith("modern-web-guidance@") and regs:
            return regs[0].get("version"), chave.split("@", 1)[1]
    return None, None


def decidir(alvos, agente="claude") -> list[str]:
    """Mensagens de bloqueio para os alvos (vazio = liberar). Só age em repositório governado."""
    por_raiz: dict[Path, list[str]] = {}
    for a in alvos:
        raiz = raiz_repo(a)
        if raiz is None:
            continue
        por_raiz.setdefault(raiz, []).append(str(a))
    msgs = []
    for raiz, arqs in por_raiz.items():
        m = manifesto(raiz)
        if m is None:
            continue
        f = faltas(raiz, m, arqs)
        frontend = any(classificar(relativo(raiz, a), m) == "frontend" for a in arqs)
        if frontend and agente == "claude":
            v, mk = mwg_claude_instalado()
            aprov = cap(m, "modern-web-guidance")["versao_aprovada"]
            if v is None or versao_tupla(v) < versao_tupla(aprov):
                f.insert(0, f"Modern Web Guidance no Claude Code {'ausente' if v is None else v + ' (' + mk + ')'}; "
                            f"aprovada {aprov}. Atualize pela distribuição oficial: claude plugin marketplace add "
                            f"GoogleChrome/modern-web-guidance && claude plugin install modern-web-guidance@googlechrome")
        if m.get("_reserva"):
            f.append(f"(Esta worktree não tem {MANIFESTO}; valeu o manifesto instalado. Crie a worktree a partir da origin/main atual.)")
        if f and not (len(f) == 1 and f[0].startswith("(")):
            msgs.append(f"[{raiz.name}] " + " | ".join(f))
    return msgs


# ---------------------------------------------------------------- git e CI
def arquivos_staged(raiz) -> list[str]:
    out = _git(raiz, "diff", "--cached", "--name-only", "--diff-filter=ACMRD")
    return [l for l in out.splitlines() if l]


def _frontend_no_commit(arqs, m) -> list[str]:
    return [a for a in arqs if classificar(a, m) in ("frontend", "bloqueado")]


def pre_commit(raiz, m) -> int:
    fe = _frontend_no_commit(arquivos_staged(raiz), m)   # no commit, o bundle gerado também conta como frontend
    if not fe:
        return 0
    msgs = faltas_evidencia(raiz, m)
    if msgs:
        print("Commit recusado pela governança de capacidades (CONDUTA §4):\n- " + "\n- ".join(msgs)
              + f"\nArquivos frontend no commit: {', '.join(fe[:8])}", file=sys.stderr)
        return 1
    return 0


def linha_trailer(raiz, m) -> str | None:
    mwg, _ = evidencia_valida(raiz, m, "modern-web-guidance")
    fd, _ = evidencia_valida(raiz, m, "frontend-design")
    if not mwg or not fd:
        return None
    if mwg["ferramenta"] == "isencao":
        return f"{TRAILER} isencao={mwg.get('motivo', '')[:80]}"
    return (f"{TRAILER} mwg={mwg['versao']} guias={','.join(mwg['guias'])}; "
            f"frontend-design={fd['versao']} nivel={fd['nivel']}")


def commit_msg(raiz, m, arquivo_msg) -> int:
    if not _frontend_no_commit(arquivos_staged(raiz), m):
        return 0
    p = Path(arquivo_msg)
    texto = p.read_text(encoding="utf-8")
    if TRAILER in texto:
        return 0
    linha = linha_trailer(raiz, m)
    if linha is None:
        print("commit-msg: sem evidência válida para o trailer (o pre-commit deveria ter recusado).", file=sys.stderr)
        return 1
    p.write_text(texto.rstrip("\n") + "\n\n" + linha + "\n", encoding="utf-8")
    return 0


def ler_trailer(msg: str) -> dict | None:
    for linha in msg.splitlines():
        if linha.startswith(TRAILER):
            corpo = linha[len(TRAILER):].strip()
            if corpo.startswith("isencao="):
                return {"isencao": corpo[len("isencao="):]}
            d = dict(re.findall(r"([\w-]+)=([^;\s]+)", corpo))
            d["guias"] = [g for g in d.get("guias", "").split(",") if g]
            return d
    return None


def _diff_arquivos(raiz, base, head) -> list[tuple[str, str]]:
    out = _git(raiz, "diff", "--name-status", "-M", f"{base}..{head}")
    linhas = []
    for l in out.splitlines():
        partes = l.split("\t")
        if partes[0].startswith("R"):
            linhas += [("D", partes[1]), ("A", partes[2])]
        elif len(partes) >= 2:
            linhas.append((partes[0][0], partes[1]))
    return linhas


MARCADOR = re.compile(r"^[+-](?![+-])\s*(export\s|import\s|from\s+\S+\s+import\s|def\s+\w+|class\s+\w+|<script\b|<link\b[^>]*stylesheet)")


def mudancas_estruturais(raiz, m, base, head) -> list[str]:
    """Mudanças que alteram a arquitetura: conjunto de arquivos, arquivos estruturais e marcadores no conteúdo."""
    s = m["site"]
    achados = []
    for st, arq in _diff_arquivos(raiz, base, head):
        if arq == s["mapa"] or casa(arq, s["fora_da_estrutura"]):
            continue
        if st in ("A", "D") and casa(arq, s["estrutura_conjunto"]):
            achados.append(f"{'novo' if st == 'A' else 'removido'}: {arq}")
        elif st == "M" and casa(arq, s["estrutura_conteudo"]):
            achados.append(f"estrutural alterado: {arq}")
        elif st == "M" and casa(arq, s["estrutura_marcadores"]):
            diff = _git(raiz, "diff", "-U0", f"{base}..{head}", "--", arq)
            # só conta se o CONJUNTO de marcadores mudar; troca de ?v= (cache) ou de espaço não é estrutura
            norm = lambda l: re.sub(r"\s+", " ", re.sub(r"\?v=[\w.-]+", "", l[1:])).strip()
            mais = {norm(l) for l in diff.splitlines() if MARCADOR.match(l) and l.startswith("+")}
            menos = {norm(l) for l in diff.splitlines() if MARCADOR.match(l) and l.startswith("-")}
            if mais != menos:
                achados.append(f"conteúdo estrutural ({len(mais ^ menos)} linha(s) de import/export/def/script/link): {arq}")
    return achados


def ancora_mapa(raiz, m) -> str | None:
    mapa = Path(raiz) / m["site"]["mapa"]
    if not mapa.exists():
        return None
    r = re.search(r"^commit:\s*(\w+)", mapa.read_text(encoding="utf-8"), re.M)
    return r.group(1) if r else None


def ci(raiz, m, base, head, validar_guias=False) -> int:
    resumo, erros, avisos = [], [], []
    commits = _git(raiz, "rev-list", "--no-merges", f"{base}..{head}").split()
    c_mwg, c_fd = cap(m, "modern-web-guidance"), cap(m, "frontend-design")
    guias_vistas = set()
    for sha in commits:
        arqs = _git(raiz, "diff-tree", "--no-commit-id", "--name-only", "-r", sha).splitlines()
        fe = _frontend_no_commit(arqs, m)
        if not fe:
            continue
        t = ler_trailer(_git(raiz, "log", "-1", "--format=%B", sha))
        curto = sha[:7]
        if t is None:
            erros.append(f"{curto}: altera frontend ({', '.join(fe[:4])}) sem trailer '{TRAILER}'.")
            continue
        if "isencao" in t:
            avisos.append(f"{curto}: ISENÇÃO declarada ({t['isencao']}); conferir a ordem de Marcos.")
            continue
        if versao_tupla(t.get("mwg")) < versao_tupla(c_mwg["versao_aprovada"]):
            erros.append(f"{curto}: mwg={t.get('mwg')} abaixo da aprovada {c_mwg['versao_aprovada']}.")
        if not t["guias"]:
            erros.append(f"{curto}: trailer sem guias consultados.")
        if versao_tupla(t.get("frontend-design")) < versao_tupla(c_fd["versao_aprovada"]):
            erros.append(f"{curto}: frontend-design ausente ou abaixo de {c_fd['versao_aprovada']}.")
        if t.get("nivel") not in NIVEIS:
            erros.append(f"{curto}: nível do frontend-design ausente ou inválido.")
        guias_vistas.update(t["guias"])
        resumo.append(f"{curto}: mwg={t.get('mwg')} guias={','.join(t['guias'])} frontend-design={t.get('frontend-design')} {t.get('nivel')}")
    if validar_guias and guias_vistas:
        r = subprocess.run(_mwg_cmd(m) + ["retrieve", ",".join(sorted(guias_vistas))], capture_output=True,
                           text=True, encoding="utf-8", errors="replace")
        if r.returncode != 0 or not r.stdout.strip():
            erros.append(f"guias citados não existem na versão aprovada: {','.join(sorted(guias_vistas))}")
    estr = mudancas_estruturais(raiz, m, base, head)
    mapa_tocado = any(a == m["site"]["mapa"] for _, a in _diff_arquivos(raiz, base, head))
    if estr and not mapa_tocado:
        erros.append(f"mudança estrutural sem atualizar {m['site']['mapa']} (rodar o Cartographer em modo de atualização):\n    "
                     + "\n    ".join(estr[:12]))
    relatorio = ["## Governança de capacidades", f"Commits analisados: {len(commits)}", ""]
    relatorio += ["### Evidências de consulta (não provam aplicação)"] + [f"- {x}" for x in resumo or ["nenhum commit frontend"]]
    relatorio += ["", f"### Mudança estrutural: {len(estr)} achado(s); mapa {'atualizado' if mapa_tocado else 'não tocado'}"]
    relatorio += [f"- {x}" for x in estr[:20]]
    if avisos:
        relatorio += ["", "### Avisos"] + [f"- {x}" for x in avisos]
    relatorio += ["", "### Resultado", "APROVADO" if not erros else "REPROVADO"] + [f"- {x}" for x in erros]
    texto = "\n".join(relatorio)
    print(texto)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(texto + "\n")
    return 1 if erros else 0


def testes_do_pages(raiz) -> tuple[list[str], list[str]]:
    """(lista do pages.yml, testes .test.mjs que existem e o pages.yml não roda)."""
    yml = (Path(raiz) / ".github/workflows/pages.yml").read_text(encoding="utf-8")
    bloco = re.search(r"node --test(.*?)\n\s*node scripts/publish-guard", yml, re.S)
    lista = re.findall(r"tests/[\w.-]+\.test\.mjs", bloco.group(1) if bloco else "")
    existentes = sorted(p.relative_to(Path(raiz) / "orcamento-src").as_posix()
                        for p in (Path(raiz) / "orcamento-src/tests").glob("*.test.mjs"))
    return lista, [t for t in existentes if t not in lista]


# ---------------------------------------------------------------- linha de comando
def main(argv=None) -> int:
    for _s in (sys.stdout, sys.stderr):
        if hasattr(_s, "reconfigure"):
            _s.reconfigure(encoding="utf-8")
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv:
        print(__doc__)
        return 0
    raiz = raiz_repo(Path.cwd())
    if raiz is None:
        print("Rode dentro de um repositório git.", file=sys.stderr)
        return 2
    m = manifesto(raiz)
    if m is None:
        print(f"Sem {MANIFESTO}: este repositório não está sob a governança de capacidades.", file=sys.stderr)
        return 0
    cmd, resto = argv[0], argv[1:]
    if cmd == "usar" and resto[:1] == ["mwg"]:
        if "--retrieve" in resto:
            return usar_mwg(raiz, m, retrieve=resto[resto.index("--retrieve") + 1])
        return usar_mwg(raiz, m, consulta=" ".join(resto[1:]))
    if cmd == "usar" and resto[:1] == ["frontend-design"]:
        return usar_frontend_design(raiz, m, (resto[1:] or [""])[0])
    if cmd == "checar":
        msgs = faltas(raiz, m, resto)
        print("\n".join(msgs) if msgs else "liberado")
        return 1 if msgs else 0
    if cmd == "isentar":
        motivo = resto[resto.index("--motivo") + 1] if "--motivo" in resto else ""
        if not motivo.strip():
            print("Isenção exige --motivo com a ordem de Marcos.", file=sys.stderr)
            return 2
        registrar(raiz, "isencao", motivo=motivo)
        print("Isenção registrada; aparece no trailer e no resumo do PR.")
        return 0
    if cmd == "pre-commit":
        return pre_commit(raiz, m)
    if cmd == "commit-msg":
        return commit_msg(raiz, m, resto[0])
    if cmd == "ci":
        base = resto[resto.index("--base") + 1]
        head = resto[resto.index("--head") + 1] if "--head" in resto else "HEAD"
        return ci(raiz, m, base, head, validar_guias="--validar-guias" in resto)
    if cmd == "mapa":
        base = resto[resto.index("--base") + 1] if "--base" in resto else ancora_mapa(raiz, m)
        if not base:
            print("Mapa sem âncora commit:.")
            return 1
        achados = mudancas_estruturais(raiz, m, base, "HEAD")
        print(f"Desde {base[:7]}: {len(achados)} mudança(s) estrutural(is)." + ("" if not achados else "\n- " + "\n- ".join(achados[:30])))
        return 1 if achados else 0
    if cmd == "testes":
        lista, faltando = testes_do_pages(raiz)
        if "--listar" in resto:
            print(" ".join(lista))
            return 0
        print(f"pages.yml roda {len(lista)} testes node; fora dele: {len(faltando)}" + ("" if not faltando else "\n- " + "\n- ".join(faltando)))
        return 1 if faltando else 0
    print(f"Comando desconhecido: {cmd}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
