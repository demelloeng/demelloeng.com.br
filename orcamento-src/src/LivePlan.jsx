import {Component,useEffect,useMemo,useRef,useState} from 'react';
import {livePlanModel,LAYER_LABEL} from './live_plan.mjs';
import {sceneSpec,describeScene,VIEWS,LAYER_COLOR,isoShapes,isoViewBox} from './maquete_model.mjs';
import {friendlyServiceName as serviceName} from './client_summary.mjs';
import {brlStr} from './pricing/decimal.mjs';

// Maquete que se forma enquanto a pessoa responde + estimativa. Só lê o modelo (dados reais do motor); não calcula preço.
// Primeira pintura: SVG isométrico (instantâneo, também serve sem WebGL). Depois, a cena 3D carrega por cima, sem travar o formulário.

const reduced=()=>typeof window!=='undefined'&&typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const useMedia=query=>{
 const get=()=>typeof window!=='undefined'&&typeof window.matchMedia==='function'&&window.matchMedia(query).matches;
 const [on,setOn]=useState(get);
 useEffect(()=>{if(typeof window.matchMedia!=='function')return undefined;const mq=window.matchMedia(query),f=()=>setOn(mq.matches);mq.addEventListener('change',f);return()=>mq.removeEventListener('change',f);},[query]);
 return on;
};

// O valor "anda" até o novo total em ~450 ms (setInterval, que continua em aba de fundo). O último passo é exatamente o valor do motor.
function useTween(target){
 const [shown,setShown]=useState(target);
 const from=useRef(target);
 useEffect(()=>{
  if(target===null||from.current===null||reduced()||from.current===target){from.current=target;setShown(target);return undefined;}
  const start=Number(from.current),end=Number(target),t0=Date.now();
  const id=setInterval(()=>{
   const p=Math.min(1,(Date.now()-t0)/450);
   if(p>=1){clearInterval(id);from.current=target;setShown(target);}
   else setShown((start+(end-start)*(1-Math.pow(1-p,3))).toFixed(2));
  },30);
  return ()=>clearInterval(id);
 },[target]);
 return shown;
}

// Desenho isométrico: fallback e primeira pintura.
function IsoSvg({spec,view,label}){
 const vb=isoViewBox(spec,view);
 const shapes=isoShapes(spec,view);
 return <svg className="mq-svg" viewBox={`${vb.x.toFixed(2)} ${vb.y.toFixed(2)} ${vb.w.toFixed(2)} ${vb.h.toFixed(2)}`} role="img" aria-label={label} focusable="false">
  {shapes.map((s,i)=>{
   if(s.points)return <polygon key={i} className={`mq-${s.kind}`} points={s.points}/>;
   if(s.d)return <path key={i} className={`mq-${s.kind}`} d={s.d}/>;
   if(s.cx!==undefined)return <circle key={i} className={`mq-${s.kind}`} cx={s.cx} cy={s.cy} r="0.45"/>;
   return null;
  })}
 </svg>;
}

function Stage({spec,view,setView,want3d,mobile,label,compact}){
 const stage=useRef(null),host=useRef(null),scene=useRef(null);
 const [ready,setReady]=useState(false);
 const [failed,setFailed]=useState(false);
 const specKey=JSON.stringify(spec);
 const latest=useRef({spec,view});
 latest.current={spec,view};

 // Carrega a cena só quando pedida e visível; libera a GPU quando deixa de ser pedida.
 useEffect(()=>{
  if(!want3d)return undefined;
  let dead=false,io=null;
  (async()=>{
   try{
    const m=await import('./maquete3d.mjs');
    if(dead||!m.webglAvailable()){if(!dead)setFailed(true);return;}
    const sc=await m.createMaquete(host.current,{reduced:reduced(),mobile});
    if(dead){sc.destroy();return;}
    scene.current=sc;
    sc.update(latest.current.spec,latest.current.view);
    setReady(true);
    io=new IntersectionObserver(([e])=>sc.setVisible(e.isIntersecting));
    io.observe(stage.current);
   }catch{if(!dead)setFailed(true);}
  })();
  return()=>{dead=true;io?.disconnect();scene.current?.destroy();scene.current=null;setReady(false);};
 },[want3d,mobile]);

 // Atualiza a cena quando as respostas mudam (com pequena espera: a pessoa ainda está digitando).
 useEffect(()=>{
  if(!scene.current)return undefined;
  const id=setTimeout(()=>scene.current?.update(latest.current.spec,latest.current.view),140);
  return()=>clearTimeout(id);
 },[specKey,ready]);
 useEffect(()=>{scene.current?.setView(view);},[view,ready]);

 return <div className={`mq-stage${compact?' mq-compact':''}`} ref={stage} data-3d={ready?'ready':failed?'fallback':'loading'}>
  <IsoSvg spec={spec} view={view} label={label}/>
  <div className="mq-host" ref={host} tabIndex={ready?0:-1} aria-label={ready?'Maquete 3D. Arraste ou use as setas para girar.':undefined} role={ready?'group':undefined}/>
  {!compact&&<div className="mq-tabs" role="group" aria-label="Vista da maquete">{VIEWS.map(v=><button key={v.id} type="button" className="mq-tab" aria-pressed={view===v.id} onClick={()=>setView(v.id)}>{v.label}</button>)}</div>}
 </div>;
}

function LivePlanInner({answers,expanded}){
 const m=livePlanModel(answers);
 const tween=useTween(m?m.total:null);
 const mobile=useMedia('(max-width:900px)');
 const [picked,setPicked]=useState(null);
 const spec=useMemo(()=>m?sceneSpec(m):null,[m&&JSON.stringify([m.area?.footprint,m.floorsDrawn,m.layers,m.area?.kind])]);
 if(!m)return null;
 const compact=mobile&&!expanded;
 const view=picked??(spec.layers.length?'camadas':'conjunto');
 const total=tween??m.total;
 const layerNames=[...m.layers].map(l=>LAYER_LABEL[l]);
 const label=`${describeScene(spec,LAYER_LABEL)}${m.area?` Área informada: ${m.area.value.replace('.',',')} m².`:''}`;
 return <section className={`live-plan lp-${m.mode}`} aria-label="Maquete e estimativa">
  <figure className="lp-figure">
   <Stage spec={spec} view={view} setView={setPicked} want3d={!compact} mobile={mobile} label={label} compact={compact}/>
   <figcaption>{m.floors?`${m.floors} ${m.floors===1?'pavimento':'pavimentos'}. `:''}{m.notice}</figcaption>
  </figure>
  {layerNames.length>0&&<ul className="lp-legend" aria-label="Disciplinas escolhidas">{m.layers.map(l=><li key={l} className="lp-key"><span className="lp-swatch" style={{background:LAYER_COLOR[l]}} aria-hidden="true"/>{LAYER_LABEL[l]}</li>)}</ul>}
  {m.rows.length>0&&<div className="lp-budget">
   <ul>{m.rows.map(r=><li key={r.key} className={`lp-row lp-${r.state}`}><span>{serviceName(r.service)}</span><strong>{r.state==='priced'?brlStr(r.total):r.state==='over_limit'?'Avaliação da equipe':'Aguardando dados'}</strong></li>)}</ul>
   <p className="lp-total" role="status" aria-live="polite">{m.total!==null?<>Estimativa inicial <strong>{brlStr(total)}</strong></>:m.mode==='over_limit'?'Esse porte pede avaliação da equipe, sem valor automático.':'Faltam dados para somar o valor.'}</p>
  </div>}
 </section>;
}

// Elemento de apoio: se algo no painel falhar, ele some em silêncio e a calculadora segue funcionando.
class Guard extends Component{
 constructor(p){super(p);this.state={failed:false};}
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){}
 render(){return this.state.failed?null:this.props.children;}
}
export function LivePlan({answers,expanded}){return <Guard><LivePlanInner answers={answers} expanded={expanded}/></Guard>;}

// Miniatura e resumo de uma linha para o painel recolhido no celular: a maquete em ponto pequeno e a estimativa quando o motor calculou.
function LiveChipInner({answers}){
 const m=livePlanModel(answers);
 if(!m)return null;
 const spec=sceneSpec(m);
 return <div className="lp-chip">
  <span className="lp-thumb"><IsoSvg spec={spec} view="conjunto" label=""/></span>
  {m.total!==null&&<p>Estimativa inicial <strong>{brlStr(m.total)}</strong></p>}
 </div>;
}
export function LiveChip({answers}){return <Guard><LiveChipInner answers={answers}/></Guard>;}
