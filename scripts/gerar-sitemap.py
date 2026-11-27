#!/usr/bin/env python3
"""Gera o sitemap usando o último commit de conteúdo de cada página."""
import argparse
from datetime import datetime
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = 'https://demelloeng.com.br'
URLS = (
    '/',
    '/construir-ou-ampliar/',
    '/avaliar-um-problema/',
    '/servicos/',
    '/servicos/projeto-estrutural/',
    '/servicos/projeto-hidrossanitario/',
    '/servicos/projeto-prevencao-incendio/',
    '/servicos/projeto-gas-glp/',
    '/servicos/projeto-arquitetura/',
    '/servicos/regularizacao/',
    '/servicos/orcamento-tecnico/',
    '/servicos/projeto-terraplanagem/',
    '/servicos/compatibilizacao-bim/',
    '/metodologia/',
    '/experiencia-tecnica/',
    '/empresa/',
    '/empresa/trajetoria-do-fundador.html',
    '/orcamento/',
    '/contato/',
    '/privacidade/',
)
SITEMAP = ROOT / 'sitemap.xml'


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True, encoding='utf-8').strip()


def render(staged=False):
    pending = set(git('diff', '--cached', '--name-only', '--diff-filter=ACMRT', '--no-renames').splitlines()) if staged else set()
    if pending:
        ident = git('var', 'GIT_COMMITTER_IDENT')
        timestamp, zone = ident.rsplit(' ', 2)[-2:]
        date = datetime.fromtimestamp(
            int(timestamp), datetime.strptime(zone, '%z').tzinfo).date().isoformat()
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url in URLS:
        path = url.removeprefix('/') + ('index.html' if url.endswith('/') else '')
        lastmod = date if path in pending else git('log', '-1', '--format=%cs', '--', path)
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', lastmod):
            raise ValueError(f'{path}: sem data no histórico Git')
        lines.append(f'  <url><loc>{DOMAIN}{url}</loc><lastmod>{lastmod}</lastmod></url>')
    return '\n'.join([*lines, '</urlset>', ''])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check', action='store_true')
    mode.add_argument('--staged', action='store_true', help='antecipa a data do commit para HTMLs staged')
    args = parser.parse_args()
    expected = render(args.staged)
    if args.check:
        if SITEMAP.read_text(encoding='utf-8') != expected:
            parser.exit(1, 'sitemap.xml desatualizado. Rode scripts/gerar-sitemap.py (use --staged antes de commitar páginas).\n')
    else:
        SITEMAP.write_bytes(expected.encode('utf-8'))


if __name__ == '__main__':
    main()
