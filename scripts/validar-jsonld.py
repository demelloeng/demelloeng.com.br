#!/usr/bin/env python3
"""Valida JSON-LD nas URLs publicadas pelo sitemap, sem chamadas externas."""
import argparse
from collections import Counter
from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from xml.etree import ElementTree as ET

TYPES = set('Answer BreadcrumbList City ContactPoint Country EducationalOccupationalCredential '
            'FAQPage ListItem Offer OfferCatalog Organization Person PostalAddress ProfessionalService '
            'Question Service State WebSite'.split())


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.current = None
        self.blocks = []

    def handle_starttag(self, tag, attrs):
        if tag == 'script' and dict(attrs).get('type') == 'application/ld+json':
            self.current = ''

    def handle_data(self, data):
        if self.current is not None:
            self.current += data

    def handle_endtag(self, tag):
        if tag == 'script' and self.current is not None:
            self.blocks.append(self.current)
            self.current = None


def visit(node):
    if isinstance(node, dict):
        yield node
        for value in node.values():
            yield from visit(value)
    elif isinstance(node, list):
        for value in node:
            yield from visit(value)


def reject_constant(value):
    raise ValueError(f'constante JSON inválida: {value}')


def report(root):
    urls = [element.text for element in ET.parse(root / 'sitemap.xml').findall(
        './/{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
    defined = set()
    references = []
    pages = []
    errors = []
    for url in urls:
        path = urlsplit(url).path.removeprefix('/')
        path += 'index.html' if url.endswith('/') else ''
        types = Counter()
        parser = Scripts()
        try:
            parser.feed((root / path).read_text(encoding='utf-8'))
            parser.close()
        except (OSError, UnicodeError) as error:
            errors.append({'url': url, 'erro': str(error)})
        if parser.current is not None:
            errors.append({'url': url, 'erro': 'script JSON-LD sem fechamento'})
        for block in parser.blocks:
            try:
                content = json.loads(block, parse_constant=reject_constant)
                if not isinstance(content, (dict, list)):
                    raise ValueError('JSON-LD precisa ser objeto ou lista')
            except ValueError as error:
                errors.append({'url': url, 'erro': str(error)})
                continue
            for node in visit(content):
                kind = node.get('@type', [])
                for name in kind if isinstance(kind, list) else [kind]:
                    if not isinstance(name, str) or name not in TYPES:
                        errors.append({'url': url, 'tipo_desconhecido': name})
                    else:
                        types[name] += 1
                if '@id' in node:
                    value = node['@id']
                    if not isinstance(value, str) or not value:
                        errors.append({'url': url, 'id_invalido': value})
                        continue
                    ident = urljoin(url, value)
                    if set(node) == {'@id'}:
                        references.append((url, ident))
                    else:
                        defined.add(ident)
        pages.append({'url': url, 'arquivo': path, 'blocos': len(parser.blocks), 'tipos': dict(types)})
    for url, ident in references:
        if ident not in defined:
            errors.append({'url': url, 'id_sem_definicao': ident})
    if len(pages) != 20 or len(set(urls)) != 20:
        errors.append({'erro': 'Esperadas 20 URLs únicas no sitemap'})
    return {'paginas': pages, 'ids_definidos': sorted(defined), 'referencias': len(references), 'erros': errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    result = report(args.root)
    args.out.write_bytes((json.dumps(result, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))
    print(f'JSON-LD: {len(result["paginas"])} URLs, {len(result["erros"])} erros')
    return bool(result['erros'])


if __name__ == '__main__':
    raise SystemExit(main())
