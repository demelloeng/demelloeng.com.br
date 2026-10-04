import { brlStr } from './pricing/decimal.mjs';
import { referenceEntries } from './references.mjs';

export const NEXT_STEP =
  'Para avançar, entre em contato com a DEMELLO para confirmarmos as particularidades e o escopo do seu projeto.';

const SERVICE_PT = {
  ESTRUTURAL: 'Estrutural',
  HIDROSSANITARIO: 'Hidrossanitário',
  INCENDIO: 'Incêndio',
  GAS_GLP: 'Gás',
  ARQUITETURA: 'Arquitetura',
  REGULARIZACAO: 'Regularização',
  ORCAMENTO: 'Orçamento técnico',
  TERRAPLENAGEM: 'Terraplenagem',
  COMPATIBILIZACAO: 'Compatibilização BIM',
  CONSULTORIA_TECNICA: 'Consultoria técnica',
  MENTORIA_TECNICA: 'Mentoria técnica',
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
      return referenceEntries(service.references).map(({ label, total }) => `${label} — ${name}: ${brlStr(total)}`);
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
    'ESTIMATIVA INICIAL DEMELLO',
    total,
    '',
    'REFERÊNCIAS',
    ...(references.length ? references : ['A confirmar após avaliação do caso.']),
  ];

  const doubt = typeof payload?.answers?.scope_question === 'string' ? payload.answers.scope_question.trim() : '';
  if (doubt) lines.push('', 'SUA DÚVIDA SOBRE O ESCOPO', doubt);
  const a = payload?.answers ?? {};
  if (a.architecture_area_source && a.architecture_area_source !== 'USER_DECLARED') {
    const origem = { NEEDS_PROGRAM_ESTIMATE: 'programa de necessidades', PROGRAM_AND_LOT_ESTIMATE: 'programa de necessidades e terreno', LOT_ONLY_ESTIMATE: 'terreno', HUMAN_REVIEW_REQUIRED: 'a confirmar com a equipe' }[a.architecture_area_source];
    lines.push('', 'ÁREA DE REFERÊNCIA DA ARQUITETURA', `Origem: ${origem}`);
    if (a.architecture_area_reference != null) lines.push(`Faixa aproximada: ${a.architecture_area_min} a ${a.architecture_area_max} m²`, `Referência usada no orçamento: ${a.architecture_area_reference} m²`);
    lines.push('Estimativa inicial, não informada por você. Não é a área permitida nem o potencial construtivo; a confirmar na análise técnica.');
  }

  if (contact.length) {
    lines.push('', 'DADOS INFORMADOS', ...contact.map(([label, value]) => `${label}: ${value.trim()}`));
  }

  lines.push('', 'PRÓXIMO PASSO', NEXT_STEP, '');
  return lines.join('\n');
}
