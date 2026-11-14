import {useEffect,useMemo,useRef,useState} from 'react';
import {LAYER_LABEL,generate,circulationNote} from './maquete5_building.mjs';

// Palco da maquete V05 dentro da calculadora. A cena (Three.js) entra por import() dinâmico: o formulário nunca espera por ela.
// Se a cena não carregar ou não houver WebGL, chama onFail e a calculadora volta para a maquete anterior.
// As listas abaixo repetem as da cena de propósito: assim este componente não puxa o módulo pesado para a primeira tela.
// R06: vistas principais (exterior, por dentro e planta) em destaque; Disciplinas e Pavimentos seguem a um toque, discretas.
const VIEWS=[{id:'conjunto',label:'Conjunto'},{id:'corte',label:'Corte'},{id:'planta',label:'Planta'},{id:'disciplinas',label:'Disciplinas',sec:true},{id:'pavimentos',label:'Pavimentos',sec:true}];
const INSIDE=['corte','planta'];
const LAYER_COLOR={arquitetura:'#f4f2ee',estrutura:'#9aa7b4',hidrossanitario:'#35a8e8',eletrica:'#f2b134',incendio:'#e5484a',gas:'#a78bfa',terreno:'#59c08a'};

export function Stage5({spec,mobile,reduced,label,onFail,facts}){
 const stage=useRef(null),host=useRef(null),api=useRef(null);
 const scaleBox=useRef(null),scaleBar=useRef(null),scaleTxt=useRef(null),levels=useRef(null),scrub=useRef(null),stageName=useRef(null);
 const [ready,setReady]=useState(false);
 const [view,setView]=useState('conjunto');
 // R11: ampliação voluntária do palco no MESMO nó (classe CSS): mesma cena, mesmo estado, nenhum segundo canvas.
 const [full,setFull]=useState(false);
 const back=useRef(null);
 const openFull=()=>{back.current={y:window.scrollY};setFull(true);};
 // o botão Ampliar é renderizado de novo ao fechar: o foco volta para ele (não para o nó antigo) e a rolagem é restaurada
 const closeFull=()=>{setFull(false);const b=back.current;back.current=null;requestAnimationFrame(()=>{if(b)window.scrollTo(0,b.y);stage.current?.querySelector('[aria-label="Ampliar maquete"]')?.focus();});};
 useEffect(()=>{
  if(!full)return undefined;
  const onKey=e=>{if(e.key==='Escape'){e.preventDefault();closeFull();}};
  document.addEventListener('keydown',onKey);document.documentElement.classList.add('v5-full-open');
  stage.current?.querySelector('.v5-close')?.focus();
  return()=>{document.removeEventListener('keydown',onKey);document.documentElement.classList.remove('v5-full-open');};
 },[full]);
 // R04: o vão da escada vem do mesmo gerador da cena (nada de regra paralela); a indicação depende da vista.
 const stairDims=useMemo(()=>{try{return generate(spec).dims;}catch{return null;}},[JSON.stringify(spec)]);
 const circ=circulationNote(spec,stairDims,view);
 const [isolate,setIsolate]=useState(null);
 const [floor,setFloor]=useState(0);
 const [pick,setPick]=useState(null);
 const [layers,setLayers]=useState([]);
 const latest=useRef({spec,view});
 latest.current={spec,view};
 const specKey=JSON.stringify(spec);

 // Chamado pela cena a cada quadro desenhado: atualiza escala, níveis e etapa direto no DOM (sem renderizar o React por quadro).
 const onFrame=useRef(a=>{
  const {spec:sp,view:v}=latest.current;
  const show=!!sp?.hasArea&&v!=='pavimentos';
  if(scaleBox.current){
   scaleBox.current.hidden=!show;
   if(show){const s=a.scale();scaleBar.current.style.width=`${s.px.toFixed(0)}px`;scaleTxt.current.textContent=`${String(s.meters).replace('.',',')} m`;}
  }
  // O rótulo de nível fica à esquerda do ponto: no painel estreito ele não pode sair do palco (por isso o Math.max).
  const box=levels.current;
  if(box){
   const lv=a.levels();
   while(box.children.length<lv.length)box.append(document.createElement('span'));
   [...box.children].forEach((el,i)=>{const l=lv[i];el.hidden=!l;if(l){el.textContent=l.label;el.style.left=`${Math.max(l.x,el.offsetWidth+6).toFixed(1)}px`;el.style.top=`${l.y.toFixed(1)}px`;}});
  }
  const p=a.progress();
  if(scrub.current&&document.activeElement!==scrub.current)scrub.current.value=String(Math.round(p*1000));
  if(stageName.current){const st=a.stages().filter(x=>x.frac<=p+1e-6).pop();stageName.current.textContent=p>=0.999?'Pronta':(st?.label??'');}
 });

 useEffect(()=>{
  let dead=false,io=null;
  (async()=>{
   try{
    const m=await import('./maquete5_scene.mjs');
    if(dead)return;
    if(!m.webglAvailable()){onFail();return;}
    const sc=await m.createMaqueteV5(host.current,{reduced,mobile,ao:!mobile,onPick:p=>setPick(p),onFrame:a=>onFrame.current(a)});
    if(dead){sc.destroy();return;}
    api.current=sc;
    sc.update(latest.current.spec,latest.current.view);
    setLayers(sc.layers().filter(l=>l!=='volume'));
    setReady(true);
    io=new IntersectionObserver(([e])=>sc.setVisible(e.isIntersecting));
    io.observe(stage.current);
   }catch{if(!dead)onFail();}
  })();
  return()=>{dead=true;io?.disconnect();api.current?.destroy();api.current=null;setReady(false);};
 },[mobile]);

 // Respostas mudaram: atualiza a cena com pequena espera (a pessoa ainda pode estar digitando).
 useEffect(()=>{
  if(!api.current)return undefined;
  const id=setTimeout(()=>{
   const sc=api.current;if(!sc)return;
   sc.update(latest.current.spec,latest.current.view);
   const ls=sc.layers().filter(l=>l!=='volume');
   setLayers(ls);
   setIsolate(cur=>{if(cur&&!ls.includes(cur)){sc.setIsolate(null);return null;}return cur;});
   setFloor(cur=>{if(cur>=latest.current.spec.floors){sc.setPlanFloor(0);return 0;}return cur;});
  },140);
  return()=>clearTimeout(id);
 },[specKey,ready]);
 useEffect(()=>{api.current?.setView(view);},[view,ready]);

 const pickIsolate=id=>{setIsolate(id);api.current?.setIsolate(id);};
 const pickFloor=i=>{setFloor(i);api.current?.setPlanFloor(i);};

 return <>
  <div className={`mq-stage mq-v5${full?' is-full':''}`} ref={stage} data-3d={ready?'ready':'loading'} role={full?'dialog':undefined} aria-modal={full?'true':undefined} aria-label={full?'Maquete ampliada':undefined}>
   <div className="mq-host" ref={host} tabIndex={ready?0:-1} role={ready?'group':undefined} aria-label={ready?`${label} Arraste para girar; toque em uma peça para ver o nome.`:undefined}/>
   {!ready&&<p className="v5-loading" role="status">Carregando a maquete…</p>}
   <div className="v5-topleft">
    {(facts?.area||facts?.floors)&&<p className="v5-facts">{[facts.area,facts.floors].filter(Boolean).map(t=><span key={t}>{t}</span>)}</p>}
    <div className="v5-scale" ref={scaleBox} hidden><span ref={scaleBar}/><b ref={scaleTxt}/></div>
   </div>
   {full&&<button type="button" className="v5-close" onClick={closeFull}>Fechar ✕</button>}
   <div className="v5-zoom">{!full&&<button type="button" aria-label="Ampliar maquete" title="Ampliar maquete" onClick={openFull}>⤢</button>}<button type="button" aria-label="Aproximar" onClick={()=>api.current?.zoomBy(0.87)}>+</button><button type="button" aria-label="Afastar" onClick={()=>api.current?.zoomBy(1.15)}>−</button></div>
   <div className="v5-levels" ref={levels} aria-hidden="true"/>
   {pick&&<div className="v5-pick" role="status" aria-live="polite"><b>{pick.name} <i>· {pick.layerLabel}</i></b>{pick.note}</div>}
   <div className="v5-bottom">
    <div className="v5-tool">
     {view==='disciplinas'&&layers.length>0&&<>
      <button type="button" className="v5-chip" aria-pressed={isolate===null} onClick={()=>pickIsolate(null)}>Todas</button>
      {layers.map(l=><button key={l} type="button" className="v5-chip" aria-pressed={isolate===l} onClick={()=>pickIsolate(l)}><i style={{background:LAYER_COLOR[l]}}/>{LAYER_LABEL[l]}</button>)}
     </>}
     {view==='corte'&&<label>Posição do corte <input type="range" min="5" max="95" defaultValue="36" aria-label="Posição do corte" onInput={e=>api.current?.setCut(Number(e.target.value)/100)}/></label>}
     {view==='planta'&&spec.floors>1&&Array.from({length:spec.floors},(_,i)=><button key={i} type="button" className="v5-chip" aria-pressed={floor===i} onClick={()=>pickFloor(i)}>{i===0?'Térreo':`${i+1}º pav.`}</button>)}
    </div>
    <div className="v5-row">
     {/* R06: atalho principal — Ver por dentro (Corte) / Voltar ao exterior (Conjunto) */}
     <button type="button" className="v5-inside" onClick={()=>setView(INSIDE.includes(view)?'conjunto':'corte')}>{INSIDE.includes(view)?'Voltar ao exterior':'Ver por dentro'}</button>
     <div className="mq-tabs" role="group" aria-label="Vista da maquete">{VIEWS.map(v=><button key={v.id} type="button" className={`mq-tab${v.sec?' mq-tab-sec':''}`} aria-pressed={view===v.id} onClick={()=>setView(v.id)}>{v.label}</button>)}</div>
    </div>
   </div>
  </div>
  {/* R04/R06: a indicação de circulação fica fora do palco, para não cobrir o modelo */}
  {circ&&<p className="v5-note" role="note">{circ}</p>}
  <div className="v5-build">
   <button type="button" onClick={()=>api.current?.replay()}>Montar de novo</button>
   <input type="range" min="0" max="1000" defaultValue="1000" ref={scrub} aria-label="Etapa da montagem" onInput={e=>api.current?.scrub(Number(e.target.value)/1000)}/>
   <span ref={stageName}/>
  </div>
 </>;
}
