"""Notifica IndexNow com as URLs alteradas entre dois sitemaps publicados."""
import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
HOST = 'demelloeng.com.br'
ENDPOINT = 'https://api.indexnow.org/indexnow'


def sitemap_dates(xml):
    dates = {}
    for element in ET.fromstring(xml).findall('s:url', NAMESPACE):
        url = element.findtext('s:loc', namespaces=NAMESPACE)
        date = element.findtext('s:lastmod', namespaces=NAMESPACE)
        if not url or not url.startswith(f'https://{HOST}/') or not date:
            raise ValueError('URL ou lastmod inválido no sitemap')
        dates[url] = date
    if not dates:
        raise ValueError('Sitemap sem URLs')
    return dates


def previous_dates(before):
    if not re.fullmatch('[0-9a-f]{40}', before) or before == '0' * 40:
        return {}
    previous = subprocess.run(['git', 'show', f'{before}:sitemap.xml'], cwd=ROOT,
                              capture_output=True, check=False)
    if previous.returncode:
        return {}
    try:
        return sitemap_dates(previous.stdout)
    except (ET.ParseError, ValueError):
        return {}


def payload(current, prior, key):
    return {
        'host': HOST, 'key': key, 'keyLocation': f'https://{HOST}/{key}.txt',
        'urlList': [url for url, lastmod in current.items() if prior.get(url) != lastmod],
    }


def main(before, key):
    if not re.fullmatch('[0-9a-f]{32}', key):
        raise ValueError('Chave IndexNow inválida')
    if (ROOT / f'{key}.txt').read_text(encoding='utf-8').strip() != key:
        raise ValueError('Chave IndexNow difere do arquivo publicado')
    data = payload(sitemap_dates((ROOT / 'sitemap.xml').read_bytes()), previous_dates(before), key)
    if not data['urlList']:
        print('IndexNow: nenhum lastmod mudou')
        return
    request = Request(ENDPOINT, json.dumps(data).encode('utf-8'),
                      headers={'Content-Type': 'application/json; charset=utf-8'}, method='POST')
    with urlopen(request, timeout=15) as response:
        print(f'IndexNow: HTTP {response.status}, {len(data["urlList"])} URLs')


if __name__ == '__main__':
    main(*sys.argv[1:])
