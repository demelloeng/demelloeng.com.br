import {useEffect,useId,useRef,useState} from 'react';
import {ufs} from './flow.mjs';
import {loadCatalog,getIndex,search} from './municipios.mjs';
import {contactCheck,parsePhone} from './phone.mjs';

// Catálogo oficial do IBGE, do próprio site (gerado por scripts/gerar-municipios-ibge.py). Não há chamada a API externa.
const CATALOG_URL=`${import.meta.env.BASE_URL}assets/municipios-ibge.v1.json`;

// Localização (P02): UF primeiro, depois o município numa lista da própria UF. A resposta só existe quando o visitante
// escolhe um item da lista: digitar um nome que não está na lista deixa a pergunta sem resposta.
export function LocationPicker({value,onChange}){
 const uf=value?.uf??'',city=value?.city??'',chosen=!!value?.ibge_id;
 const [catalog,setCatalog]=useState(getIndex()?'ready':'loading');
 const [query,setQuery]=useState(city);
 const [open,setOpen]=useState(false);
 const [active,setActive]=useState(0);
 const uid=useId(),listId=`${uid}-list`,statusId=`${uid}-status`;
 const input=useRef(null);
 const load=()=>{setCatalog('loading');loadCatalog(CATALOG_URL).then(()=>setCatalog('ready')).catch(()=>setCatalog('error'));};
 useEffect(()=>{if(!getIndex())load();},[]);
 const results=catalog==='ready'&&uf?search(getIndex(),uf,query):[];
 const shown=open&&results.length>0;
 const pick=item=>{onChange({uf,city:item.nome,ibge_id:item.id});setQuery(item.nome);setOpen(false);};
 const onUf=e=>{onChange({uf:e.target.value,city:'',ibge_id:''});setQuery('');setOpen(false);setActive(0);};
 const onText=e=>{const text=e.target.value;setQuery(text);setOpen(true);setActive(0);if(chosen||city)onChange({uf,city:'',ibge_id:''});};
 const onKey=e=>{
  if(e.key==='ArrowDown'){e.preventDefault();if(!shown){setOpen(true);return;}setActive(i=>Math.min(i+1,results.length-1));}
  else if(e.key==='ArrowUp'){e.preventDefault();setActive(i=>Math.max(i-1,0));}
  else if(e.key==='Enter'){if(shown&&results[active]){e.preventDefault();pick(results[active]);}}
  else if(e.key==='Escape'){if(open){e.preventDefault();setOpen(false);}}
 };
 const status=catalog!=='ready'?'':!uf?'':chosen?`Município selecionado: ${city}/${uf}.`:query.trim()?(results.length?`${results.length} ${results.length===1?'município encontrado':'municípios encontrados'} em ${uf}.`:`Nenhum município de ${uf} com esse nome. Confira a grafia.`):'';
 return <div className="location-fields picker">
  <label>UF<select autoComplete="address-level1" value={uf} onChange={onUf}><option value="">Selecione</option>{ufs.map(u=><option key={u}>{u}</option>)}</select></label>
  <div className="combo">
   <label htmlFor={`${uid}-city`}>Município</label>
   <input ref={input} id={`${uid}-city`} role="combobox" aria-expanded={shown} aria-controls={listId} aria-autocomplete="list" aria-describedby={statusId} aria-activedescendant={shown?`${uid}-o${active}`:undefined} autoComplete="off" maxLength={90} disabled={!uf||catalog!=='ready'} placeholder={!uf?'Escolha a UF primeiro':catalog==='loading'?'Carregando a lista…':'Digite para buscar'} value={query} onChange={onText} onKeyDown={onKey} onFocus={()=>{if(uf&&!chosen)setOpen(true);}} onBlur={()=>setOpen(false)}/>
   {shown&&<ul id={listId} role="listbox" aria-label={`Municípios de ${uf}`} className="combo-list">{results.map((r,i)=><li key={r.id} id={`${uid}-o${i}`} role="option" aria-selected={i===active} className={i===active?'active':''} onMouseDown={e=>e.preventDefault()} onClick={()=>pick(r)}>{r.nome}{r.apelido&&<small> · {r.apelido}</small>}</li>)}</ul>}
  </div>
  <p id={statusId} className="field-hint" aria-live="polite">{status}</p>
  {uf==='DF'&&<p className="field-hint">No Distrito Federal o município é Brasília. Taguatinga, Ceilândia e as demais são regiões administrativas: ao digitar o nome, a lista leva a Brasília.</p>}
  {catalog==='error'&&<div role="alert" className="field-error">Não foi possível carregar a lista de municípios. <button type="button" className="text-button" onClick={load}>Tentar de novo</button> · Ou <a href="/contato/">fale direto com a DEMELLO</a>.</div>}
 </div>;
}

// Contato (P02): nome + WhatsApp e/ou e-mail. Mostra o erro do campo depois que o visitante sai dele, e o número já
// normalizado para ele conferir. A tela não declara nada sobre a existência de conta: só o formato é conferido.
export function ContactFields({value,onChange}){
 const c=value??{};
 const [touched,setTouched]=useState({});
 const check=contactCheck(c);
 const touch=f=>setTouched(t=>({...t,[f]:true}));
 const field=(name,label,type,extra={})=>{
  const err=touched[name]&&check.errors[name];
  const eid=`contact-${name}-error`;
  return <label key={name}>{label}<input type={type} aria-invalid={!!err} aria-describedby={err?eid:undefined} value={c[name]??''} onChange={e=>onChange({...c,[name]:e.target.value})} onBlur={()=>touch(name)} {...extra}/>{err&&<span id={eid} className="field-error" role="alert">{err}</span>}</label>;
 };
 const phone=c.whatsapp&&parsePhone(c.whatsapp);
 return <div className="contact-fields">
  {field('name','Nome','text',{autoComplete:'name',maxLength:160})}
  {field('whatsapp','WhatsApp','tel',{autoComplete:'tel',inputMode:'tel',maxLength:24,placeholder:'(41) 98765-4321'})}
  {phone&&phone.ok&&<p className="field-hint ok" role="status">Vamos usar {phone.display}. Se estiver errado, corrija antes de enviar.</p>}
  {field('email','E-mail','email',{autoComplete:'email',inputMode:'email',maxLength:160})}
 </div>;
}
