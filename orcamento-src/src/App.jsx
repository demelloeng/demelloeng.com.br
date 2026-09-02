import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowSquareOut, Check, CaretDown, PencilSimple, X, DownloadSimple, SlidersHorizontal } from '@phosphor-icons/react';
import { nodes, common, numeric, options, valid, setAnswer, toggleDocument, advance, summary, missingData, localPackage, ufs } from './flow.mjs';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/700.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/600.css';

const stageNames=['Situação','Finalidade','Localização','Imóvel','Documentos'];
const branchTitles={A:'Áreas divergentes',B:'Construção ou ampliação',C:'Documentação',D:'Pendência informada',E:'Alteração no imóvel',F:'Entender a situação',G:'Outro caso'};

function Modal({title,onClose,children}) {
  const ref=useRef(null);
  useEffect(()=>{ref.current.showModal();return()=>ref.current?.close();},[]);
  return <dialog ref={ref} onCancel={onClose} onClick={e=>{if(e.target===ref.current)onClose();}} aria-labelledby="modal-title"><header><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={24}/></button></header>{children}</dialog>;
}

export function App() {
  const [node,setNode]=useState('R0');
  const [answers,setAnswers]=useState({});
  const [history,setHistory]=useState([]);
  const [gate,setGate]=useState('missing');
  const [modal,setModal]=useState(null);
  const [mobileSummary,setMobileSummary]=useState(false);
  const [submitted,setSubmitted]=useState(false);
  const [error,setError]=useState('');
  const [copied,setCopied]=useState(false);
  const heading=useRef(null);
  const current=nodes[node], rows=summary(answers), missing=missingData(answers);
  const commonIndex=common.indexOf(node);
  const progress=commonIndex>=0?stageNames:['Detalhes','Seu caso','Prévia','Contato'];
  const progressIndex=commonIndex>=0?commonIndex:node==='X1'?1:node.startsWith('X3')?2:node==='X4'?3:0;
  useEffect(()=>{heading.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});setCopied(false);setError('');},[node]);
  function change(id,value){setAnswers(a=>setAnswer(a,id,value));if(id!=='X4')setHistory(h=>h.filter(previous=>!previous.startsWith('X')));setSubmitted(false);setError('');}
  function next(e){
    e.preventDefault();
    if(!valid(node,answers)){setError(node==='X4'?'Informe seu nome e pelo menos um contato válido.':'Complete a opção indicada para continuar.');return;}
    if(node==='X4'){setSubmitted(true);return;}
    const result=advance(node,answers,gate);setAnswers(result.answers);setHistory(h=>[...h,node]);setNode(result.node);
  }
  function back(){if(!history.length)return;setNode(history.at(-1));setHistory(h=>h.slice(0,-1));setSubmitted(false);}
  function reset(){setAnswers({});setNode('R0');setHistory([]);setSubmitted(false);setModal(null);setMobileSummary(false);}
  function edit(id){if(!id)return;const index=common.indexOf(id);setHistory(['R0',...common.slice(0,index>=0?index:common.length)]);setNode(id);setMobileSummary(false);setSubmitted(false);}
  function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(localPackage(answers,gate),null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='demello-caso-demonstracao.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function copySummary(){try{await navigator.clipboard.writeText('Regularização de imóvel\n'+rows.map(r=>`${r.label}: ${r.value}`).join('\n'));setCopied(true);}catch{setError('Não foi possível copiar automaticamente. Você pode selecionar o resumo na tela.');}}
  function loadExample(){setAnswers({R1:'A',C1:'Inventário/partilha',C2:{city:'Curitiba',uf:'PR'},C3:'Casa/sobrado',C4:['Matrícula','IPTU']});setNode('C4');setHistory(['R0','R1','C1','C2','C3']);setSubmitted(false);setModal(null);}
  function chooseGate(value){setGate(value);if(node.startsWith('X3')||node==='X4'){setNode('X1');setHistory(h=>h.filter(id=>!id.startsWith('X')));}setSubmitted(false);}
  function summaryRows(editable=true){return <dl className="summary-list">{rows.map((row,i)=><div className={`summary-row ${row.id?'':'derived'}`} key={row.id??i}><dt>{row.label}</dt><dd>{row.value}</dd>{editable&&row.id&&<button type="button" className="edit-button" aria-label={`Editar ${row.label}`} onClick={()=>edit(row.id)}><PencilSimple size={17}/></button>}</div>)}</dl>;}
  function choices(){const multi=node==='C4';return <fieldset className={`choices ${options(node).length>5?'compact':''}`}><legend className="sr-only">{current.title}</legend>{options(node).map(option=><label className={`choice ${(multi?answers[node]?.includes(option.value):answers[node]===option.value)?'selected':''}`} key={option.value}><span>{option.label}</span><input type={multi?'checkbox':'radio'} name={node} value={option.value} checked={multi?!!answers[node]?.includes(option.value):answers[node]===option.value} onChange={()=>change(node,multi?toggleDocument(answers[node]??[],option.value):option.value)}/></label>)}</fieldset>;}

  return <div className="app-shell">
    <a className="skip-link" href="#question">Ir para a pergunta</a>
    <header className="site-header"><a href="https://demelloeng.com.br" target="_blank" rel="noreferrer" aria-label="DEMELLO — abrir site"><img src="/assets/demello-logo.png" alt="DEMELLO Engenharia"/></a><span>FAÇA SEU ORÇAMENTO</span><a className="site-link" href="https://demelloeng.com.br" target="_blank" rel="noreferrer" aria-label="Voltar ao site da DEMELLO (nova aba)"><span>demelloeng.com.br</span><ArrowSquareOut size={18}/></a></header>
    <div className="workspace">
      <main className="question-panel" id="question" data-state={node}>
        <div className="section-label">{node!=='R0'&&<button className="icon-button" onClick={back} aria-label="Voltar à pergunta anterior"><ArrowLeft size={18}/></button>}<span>{node==='R0'?'Faça seu orçamento':common.includes(node)||node.startsWith('X')?'Regularizar meu imóvel':branchTitles[answers.R1]}</span></div>
        <h1 ref={heading} tabIndex={-1}>{current.title}</h1>
        {node==='R0'&&<div className="welcome"><p className="intro">Escolha o que está acontecendo.<br/>O resto, uma etapa de cada vez.</p><div className="promise"><h2>Primeiro, a prévia.<br/>Depois, seu contato.</h2><p>Não precisa saber o nome técnico.<br/>Só o que você quer resolver.</p></div><p className="small-note">A prévia depende das informações disponíveis e da validação do escopo.</p></div>}
        {node==='C4'&&<p className="helper">Pode marcar mais de uma opção.</p>}
        {node==='X1'&&<p className="helper">Confira as informações. Você pode editar qualquer resposta.</p>}
        <form id="question-form" onSubmit={next} noValidate>
          {(current.component.startsWith('Cards')||node==='C4')&&choices()}
          {node==='C2'&&<div className="location-fields"><label>Cidade<input autoComplete="address-level2" maxLength={90} value={answers.C2?.city??''} onChange={e=>change('C2',{...answers.C2,city:e.target.value})}/></label><label>UF<select autoComplete="address-level1" value={answers.C2?.uf??''} onChange={e=>change('C2',{...answers.C2,uf:e.target.value})}><option value="">Selecione</option>{ufs.map(uf=><option key={uf}>{uf}</option>)}</select></label></div>}
          {numeric.includes(node)&&<div className="area-fields"><label htmlFor="area">Área informada</label><div className="measure"><input id="area" type="text" inputMode="decimal" maxLength={14} placeholder="0,00" disabled={answers[node]?.unknown??false} value={answers[node]?.value??''} onChange={e=>change(node,{value:e.target.value,unknown:false})}/><span>m²</span></div><label className="unknown"><input type="checkbox" checked={answers[node]?.unknown??false} onChange={e=>change(node,{value:'',unknown:e.target.checked})}/>Não sei</label>{answers[node]?.value&& !valid(node,answers)&&<p className="field-error">Use um valor maior que zero, com até duas casas decimais.</p>}</div>}
          {node==='G1'&&<label className="text-field">O que está acontecendo?<textarea rows={3} maxLength={280} placeholder="Uma frase é suficiente." value={answers.G1??''} onChange={e=>change('G1',e.target.value)}/><span className="character-count">{answers.G1?.length??0}/280</span></label>}
          {node==='X1'&&<div className="review-summary">{summaryRows()}</div>}
          {node==='X3A'&&<div className="result-card"><span className="eyebrow">PRÉVIA DE INVESTIMENTO</span><p className="investment">R$ 1.500 – R$ 2.500</p><strong>Valor fictício para demonstrar esta tela.</strong><p>Não é um orçamento e não foi calculado a partir do seu imóvel. O motor de preços ainda não está conectado.</p></div>}
          {node==='X3B'&&<div className="result-card"><h2>{missing.length?'Informações ainda não definidas':'A prévia depende de validação técnica.'}</h2>{missing.length>0&&<ul>{missing.map(item=><li key={item}>{item}</li>)}</ul>}<p className="demo-explanation">Saída de demonstração. A regra que define quais dados são suficientes para precificar ainda não está conectada.</p></div>}
          {node==='X4'&&!submitted&&<><p className="helper">Seu nome e pelo menos um meio de contato.</p><div className="contact-fields"><label>Nome<input autoComplete="name" maxLength={100} value={answers.X4?.name??''} onChange={e=>change('X4',{...answers.X4,name:e.target.value})}/></label><label>WhatsApp<input type="tel" autoComplete="tel" maxLength={24} placeholder="(41) 99999-9999" value={answers.X4?.whatsapp??''} onChange={e=>change('X4',{...answers.X4,whatsapp:e.target.value})}/></label><label>E-mail<input type="email" autoComplete="email" maxLength={160} placeholder="voce@exemplo.com" value={answers.X4?.email??''} onChange={e=>change('X4',{...answers.X4,email:e.target.value})}/></label></div><p className="small-note">Neste protótipo, os dados ficam apenas nesta página. Nada será enviado à DEMELLO, por e-mail, WhatsApp ou CRM. Use dados fictícios.</p></>}
          {node==='X4'&&submitted&&<div className="result-card success" role="status"><Check size={36}/><h2>Caso preparado para demonstração.</h2><p>O envio ao CRM foi simulado. Nenhuma informação saiu desta página.</p><button type="button" className="secondary-button" onClick={download}><DownloadSimple size={20}/>Baixar caso estruturado</button></div>}
        </form>
        {node==='C4'&&<p className="small-note">Não precisa enviar os documentos agora.</p>}
        {error&&<p className="field-error" role="alert">{error}</p>}
        {(node==='X1'||node.startsWith('X3'))&&<button className="text-button copy-button" onClick={copySummary}>{copied?'Resumo copiado':'Copiar resumo'}</button>}
        <div className="actions"><button className={`back-button ${node==='R0'?'invisible':''}`} disabled={node==='R0'} onClick={back}><ArrowLeft size={19}/>Voltar</button>{submitted?<button className="primary-button" onClick={reset}>Recomeçar<ArrowRight size={22}/></button>:<button className="primary-button" type="submit" form="question-form" disabled={!valid(node,answers)}>{node==='R0'?'Começar':node==='X4'?'Simular envio ao CRM':'Continuar'}<ArrowRight size={22}/></button>}</div>
        {!valid(node,answers)&&<p className="continue-hint">{node==='C2'?'Informe a cidade e a UF.':numeric.includes(node)?'Informe a área ou marque “Não sei”.':node==='G1'?'Descreva seu caso em uma frase.':node==='X4'?'Informe nome e um contato válido.':'Selecione uma opção para continuar.'}</p>}
      </main>
      <aside className={`case-panel ${mobileSummary?'expanded':''}`} aria-label="Resumo do seu caso"><div className="case-heading"><div><span className="eyebrow">RESUMO DO CASO</span><h2>Seu caso</h2></div><button className="mobile-summary-toggle" onClick={()=>setMobileSummary(v=>!v)} aria-expanded={mobileSummary} aria-controls="case-body">{mobileSummary?'Recolher':'Expandir'}<CaretDown size={18}/></button></div><p className="case-subtitle">Regularização de imóvel</p><div className="case-body" id="case-body">{rows.length?summaryRows():<p className="empty-summary">Suas escolhas aparecem aqui.<br/>Uma visão simples do que importa.</p>}</div></aside>
    </div>
    <footer className="site-footer">{node==='R0'?<span className="footer-intro">Poucas perguntas. Um próximo passo claro.</span>:<ol className="progress" aria-label="Etapas">{progress.map((name,i)=><li key={name} className={`${i===progressIndex?'active':''} ${i<progressIndex?'done':''}`} aria-current={i===progressIndex?'step':undefined}><span className="step-number">{i<progressIndex?<Check size={12}/>:i+1}</span><span>{name}</span></li>)}</ol>}<nav aria-label="Informações"><button onClick={()=>setModal('how')}>Como funciona</button><button onClick={()=>setModal('privacy')}>Privacidade</button><button className="demo-button" onClick={()=>setModal('demo')}><SlidersHorizontal size={16}/>Protótipo</button></nav></footer>
    <div className="demo-bar">Demonstração local · Sem orçamento real ou envio ao CRM</div>
    {modal&&<Modal title={modal==='demo'?'Controles de demonstração':modal==='privacy'?'Privacidade neste protótipo':'Como funciona'} onClose={()=>setModal(null)}>
      {modal==='demo'?<><p>Controles para revisão da UX. Não fazem parte do percurso do visitante.</p><fieldset className="demo-controls"><legend>Saída após conferir o caso</legend><label><input type="radio" name="gate" checked={gate==='missing'} onChange={()=>chooseGate('missing')}/>Mostrar “Faltam dados”</label><label><input type="radio" name="gate" checked={gate==='preview'} onChange={()=>chooseGate('preview')}/>Mostrar prévia fictícia</label></fieldset><p>O preço é um exemplo fixo, independente das respostas. A classificação de “Outro caso” usa correspondências locais conservadoras, não uma IA conectada.</p><div className="modal-actions"><button className="secondary-button" onClick={loadExample}>Carregar exemplo: documentos</button><button className="text-button" onClick={reset}>Recomeçar do início</button></div></>:modal==='privacy'?<><p>As respostas ficam na memória desta página. Não são gravadas em servidor, cookies ou armazenamento permanente do navegador.</p><p>Atualizar a página ou recomeçar apaga o caso. O arquivo do caso só é gerado se você escolher baixá-lo.</p><p>Use dados fictícios. Não há envio real ao CRM nem mensagens por e-mail ou WhatsApp.</p></>:<><p>Primeiro: situação, finalidade, localização, tipo de imóvel e documentos. Depois, só as perguntas específicas do seu caso.</p><p>O resumo acompanha suas escolhas. Use o lápis para revisar uma resposta.</p><p>Esta é uma demonstração de UX. A classificação e as saídas de preço são simuladas. Na experiência final, o valor será gerado por um motor de regras, não pela IA.</p></>}
    </Modal>}
  </div>;
}
