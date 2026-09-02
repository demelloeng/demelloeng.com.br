import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {map} from '../src/map.js';
import {nodes,options,area,difference,valid,setAnswer,toggleDocument,classify,advance,summary,localPackage,unknownDocuments} from '../src/flow.mjs';
const trunk={R1:'A',C1:'Inventário/partilha',C2:{city:'Curitiba',uf:'PR'},C3:'Casa/sobrado',C4:[unknownDocuments]};
const branches={A:['A1','A2','A3'],B:['B1','B2','B3'],C:['C-R1','C-R2'],D:['D1','D2','D3'],E:['E1','E2','E3'],F:['F1','F2','F3'],G:['G1']};
const example=id=>['A1','A2','B2','E2'].includes(id)?{value:'238',unknown:false}:id==='G1'?'Uma situação ainda sem descrição técnica.':options(id)[0].value;
test('Mapa preservado: 30 estados e 43 transições, sem novas perguntas',()=>{
 const source=JSON.parse(readFileSync(new URL('../fixtures/MAPA_ESTADOS_IT075.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
 assert.deepEqual(map,source);assert.equal(map.nodes.length,30);assert.equal(map.nodes.reduce((n,x)=>n+x.transitions.length,0),43);
 for(const n of map.nodes)for(const t of n.transitions)assert.ok(nodes[t.to]||t.to==='CRM');
});
for(const [branch,expected] of Object.entries(branches))test(`Ramo ${branch}: todo o tronco vem antes dos detalhes e converge em X1`,()=>{
 let answers={},node='R0';const path=[];
 const input={...trunk,R1:branch};
 for(let n=0;n<20 && node!=='X1';n++){
   path.push(node);if(node!=='R0')answers=setAnswer(answers,node,Object.hasOwn(input,node)?input[node]:example(node));
   assert.equal(valid(node,answers),true,node);
   const result=advance(node,answers);node=result.node;answers=result.answers;
 }
 assert.deepEqual(path,['R0','R1','C1','C2','C3','C4',...expected]);assert.equal(node,'X1');
 assert.equal(advance(node,answers).node,'X3B');assert.equal(advance(node,answers,'preview').node,'X3A');
 assert.equal(advance('X3A',answers).node,'X4');assert.equal(advance('X3B',answers).node,'X4');assert.equal(advance('X4',answers).node,'CRM');
});
test('Áreas desconhecidas não viram zero; diferença absoluta só com dois números',()=>{
 assert.equal(area({value:'238,25'}),238.25);assert.equal(area({value:'0'}),null);assert.equal(area({value:'-1'}),null);assert.equal(area({value:'NaN'}),null);assert.equal(area({value:'20.000'}),null);
 assert.equal(difference({A1:{value:'238'},A2:{value:'190'}}),48);
 assert.equal(difference({A1:{value:'190'},A2:{value:'238'}}),48);
 assert.equal(difference({A1:{value:'238'},A2:{unknown:true}}),null);
 assert.equal(valid('A1',{A1:{unknown:true}}),true);
 assert.ok(!summary({A1:{value:'238'}}).some(r=>r.label==='Diferença entre as áreas'));
});
test('Não sei é exclusivo dos documentos, mas pode ser desmarcado',()=>{
 assert.deepEqual(toggleDocument(['IPTU'],unknownDocuments),[unknownDocuments]);
 assert.deepEqual(toggleDocument([unknownDocuments],'Matrícula'),['Matrícula']);
 assert.deepEqual(toggleDocument([unknownDocuments],unknownDocuments),[]);
 assert.equal(valid('C4',{C4:['IPTU',unknownDocuments]}),false);
});
test('Só pulamos D2 e F2 quando os documentos são inequívocos',()=>{
 let r=advance('D1',{...trunk,R1:'D',D1:'Prefeitura',C4:['Exigência/notificação']});assert.equal(r.node,'D3');assert.equal(r.answers.D2,'Sim');
 r=advance('F1',{...trunk,R1:'F',F1:'Inventário',C4:['IPTU','Matrícula']});assert.equal(r.node,'F3');assert.equal(r.answers.F2,'Os dois');
 assert.equal(advance('F1',{...trunk,R1:'F',F1:'Inventário',C4:['IPTU']}).node,'F2');
 assert.equal(advance('B2',{...trunk,R1:'B',B2:{value:'60'},C4:['Planta/projeto']}).node,'B3');
 assert.equal(advance('D1',{...trunk,R1:'D',D1:'Prefeitura'}).node,'D2');
});
test('Edição preserva tronco, invalida detalhes de outro ramo e respostas derivadas',()=>{
 const a=setAnswer({...trunk,A1:{value:'238'},A2:{value:'190'},A3:'Não sei'},'R1','B');assert.equal(a.C1,trunk.C1);assert.equal(a.A1,undefined);assert.equal(advance('R1',a).node,'B1');
 const r=advance('F1',{...trunk,R1:'F',F1:'Inventário',C4:['IPTU','Matrícula']});
 assert.equal(setAnswer(r.answers,'C4',['IPTU']).F2,undefined);
 assert.equal(setAnswer(setAnswer(r.answers,'F2','Só IPTU'),'C4',['IPTU']).F2,'Só IPTU');
 const g=setAnswer({...trunk,R1:'G',G1:'IPTU e matrícula não batem',A1:{value:'238'}},'G1','Outro assunto');assert.equal(g.A1,undefined);
});
test('G2 não cria tela, roteia exemplo explícito e conserva caso ambíguo',()=>{
 assert.equal(classify('A área do IPTU e da matrícula não bate'),'A');assert.equal(classify('Construí e não regularizei'),'B');
 assert.equal(classify('Não construí e não ampliei, só quero informações'),null);
 assert.equal(classify('Falta documento e construí e não regularizei'),null);
 assert.equal(classify('Quero conversar sobre meu imóvel'),null);
 assert.equal(classify('Não falta documento, só quero verificar'),null);
 const r=advance('G1',{...trunk,R1:'G',G1:'A área do IPTU e da matrícula não bate'});assert.equal(r.node,'A1');assert.deepEqual(r.internal,['G2']);
 assert.equal(advance('G1',{...trunk,R1:'G',G1:'Outro assunto'}).node,'X1');
});
test('Contato mínimo válido; pacote declara simulação e não envio',()=>{
 assert.equal(valid('X4',{X4:{name:'Teste',email:'teste@example.com'}}),true);
 assert.equal(valid('X4',{X4:{name:'Teste',whatsapp:'(41) 99999-9999'}}),true);
 assert.equal(valid('X4',{X4:{name:'Teste',whatsapp:'abc',email:'teste@example.com'}}),false);
 assert.equal(valid('X4',{X4:{name:'Teste',email:'invalido'}}),false);
 const a=localPackage({...trunk,X4:{name:'Teste',email:'teste@example.com'},_derivedF2:true},'preview');
 assert.equal(a.sent_to_crm,false);assert.equal(a.preview.simulated,true);assert.equal(a.answers._derivedF2,undefined);assert.equal(a.answers.X4,undefined);
 assert.deepEqual(a.preview,localPackage({...trunk,A1:{value:'9000'}},'preview').preview);
});
