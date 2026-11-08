// Carrega o catálogo oficial do IBGE (arquivo estático do site) no módulo de municípios, como a tela faz.
// Sem catálogo, a validação de localização falha de propósito (municipios.mjs); os testes que usam localização importam este arquivo.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildIndex, setIndex } from '../../src/municipios.mjs';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'assets', 'municipios-ibge.v1.json');
setIndex(buildIndex(JSON.parse(readFileSync(file, 'utf8'))));
