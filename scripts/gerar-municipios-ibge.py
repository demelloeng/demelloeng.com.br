#!/usr/bin/env python3
"""Gera o catálogo estático de municípios do IBGE usado pela calculadora (P02).

Fonte oficial: API de Localidades do IBGE
    https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado
    (documentação: https://servicodados.ibge.gov.br/api/docs/localidades)

Saída: orcamento-src/public/assets/municipios-ibge.v1.json, copiado pelo build para orcamento/assets/ (que já está
na allowlist). A visita ao site NÃO chama a API do IBGE; este script roda só quando o catálogo precisa ser atualizado
(município criado, extinto ou renomeado), por decisão de quem mantém o site.

Formato (compacto; a UF vem do prefixo de 2 dígitos do código, não é gravada):
    {"fonte": "...", "consulta": "AAAA-MM-DD", "total": N, "m": [[1100015, "Alta Floresta D'Oeste"], ...]}

Uso:
    python scripts/gerar-municipios-ibge.py                 # consulta o IBGE e grava o arquivo
    python scripts/gerar-municipios-ibge.py --check         # consulta o IBGE e compara; sai 1 se o arquivo estiver defasado
    python scripts/gerar-municipios-ibge.py --from-json X   # usa uma resposta já baixada (testes, sem rede)
"""
from __future__ import annotations

import argparse
import datetime as dt
import gzip
import json
import pathlib
import sys
import urllib.request

URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado"
FONTE = "IBGE - API de Localidades (servicodados.ibge.gov.br/api/v1/localidades/municipios)"
OUT = pathlib.Path(__file__).resolve().parent.parent / "orcamento-src" / "public" / "assets" / "municipios-ibge.v1.json"

UF_CODES = {
    11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO",
    21: "MA", 22: "PI", 23: "CE", 24: "RN", 25: "PB", 26: "PE", 27: "AL", 28: "SE", 29: "BA",
    31: "MG", 32: "ES", 33: "RJ", 35: "SP", 41: "PR", 42: "SC", 43: "RS",
    50: "MS", 51: "MT", 52: "GO", 53: "DF",
}


def fetch() -> list[dict]:
    req = urllib.request.Request(URL, headers={"Accept": "application/json", "User-Agent": "demelloeng-catalogo/1"})
    with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310 - URL fixa e oficial
        raw = resp.read()
    if raw[:2] == bytes([0x1F, 0x8B]):  # o IBGE responde comprimido mesmo sem pedir (gzip)
        raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8"))


def build(rows: list[dict], consulta: str) -> dict:
    items = []
    for r in rows:
        mid = int(r["municipio-id"])
        if mid // 100000 not in UF_CODES:
            raise SystemExit(f"código IBGE com UF desconhecida: {mid}")
        items.append((mid, str(r["municipio-nome"]).strip()))
    items.sort()
    ids = [i for i, _ in items]
    if len(set(ids)) != len(ids):
        raise SystemExit("códigos IBGE repetidos")
    por_uf: dict[tuple[int, str], int] = {}
    for mid, nome in items:
        por_uf[(mid // 100000, nome)] = por_uf.get((mid // 100000, nome), 0) + 1
    if any(v > 1 for v in por_uf.values()):
        raise SystemExit("nome de município repetido dentro da mesma UF")
    if len(items) < 5000:
        raise SystemExit(f"catálogo incompleto: {len(items)} municípios")
    return {"fonte": FONTE, "consulta": consulta, "total": len(items), "m": [[i, n] for i, n in items]}


def dump(data: dict) -> str:
    # Uma linha por município: o diff do Git de uma atualização mostra só o que mudou.
    head = json.dumps({k: v for k, v in data.items() if k != "m"}, ensure_ascii=False, separators=(",", ":"))[:-1]
    body = ",\n".join(json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in data["m"])
    return f'{head},"m":[\n{body}\n]}}\n'


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--from-json")
    ap.add_argument("--date")
    a = ap.parse_args()
    rows = json.load(open(a.from_json, encoding="utf-8")) if a.from_json else fetch()
    consulta = a.date or dt.date.today().isoformat()
    if a.check and OUT.exists():
        atual = json.loads(OUT.read_text(encoding="utf-8"))
        novo = build(rows, atual.get("consulta", consulta))
        if novo["m"] != atual["m"]:
            antigos, novos = {i: n for i, n in atual["m"]}, {i: n for i, n in novo["m"]}
            print("catálogo defasado: +%d -%d ~%d" % (
                len(novos.keys() - antigos.keys()), len(antigos.keys() - novos.keys()),
                sum(1 for k in novos.keys() & antigos.keys() if novos[k] != antigos[k])))
            return 1
        print(f"catálogo em dia: {novo['total']} municípios")
        return 0
    data = build(rows, consulta)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(dump(data), encoding="utf-8", newline="\n")
    print(f"gravado {OUT}: {data['total']} municípios, consulta {consulta}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
