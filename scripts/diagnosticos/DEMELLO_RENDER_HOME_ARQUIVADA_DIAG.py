#!/usr/bin/env python3
"""Read-only local screenshots of DEMELLO archived branch ZIP, without network navigation.

For strict local browser restrictions: HTML/CSS/fonts/images are embedded unchanged as
base64 data URLs; scripts and preload hints are skipped to avoid network side effects.
Layout screenshots are faithful to the original static document, but interactive
functionality is not tested by this capture workflow.
"""
import argparse
import base64
import hashlib
import json
import mimetypes
from pathlib import Path
import re
import shutil
import tempfile
import urllib.parse
from zipfile import ZipFile
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from PIL import Image

EXPECTED_INDEX_SHA = '73b5794b623eb118555beb04c1d8b77a8f924c906dc2fa2d1f892dbfef973573'
EXPECTED_H1 = 'Projeto estrutural e projetos complementares.'


def sha256(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def safe_unzip(zip_path, destination):
    with ZipFile(zip_path) as z:
        for item in z.infolist():
            relative = Path(item.filename)
            if relative.is_absolute() or '..' in relative.parts:
                raise RuntimeError('ZIP contém caminho inseguro')
            if item.is_dir():
                continue
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            with z.open(item) as source, target.open('wb') as outfile:
                shutil.copyfileobj(source, outfile)
    candidates = [p for p in destination.rglob('docs/arquivo/home-20261028/README.md')]
    if len(candidates) != 1:
        raise RuntimeError(f'README da branch não identificado; achados: {len(candidates)}')
    root = candidates[0].parents[3]
    index = root / 'index.html'
    if not index.is_file():
        raise RuntimeError('index.html da branch não encontrado')
    current_hash = sha256(index)
    if current_hash != EXPECTED_INDEX_SHA:
        raise RuntimeError(f'Hash SHA-256 não confere: {current_hash}; esperado: {EXPECTED_INDEX_SHA}')
    return root


def build_snapshot(root):
    original = (root / 'index.html').read_text(encoding='utf-8')
    soup = BeautifulSoup(original, 'html.parser')
    missing, included, embedded_css = [], [], []

    def to_local(path, base):
        path = str(path or '').strip()
        if not path or path.startswith(('data:', 'https:', 'http:', '//', 'blob:', '#', 'mailto:', 'tel:', 'javascript:')):
            return None
        u = urllib.parse.urlsplit(path)
        path = urllib.parse.unquote(u.path)
        relative = path.lstrip('/') if path.startswith('/') else str((base / path).relative_to(root)) if base == root and path.startswith('./') else None
        # Resolve relative paths without letting them escape ZIP root
        resolved = (root / path.lstrip('/') if path.startswith('/') else base / path).resolve()
        if not resolved.is_relative_to(root.resolve()):
            raise RuntimeError(f'Caminho de recurso escapa do arquivo: {path}')
        return resolved

    def data_uri(local):
        if not local.is_file():
            missing.append(str(local.relative_to(root)))
            return None
        content = local.read_bytes()
        mime = mimetypes.guess_type(local.name)[0] or 'application/octet-stream'
        included.append({'path': str(local.relative_to(root)), 'sha256': hashlib.sha256(content).hexdigest(), 'bytes': len(content)})
        return 'data:' + mime + ';base64,' + base64.b64encode(content).decode('ascii')

    css_url_pattern = re.compile(r'url\(\s*([\'\"]?)([^)\'\"]+)\1\s*\)', re.I)
    def convert_css(css, css_dir):
        def replace(match):
            v = match.group(2).strip()
            p = to_local(v, css_dir)
            if not p: return match.group(0)
            uri = data_uri(p)
            return f'url("{uri}")' if uri else match.group(0)
        return css_url_pattern.sub(replace, css)

    # Replace CSS link with inline <style>; keep cascade order.
    for link in list(soup.find_all('link')):
        rel = link.get('rel', [])
        if 'stylesheet' in rel:
            p = to_local(link.get('href'), root)
            if p and p.is_file():
                css = p.read_text(encoding='utf-8')
                style = soup.new_tag('style')
                style.string = convert_css(css, p.parent)
                link.replace_with(style)
                embedded_css.append(str(p.relative_to(root)))
            else:
                missing.append(str(link.get('href')))
                link.decompose()
        elif 'preload' in rel or 'prefetch' in rel:
            link.decompose()
    # Substitute local images and srcset references in DOM.
    for el in soup.find_all(['img', 'source', 'video']):
        for attr in ('src', 'poster'):
            if el.has_attr(attr):
                local = to_local(el[attr], root)
                if local:
                    uri = data_uri(local)
                    if uri: el[attr] = uri
        if el.has_attr('srcset'):
            entries = []
            for entry in el['srcset'].split(','):
                parts = entry.strip().split(' ', 1)
                local = to_local(parts[0], root)
                if local:
                    uri = data_uri(local)
                    parts[0] = uri if uri else parts[0]
                entries.append(' '.join(parts))
            el['srcset'] = ', '.join(entries)
    # Avoid scripts sending network requests or mutating display after load.
    for script in list(soup.find_all('script')):
        script.decompose()
    for style in soup.find_all('style'):
        if style.string and not style.get('data-inlined'):
            # the main CSS was already converted; inline styles are typically simple.
            pass
    html = str(soup)
    if missing:
        raise RuntimeError(f'Arquivos locais ausentes; não produzir screenshots incompletos: {sorted(set(missing))}')
    return html, {'embedded_stylesheets': embedded_css, 'assets': included, 'missing_assets': []}


def capture(html, dest):
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                                    args=['--no-sandbox', '--disable-dev-shm-usage'])
        try:
            for label, width, height, mobile in [('desktop', 1440, 900, False), ('mobile', 390, 844, True)]:
                context = browser.new_context(viewport={'width': width, 'height': height},device_scale_factor=1,
                                              is_mobile=mobile,has_touch=mobile)
                page = context.new_page()
                page_errors = []
                page.on('pageerror', lambda exc: page_errors.append(str(exc)))
                page.set_content(html, wait_until='load', timeout=60000)
                page.evaluate('async () => { await document.fonts.ready; await Promise.all(Array.from(document.images, img => img.decode().catch(() => null))); }')
                page.wait_for_timeout(200)
                details = page.evaluate('''() => ({
                    h1: Array.from(document.querySelectorAll('h1')).map(x => x.innerText.trim()),
                    title: document.title,
                    documentWidth: document.documentElement.scrollWidth,
                    documentHeight: document.documentElement.scrollHeight,
                    innerWidth: innerWidth,
                    innerHeight: innerHeight,
                    font: getComputedStyle(document.body).fontFamily,
                    fontsReady: document.fonts.status,
                    images: Array.from(document.images).map(x => ({loaded: x.complete && x.naturalWidth>0, naturalWidth: x.naturalWidth})),
                    stylesheetCount: document.styleSheets.length,
                    cssVars: {blue:getComputedStyle(document.body).getPropertyValue('--blue').trim(), deep:getComputedStyle(document.body).getPropertyValue('--deep').trim()},
                    heroBg: getComputedStyle(document.querySelector('.hero')).backgroundColor
                })''')
                details['viewport'] = {'width': width, 'height': height, 'mobile': mobile}
                details['page_errors'] = page_errors
                details['h1_matches'] = details['h1'] == [EXPECTED_H1]
                details['broken_images'] = sum(not x['loaded'] for x in details['images'])
                details['overflow_horiz'] = details['documentWidth'] > width + 2
                out = dest / f'home_arquivo_{label}_{width}_full.png'
                page.screenshot(path=str(out), full_page=True, animations='disabled')
                with Image.open(out) as img:
                    details['image_file'] = str(out)
                    details['screenshot_dimensions'] = [img.width, img.height]
                results.append(details)
                context.close()
        finally:
            browser.close()
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('zip', type=Path, help='ZIP original da branch arquivo/home-20261028')
    ap.add_argument('--out', type=Path, default=Path('/mnt/data/demello_home_arquivo_capturas'))
    args = ap.parse_args()
    if not args.zip.is_file():
        raise SystemExit(f'ZIP não encontrado: {args.zip}')
    args.out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='ma_home_zip_') as temp:
        root = safe_unzip(args.zip, Path(temp))
        html, manifest = build_snapshot(root)
        result = capture(html, args.out)
    report = {'zip_sha256': sha256(args.zip), 'index_sha256': EXPECTED_INDEX_SHA,
              'manifest': manifest, 'screenshots': result,
              'scope': 'visual, imagens e estilos estáticos; scripts e interações não testados'}
    report_path = args.out/'verificacao.json'
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'report': str(report_path), 'screenshots': [{
        'file': row['image_file'], 'dimensions': row['screenshot_dimensions'],
        'h1_matches': row['h1_matches'], 'broken_images': row['broken_images'],
        'overflow': row['overflow_horiz'], 'font': row['font'], 'errors': row['page_errors']
    } for row in result]}, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
