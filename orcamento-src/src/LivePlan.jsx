import {Component,useEffect,useRef,useState} from 'react';
import {livePlanModel,LAYER_LABEL} from './live_plan.mjs';
import {friendlyServiceName as serviceName} from './client_summary.mjs';
import {brlStr} from './pricing/decimal.mjs';

// P05 — "Planta que se desenha" + "Orçamento em movimento". Só lê o modelo (dados reais do motor); não calcula preço.

const reduced=()=>typeof window!=='undefined'&&typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// O valor "anda" até o novo total em ~450 ms. Usa setInterval (e não rAF) para continuar andando em aba de fundo;
// com movimento reduzido, salta direto. O valor final é sempre exatamente o do motor (último passo = alvo, sem arredondar).
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

const W=320,H=190;

function Layer({id,x,y,w,h}){
 const px=f=>x+w*f,py=f=>y+h*f;
 if(id==='estrutura')return <g className="lp-layer lp-estrutura" data-layer={id}>{[0.12,0.5,0.88].flatMap(fx=>[0.15,0.5,0.85].map(fy=><rect key={`${fx}-${fy}`} x={px(fx)-3} y={py(fy)-3} width="6" height="6"/>))}<path pathLength="1" className="lp-draw" d={`M${px(0.12)} ${py(0.5)}H${px(0.88)}M${px(0.5)} ${py(0.15)}V${py(0.85)}`}/></g>;
 if(id==='hidrossanitario')return <g className="lp-layer lp-hidro" data-layer={id}><path pathLength="1" className="lp-draw" d={`M${px(0.18)} ${py(0.25)}H${px(0.55)}V${py(0.75)}H${px(0.82)}`}/><path pathLength="1" className="lp-draw lp-dash" d={`M${px(0.2)} ${py(0.4)}H${px(0.7)}V${py(0.9)}`}/></g>;
 if(id==='eletrica')return <g className="lp-layer lp-eletrica" data-layer={id}><path pathLength="1" className="lp-draw" d={`M${px(0.15)} ${py(0.6)}L${px(0.3)} ${py(0.3)}L${px(0.5)} ${py(0.6)}L${px(0.7)} ${py(0.3)}L${px(0.85)} ${py(0.6)}`}/>{[[0.15,0.6],[0.5,0.6],[0.85,0.6]].map(([fx,fy])=><circle key={fx} cx={px(fx)} cy={py(fy)} r="3.2"/>)}</g>;
 if(id==='incendio')return <g className="lp-layer lp-incendio" data-layer={id}>{[[0.2,0.2],[0.8,0.8]].map(([fx,fy])=><path key={fx} pathLength="1" className="lp-draw" d={`M${px(fx)-5} ${py(fy)-5}l10 10m0 -10l-10 10`}/>)}<circle cx={px(0.5)} cy={py(0.5)} r="5"/></g>;
 if(id==='gas')return <g className="lp-layer lp-gas" data-layer={id}><path pathLength="1" className="lp-draw lp-dot" d={`M${px(0.1)} ${py(0.92)}H${px(0.9)}`}/></g>;
 return null;
}

function Terrain({x,y,w,h}){
 return <g className="lp-layer lp-terreno" data-layer="terreno">{[0.3,0.5,0.7].map(f=><path key={f} pathLength="1" className="lp-draw" d={`M${x} ${y+h*f}Q${x+w*0.3} ${y+h*(f-0.18)} ${x+w*0.55} ${y+h*f}T${x+w} ${y+h*(f-0.05)}`}/>)}</g>;
}

function LivePlanInner({answers}){
 const m=livePlanModel(answers);
 const tween=useTween(m?m.total:null);
 if(!m)return null;
 const total=tween??m.total;
 const fp=m.area?.footprint;
 const terrain=m.area?.kind==='terrain';
 const w=fp?fp.w:150,h=fp?fp.h:100,x=(W-w)/2-14,y=(H-h)/2;
 const layerNames=m.layers.map(l=>LAYER_LABEL[l]);
 const label=`Planta ilustrativa${m.area?` de ${m.area.value.replace('.',',')} m²`:' sem área informada'}${m.floors?`, ${m.floors} ${m.floors===1?'pavimento':'pavimentos'}`:''}${layerNames.length?`. Camadas: ${layerNames.join(', ')}.`:'.'}`;
 return <section className={`live-plan lp-${m.mode}`} aria-label="Planta e orçamento em movimento">
  {m.rows.length>0&&<div className="lp-head"><h3>Orçamento em movimento</h3>
   <p className="lp-total" data-fab-evitar="" role="status" aria-live="polite">{m.total!==null?<>Estimativa inicial <strong>{brlStr(total)}</strong></>:m.mode==='over_limit'?'Sem valor automático: o porte pede avaliação da equipe.':'Sem valor ainda: faltam informações para estimar.'}</p>
  </div>}
  <figure className="lp-figure">
   <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} focusable="false">
    <rect className={`lp-footprint ${m.area?'':'lp-empty'}`} x={x} y={y} width={w} height={h} rx="2"/>
    {!m.area&&<text className="lp-hint" x={x+w/2} y={y+h/2+4} textAnchor="middle">área ainda não informada</text>}
    {m.layers.filter(l=>l!=='terreno').map(l=><Layer key={l} id={l} x={x} y={y} w={w} h={h}/>)}
    {m.layers.includes('terreno')&&<Terrain x={x} y={y} w={w} h={h}/>}
    {m.floorsDrawn!==null&&<g className="lp-section" aria-hidden="true">{Array.from({length:m.floorsDrawn},(_,i)=><rect key={i} x={W-46} y={H-24-(i+1)*15} width="32" height="12" rx="1"/>)}</g>}
   </svg>
   <figcaption>{m.floors?`${m.floors} ${m.floors===1?'pavimento':'pavimentos'}${m.floorsExtra?` (desenhados ${m.floorsDrawn})`:''} · `:''}{m.notice}</figcaption>
  </figure>
  {layerNames.length>0&&<ul className="lp-legend" aria-label="Camadas">{m.layers.map(l=><li key={l} className={`lp-key lp-key-${l}`}><span className="lp-swatch" aria-hidden="true"/>{LAYER_LABEL[l]}</li>)}</ul>}
  {m.rows.length>0&&<div className="lp-budget">
   <ul>{m.rows.map(r=><li key={r.key} data-fab-evitar="" className={`lp-row lp-${r.state}`}><span>{serviceName(r.service)}</span><strong>{r.state==='priced'?brlStr(r.total):r.state==='over_limit'?'Avaliação da equipe':'A confirmar'}</strong></li>)}</ul>
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
export function LivePlan({answers}){return <Guard><LivePlanInner answers={answers}/></Guard>;}

// Resumo de uma linha para o painel recolhido no celular: só aparece quando o motor calculou o conjunto.
function LiveChipInner({answers}){
 const m=livePlanModel(answers);
 if(!m||m.total===null)return null;
 return <p className="lp-chip">Estimativa inicial <strong>{brlStr(m.total)}</strong></p>;
}
export function LiveChip({answers}){return <Guard><LiveChipInner answers={answers}/></Guard>;}
