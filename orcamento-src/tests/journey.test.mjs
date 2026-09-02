import test from 'node:test';
import assert from 'node:assert/strict';
import {nodes,keyOf,valid,updateAnswer,switchRoute,advance,summary,suggestedServices,safetyHold,resultFor,packageForCRM,toggle} from '../src/journey.mjs';
function walk(route,overrides={}){let a={route},id='HOME',path=[];for(let i=0;i<50;i++){path.push(id);if(id==='X1')return {a,path};if(id!=='HOME'){const n=nodes[id];const v=Object.hasOwn(overrides,id)?overrides[id]:n.type==='location'?{city:'Curitiba',uf:'PR'}:n.type==='area'||n.type==='integer'?{value:'2',unknown:false}:n.type==='story'?'Quero conhecer as condições do imóvel.':n.type==='text'?'Situação que ainda não sei descrever.':n.type==='multi'?[n.options[0].value]:n.options[0].value;a=updateAnswer(a,id,v);}assert.ok(valid(id,a),id);const r=advance(id,a);id=r.id;a=r.answers;}throw Error('Loop');}
for(const route of ['build','regularize','problem','known'])test(`${route}: uma coleta e os mesmos X1, resultado e contato`,()=>{const {a,path}=walk(route);assert.equal(path.at(-1),'X1');assert.equal(advance('X1',a,'preview').id,'X3A');assert.equal(advance('X1',a,'missing').id,'X3B');assert.equal(advance('X3A',a).id,'X4');assert.equal(advance('X3B',a).id,'X4');assert.equal(advance('X4',a).id,'CRM');});
test('Construção, ampliação e indefinição convergem sem novas perguntas',()=>{const construction=walk('build');assert.deepEqual(construction.path,['HOME','CA1','CA_AREA','CA2','CA3','CA4','CA5','CA6','CA7','CA8','X1']);assert.deepEqual(walk('build',{CA1:'Ampliar um imóvel existente'}).path,['HOME','CA1','CA_EXISTING','CA_NEW','CA2','CA3','CA4','CA5','CA6','CA7','CA8','X1']);assert.ok(!walk('build',{CA1:'Ainda estou definindo'}).path.some(x=>['CA_AREA','CA_NEW','CA_EXISTING'].includes(x)));});
for(const [branch,details] of Object.entries({A:['REG_A1','REG_A2','REG_A3'],B:['REG_B1','REG_B2','REG_B3'],C:['REG_C-R1','REG_C-R2'],D:['REG_D1','REG_D2','REG_D3'],E:['REG_E1','REG_E2','REG_E3'],F:['REG_F1','REG_F2','REG_F3'],G:['REG_G1']}))test(`Regularização ${branch}: tronco antes de detalhes`,()=>{const {path}=walk('regularize',{REG_R1:branch});assert.deepEqual(path,['HOME','REG_R1','REG_C1','REG_C2','REG_C3','REG_C4',...details,'X1']);});
test('Avaliação é relato, imóvel, local e objetivo; fotos não obrigatórias',()=>{assert.deepEqual(walk('problem').path,['HOME','P1','P2','P3','P4','P5','X1']);assert.ok(valid('P2',{P2:'Só texto.'}));assert.ok(valid('P2',{photos:[{name:'foto.png'}]}));assert.equal(valid('P2',{}),false);});
test('Disciplinas sugeridas precisam de confirmação no próprio A7',()=>{let a={route:'build',property:'Casa/sobrado',services:['Não sei quais preciso']};assert.equal(valid('CA7',a),false);a={...a,confirmedSuggestions:suggestedServices(a),suggestionConfirmed:true};assert.ok(valid('CA7',a));assert.equal(advance('CA7',a).id,'CA8');assert.equal(valid('CA7',updateAnswer(a,'CA5',{value:'4'})),false);assert.deepEqual(toggle(['Estrutural'],'Não sei quais preciso','Não sei quais preciso'),['Não sei quais preciso']);});
test('Vários serviços seguem juntos por uma única coleta',()=>{const {a,path}=walk('known',{S1:['Estrutural','Drenagem','Hidrossanitário']});assert.deepEqual(path,['HOME','S1','S2','S3','S4','S5','S6','X1']);assert.deepEqual(a.services,['Estrutural','Drenagem','Hidrossanitário']);});
test('Serviço equivalente redireciona e preserva os dados compatíveis',()=>{const a={route:'known',services:['Outro'],otherService:'Regularização',location:{city:'Curitiba',uf:'PR'},property:'Casa/sobrado',phase:'Arquitetura pronta',S3:{value:'200'}};const r=advance('S1',a);assert.equal(r.id,'REG_R1');assert.equal(r.answers.route,'regularize');assert.deepEqual(r.answers.location,a.location);assert.equal(r.answers.property,a.property);assert.equal(r.answers.S3,undefined);assert.equal(r.answers.originalRequest,'Regularização');assert.equal(advance('S1',{...a,otherService:'Avaliação técnica'}).id,'P1');});
test('Redirecionamento não apaga serviços adicionais e exige avaliar esse escopo',()=>{const r=advance('S1',{route:'known',services:['Estrutural','Outro'],otherService:'Regularização'});assert.deepEqual(r.answers.carriedServices,['Estrutural']);assert.equal(resultFor(r.answers,'preview'),'X3B');});
test('Troca de rota limpa áreas, relato e fotos; localização e contato compatíveis ficam',()=>{const a={route:'problem',property:'Condomínio / edifício',location:{city:'Curitiba',uf:'PR'},P2:'Relato',photos:[{url:'blob:local'}],contact:{name:'Teste'}};const b=switchRoute(a,'build');assert.equal(b.property,undefined);assert.equal(b.photos,undefined);assert.equal(b.P2,undefined);assert.deepEqual(b.location,a.location);assert.deepEqual(b.contact,a.contact);});
test('Edição de ramo elimina detalhes antigos; diferença usa apenas dois valores conhecidos',()=>{const a={route:'regularize',REG_R1:'A',REG_A1:{value:'238'},REG_A2:{value:'190'},REG_C1:'Venda'};assert.ok(summary(a).some(r=>r.value==='48 m²'));const b=updateAnswer(a,'REG_R1','B');assert.equal(b.REG_A1,undefined);assert.equal(b.REG_C1,'Venda');assert.ok(!summary({...a,REG_A2:{unknown:true}}).some(r=>r.label==='Diferença entre as áreas'));});
test('Adaptação inequívoca preservada para documentos de regularização',()=>{const r=advance('REG_F1',{route:'regularize',REG_R1:'F',REG_F1:'Inventário',REG_C4:['IPTU','Matrícula']});assert.equal(r.id,'REG_F3');assert.equal(r.answers.REG_F2,'Os dois');const d=advance('REG_D1',{route:'regularize',REG_R1:'D',REG_D1:'Prefeitura',REG_C4:['Exigência/notificação']});assert.equal(d.id,'REG_D3');assert.equal(updateAnswer(d.answers,'REG_C4',['IPTU']).REG_D2,undefined);});
test('Segurança e foto sem relato vencem o controle de prévia simulada',()=>{const a={route:'problem',P2:'A rachadura aumentou depois da reforma.'};assert.ok(safetyHold(a));assert.equal(resultFor(a,'preview'),'X3B');assert.equal(resultFor({route:'problem',photos:[{name:'foto.png'}]},'preview'),'X3B');assert.equal(packageForCRM(a,'preview').preview,null);});
test('Pacote local único não envia dados, nem inclui bytes/URLs das fotos',()=>{const p=packageForCRM({route:'problem',P2:'Quero avaliar antes de comprar.',photos:[{name:'foto.png',size:123,type:'image/png',url:'blob:private',file:'bytes'}],contact:{name:'Teste',email:'teste@example.com'}},'missing');assert.equal(p.sent_to_crm,false);assert.equal(p.source,'IT083');assert.equal(p.attachments[0].uploaded,false);assert.equal(p.attachments[0].url,undefined);assert.equal(p.attachments[0].file,undefined);assert.equal(p.answers.photos,undefined);assert.ok(valid('X4',{contact:p.contact}));});
test('Resumo não mostra campos vazios, diagnóstico inventado ou serviços não confirmados',()=>{const r=summary({route:'build',services:['Não sei quais preciso'],property:'Casa/sobrado'});assert.ok(!r.some(x=>x.label==='Localização'));assert.ok(r.some(x=>x.value==='A definir'));assert.ok(!r.some(x=>x.value==='Estrutural'));});

// --- Jornada V1 -> pricing_inputs -> PAYLOAD V2 (decisões congeladas do comando FRONTEND V1) ---
test('Elétrica foi extirpada de todas as opções visíveis de serviço',()=>{
  assert.ok(!nodes.S1.options.some(o=>o.value==='Elétrica'||o.label==='Elétrica'));
  for(const id of Object.keys(nodes))for(const o of (nodes[id].options??[]))assert.ok(o.value!=='Elétrica'&&o.label!=='Elétrica',id);
});

test('Gás insere UMA pergunta de área atendida, só quando aplicável',()=>{
  const {path}=walk('build',{CA7:['Gás']});
  assert.deepEqual(path,['HOME','CA1','CA_AREA','CA2','CA3','CA4','CA5','CA6','CA7','Q_GAS','CA8','X1']);
  assert.ok(!walk('build',{CA7:['Estrutural']}).path.includes('Q_GAS'));
  const {path:kp}=walk('known',{S1:['Gás']});
  assert.deepEqual(kp,['HOME','S1','Q_GAS','S2','S3','S4','S5','S6','X1']);
});

test('Compatibilização BIM insere UMA pergunta de área de escopo',()=>{
  const {path}=walk('build',{CA7:['Compatibilização BIM']});
  assert.deepEqual(path,['HOME','CA1','CA_AREA','CA2','CA3','CA4','CA5','CA6','CA7','Q_COMPAT','CA8','X1']);
  const {path:both}=walk('known',{S1:['Gás','Compatibilização BIM']});
  assert.deepEqual(both,['HOME','S1','Q_GAS','Q_COMPAT','S2','S3','S4','S5','S6','X1']);
});

test('Desmarcar o serviço limpa a área condicional correspondente',()=>{
  let a={route:'build',services:['Gás'],area_atendida:{value:'50',unknown:false}};
  a=updateAnswer(a,'CA7',['Estrutural']);
  assert.equal(a.area_atendida,undefined);
});
