// Página de verificação da maquete V05 R3. Usa os MESMOS módulos que a calculadora da candidata R4 compila
// (orcamento-src/src/maquete5_*). Cada linha da tabela é uma verificação com PASSA ou FALHA.
// Complementa os testes de node (tests/*.test.mjs): aqui fica o que só existe com a cena desenhada
// (chamadas de desenho, peças desenhadas depois de uma saída, fim da revelação, movimento reduzido, erros).
import { createMaqueteV5 } from '/after/maquete5_scene.mjs';
import { buildingSpec } from '/after/maquete5_building.mjs';

const LIMITE_CHAMADAS = 60;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = (n = 2) => new Promise((r) => { const f = () => (n-- <= 0 ? r() : requestAnimationFrame(f)); f(); });
const linhas = document.getElementById('linhas');
const resultado = [];
function linha(nome, ok, medido) {
  resultado.push({ nome, ok, medido });
  const tr = document.createElement('tr');
  tr.innerHTML = `<td></td><td class="r ${ok ? 'PASSA' : 'FALHA'}">${ok ? 'PASSA' : 'FALHA'}</td><td></td>`;
  tr.children[0].textContent = nome;
  tr.children[2].textContent = medido;
  linhas.append(tr);
}

const ALTO = { areaTotal: 320, floors: 2, typology: 'CASA', standard: 'Alto' };
const QUATRO = ['ARQUITETURA', 'ESTRUTURAL', 'HIDROSSANITARIO', 'ELETRICA'];
const TODAS = ['ARQUITETURA', 'ESTRUTURAL', 'HIDROSSANITARIO', 'ELETRICA', 'INCENDIO', 'GAS_GLP'];
const CASOS = [
  ['Sobrado Alto 320 m², 4 serviços', { ...ALTO, services: QUATRO }],
  ['Térrea Alto 180 m², Arquitetura e Hidro', { areaTotal: 180, floors: 1, typology: 'CASA', standard: 'Alto', services: ['ARQUITETURA', 'HIDROSSANITARIO'] }],
  ['Sobrado Médio 220 m², Arquitetura e Hidro', { areaTotal: 220, floors: 2, typology: 'CASA', standard: 'Médio', services: ['ARQUITETURA', 'HIDROSSANITARIO'] }],
  ['Casa 80 m², só Estrutura', { areaTotal: 80, floors: 1, typology: 'CASA', services: ['ESTRUTURAL'] }],
  ['Casa 60 m², Hidro (a menor)', { areaTotal: 60, floors: 1, typology: 'CASA', services: ['HIDROSSANITARIO'] }],
  ['Edifício 9.600 m², 8 pav., todas', { areaTotal: 9600, floors: 8, typology: 'PREDIO', services: TODAS }],
];

// Espera a cena parar: sem animação e sem revelação pendente. Depois desenha um quadro final.
async function assentar(api) {
  const st = api.debug.state;
  const t = Date.now();
  await sleep(200);
  while ((api.busy() || st.revealOn) && Date.now() - t < 15000) await sleep(100);
  await sleep(150);
  while (api.busy() && Date.now() - t < 15000) await sleep(100);
  api.render();
  return api.stats();
}
async function estado(api, o, view = 'conjunto') { api.update(buildingSpec(o), view); return assentar(api); }
// Peças efetivamente desenhadas: soma do que cada grupo visível desenha.
const desenhadas = (api) => api.debug.state.buckets.reduce((n, b) => n + (b.mesh.visible ? b.mesh.count : 0), 0);
const vivas = (api) => api.debug.state.parts.filter((p) => !p.leaving).length;

async function main() {
  const mobile = matchMedia('(max-width:900px)').matches;
  const api = await createMaqueteV5(document.getElementById('palco'), { mobile, ao: !mobile });
  const st = api.debug.state;

  // 1. limite de chamadas de desenho, por caso e vista
  for (const [nome, o] of CASOS) for (const view of ['conjunto', 'corte', 'planta']) {
    const s = await estado(api, o, view);
    linha(`Chamadas até ${LIMITE_CHAMADAS}: ${nome}, ${view}`, s.calls <= LIMITE_CHAMADAS, `${s.calls} chamadas, ${s.triangles} triângulos, oclusão ${s.ao ? 'ligada' : 'desligada'}`);
  }

  // 2. marcar Arquitetura: acabamento fica e troca de cor; só divisórias e escada crescem
  await estado(api, { ...ALTO, services: [] });
  api.update(buildingSpec({ ...ALTO, services: ['ARQUITETURA'] }), 'conjunto');
  {
    const ps = st.parts.filter((p) => !p.leaving);
    const cor = ps.filter((p) => p.fromHex != null);
    const cresce = [...new Set(ps.filter((p) => !p.settled).map((p) => p.name))].sort();
    const nomesCor = [...new Set(cor.map((p) => p.name))].sort();
    const ok = cor.length > 0 && cor.every((p) => p.settled) && nomesCor.join() === 'Forro do pórtico,Pergolado,Porta,Revestimento' && cresce.join() === 'Divisória,Escada,Patamar';
    linha('Marcar Arquitetura: acabamento troca de cor sem crescer de novo', ok, `${cor.length} peças trocam de cor (${nomesCor.join(', ')}); crescem: ${cresce.join(', ')}`);
    linha('Marcar disciplina nova liga a revelação', st.revealOn === true, `revelação ${st.revealOn ? 'ligada' : 'desligada'}`);
  }
  await assentar(api);
  linha('A revelação termina com a casa opaca', !st.revealOn && (st.alpha.get('volume') ?? 1) === 1, `revelação ${st.revealOn ? 'ligada' : 'desligada'}, transparência da edificação ${(st.alpha.get('volume') ?? 1).toFixed(2)}`);
  linha('A troca de cor termina', st.colorT === 1 && st.parts.every((p) => p.fromHex == null), `progresso da cor ${st.colorT.toFixed(2)}`);

  // 3. desmarcar: peças saem, e ao fim nenhuma peça que saiu continua desenhada
  await estado(api, { ...ALTO, services: QUATRO });
  api.update(buildingSpec({ ...ALTO, services: [] }), 'conjunto');
  const saindo = st.parts.filter((p) => p.leaving).length;
  const sAposSaida = await assentar(api);
  linha('Desmarcar: as peças saem encolhendo', saindo > 0, `${saindo} peças em saída`);
  linha('Depois da saída, só as peças do estado atual são desenhadas', desenhadas(api) === vivas(api), `${desenhadas(api)} desenhadas para ${vivas(api)} peças do estado`);
  const sLimpo = await estado(api, { ...ALTO, services: [] });
  linha('Depois da saída, chamadas e triângulos iguais aos de uma montagem limpa', sAposSaida.calls === sLimpo.calls && sAposSaida.triangles === sLimpo.triangles, `depois da saída ${sAposSaida.calls}/${sAposSaida.triangles}; limpa ${sLimpo.calls}/${sLimpo.triangles} (chamadas/triângulos)`);

  // 4. edifício → sobrado: o caso que já deixou peças invisíveis sendo desenhadas
  await estado(api, CASOS[5][1]);
  const sTroca = await estado(api, { ...ALTO, services: QUATRO });
  const sFresco = await estado(api, { ...ALTO, services: QUATRO });
  linha('Edifício para sobrado: triângulos iguais aos de um sobrado montado do zero', sTroca.triangles === sFresco.triangles, `${sTroca.triangles} depois da troca; ${sFresco.triangles} do zero`);

  // 5. movimento reduzido: uma cena à parte, criada com reduced
  const red = await createMaqueteV5(document.getElementById('palcoReduzido'), { reduced: true, mobile: true, ao: false });
  red.update(buildingSpec({ ...ALTO, services: [] }), 'conjunto');
  await frames(3);
  red.update(buildingSpec({ ...ALTO, services: QUATRO }), 'conjunto');
  await frames(3); await sleep(100);
  const rs = red.debug.state;
  const ok = !red.busy() && !rs.revealOn && rs.colorT === 1 && rs.leaveT >= 0.4 && (rs.alpha.get('volume') ?? 1) === 1 && rs.T === rs.TT;
  linha('Movimento reduzido: a troca acontece de uma vez, sem animação nem revelação', ok, `parada ${!red.busy()}, revelação ${rs.revealOn ? 'ligada' : 'desligada'}, transparência ${(rs.alpha.get('volume') ?? 1).toFixed(2)}`);
  red.destroy();

  // 6. erros
  await sleep(300);
  linha('Oclusão e ambiente carregados (como na calculadora)', mobile || api.stats().ao, mobile ? 'tela estreita: a calculadora desliga a oclusão' : `oclusão ${api.stats().ao ? 'ligada' : 'desligada'}`);
  linha('Nenhum erro no console nem promessa rejeitada', window.__erros.length === 0, window.__erros.length ? window.__erros.slice(0, 3).join(' | ') : 'nenhum');

  const falhas = resultado.filter((r) => !r.ok).length;
  const el = document.getElementById('resumo');
  el.textContent = falhas ? `${falhas} de ${resultado.length} verificações FALHARAM` : `Todas as ${resultado.length} verificações PASSARAM`;
  el.className = falhas ? 'falha' : 'ok';
  window.__resultado = { falhas, total: resultado.length, resultado, navegador: navigator.userAgent, mobile };
  document.querySelector('#json').textContent=JSON.stringify(window.__resultado,null,2);
}

main().catch((err) => {
  linha('A página de verificação rodou até o fim', false, String(err?.stack ?? err).slice(0, 300));
  document.getElementById('resumo').textContent = 'A verificação parou com erro';
  document.getElementById('resumo').className = 'falha';
  window.__resultado = { erro: String(err?.stack ?? err) };
});
