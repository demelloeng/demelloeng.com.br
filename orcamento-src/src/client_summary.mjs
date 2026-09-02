import { brlStr } from './pricing/decimal.mjs';

export const NEXT_STEP =
  'Para avançar, entre em contato com a DEMELLO para confirmarmos as particularidades e o escopo do seu projeto.';

const SERVICE_PT = {
  ESTRUTURAL: 'Estrutural',
  HIDROSSANITARIO: 'Hidrossanitário',
  INCENDIO: 'Incêndio',
  GAS_GLP: 'Gás',
  ARQUITETURA: 'Arquitetura',
  REGULARIZACAO: 'Regularização',
  ORCAMENTO: 'Orçamento',
  TERRAPLENAGEM: 'Terraplenagem',
  COMPATIBILIZACAO: 'Compatibilização BIM',
};

export const friendlyServiceName = (service) =>
  service?.pricing_context?.structural_scope === 'FOUNDATION_ONLY'
    ? 'Fundações'
    : (SERVICE_PT[service?.service] ?? 'Serviço a confirmar');

const filledContact = (contact = {}) =>
  [
    ['Nome', contact.name],
    ['WhatsApp', contact.whatsapp],
    ['E-mail', contact.email],
  ].filter(([, value]) => typeof value === 'string' && value.trim());

export function buildClientSummary(payload) {
  const rows = Array.isArray(payload?.summary) ? payload.summary : [];
  const preview = payload?.pricing_preview ?? {};
  const services = Array.isArray(preview.services) ? preview.services : [];
  const serviceNames = [...new Set(services.map(friendlyServiceName))];
  const references = services
    .filter((service) => service.status === 'CALCULATED' && service.references)
    .flatMap((service) => {
      const name = friendlyServiceName(service);
      const lines = service.references.secid_pr
        ? [`SECID/PR — ${name}: ${brlStr(service.references.secid_pr.total)}`]
        : [];
      if (service.references.altoqi) lines.push(`AltoQi — ${name}: ${brlStr(service.references.altoqi.total)}`);
      return lines;
    });
  const contact = filledContact(payload?.contact);
  const total = preview.status === 'CALCULATED' && preview.total_demello
    ? brlStr(preview.total_demello)
    : 'Avaliação humana necessária';

  const lines = [
    'DEMELLO ENGENHARIA',
    'RESUMO DO SEU CASO',
    '',
    'SEU CASO',
    ...(rows.length ? rows.map((row) => `${row.label}: ${row.value}`) : ['Informações a confirmar com a DEMELLO.']),
    '',
    'SERVIÇOS',
    ...(serviceNames.length ? serviceNames : [payload?.route === 'problem' ? 'Avaliação técnica' : 'Serviço a confirmar']),
    '',
    'PREVISÃO INICIAL DEMELLO',
    total,
    '',
    'REFERÊNCIAS',
    ...(references.length ? references : ['A confirmar após avaliação do caso.']),
  ];

  if (contact.length) {
    lines.push('', 'DADOS INFORMADOS', ...contact.map(([label, value]) => `${label}: ${value.trim()}`));
  }

  lines.push('', 'PRÓXIMO PASSO', NEXT_STEP, '');
  return lines.join('\n');
}
