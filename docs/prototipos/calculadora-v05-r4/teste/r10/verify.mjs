import {createMaqueteV5 as beforeCreate} from '/before/maquete5_scene.mjs';
import {createMaqueteV5 as afterCreate} from '/after/maquete5_scene.mjs';
import {buildingSpec} from '/before/maquete5_building.mjs';
import * as THREE from '/assets/vendor/three/build/three.module.js';
const q=new URLSearchParams(location.search),mobile=q.has('mobile'),extras=q.has('extras');
const realRandom=Math.random;const seed=()=>{let s=15973;Math.random=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};};
async function create(factory,id){seed();try{return await factory(document.querySelector(id),{mobile,ao:!mobile});}finally{Math.random=realRandom;}}
const a=await create(beforeCreate,'#before'),b=await create(afterCreate,'#after');
const all=['ARQUITETURA','ESTRUTURAL','HIDROSSANITARIO','ELETRICA','INCENDIO','GAS_GLP'];
const cases=[['Casa60',60,1,'CASA',false],['Sobrado320',320,2,'CASA',false],['Sobrado320Terreno',320,2,'CASA',true],['Edificio9600',9600,8,'PREDIO',false],['Edificio9600Terreno',9600,8,'PREDIO',true]];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function settled(){const start=Date.now();while((a.busy()||b.busy())&&Date.now()-start<20000)await wait(100);}
function read(api){const gl=api.debug.renderer.getContext(),size=api.debug.renderer.getDrawingBufferSize(new THREE.Vector2()),p=new Uint8Array(size.x*size.y*4);gl.readPixels(0,0,size.x,size.y,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;}
const results=[];
function measure(name,view,required){
 a.render();const before=a.stats();
 // Exact image comparison uses the same GPU context and the same AO noise textures.
 // The original per-bucket shadow path remains in the component and is restored only for this capture.
 const st=b.debug.state,batch=st.shadowBatch;
 if(batch){for(const bucket of batch.buckets)bucket.shadowBatched=false;batch.mesh.castShadow=false;st.shadowBatch=null;}
 b.render();const p0=read(b),unbatched=b.stats(),beforeImage=b.canvas.toDataURL();
 if(batch){for(const bucket of batch.buckets){bucket.shadowCaster=bucket.mesh.castShadow;bucket.shadowBatched=true;bucket.mesh.castShadow=false;}batch.mesh.castShadow=true;st.shadowBatch=batch;}
 b.render();const p1=read(b),after=b.stats(),afterImage=b.canvas.toDataURL();
 let changed=0,maxDelta=0;for(let i=0;i<p0.length;i++){const d=Math.abs(p0[i]-p1[i]);if(d)changed++;maxDelta=Math.max(maxDelta,d);}
 const row={name,view,mobile,required,before,unbatched,after,changedChannels:changed,maxDelta,totalChannels:p0.length,pixelEqual:changed===0,budget:after.calls<=60&&after.triangles<=150000,shadowInstances:batch?.count??0,proxyCountOutsideShadow:batch?.mesh.count??0};
 row.ok=row.pixelEqual&&(!required||row.budget)&&row.proxyCountOutsideShadow===0&&unbatched.calls===before.calls&&unbatched.triangles===before.triangles;
 results.push(row);const tr=document.createElement('tr');tr.innerHTML=`<td>${name}</td><td>${view}</td><td>${before.calls} → ${after.calls}</td><td>${before.triangles} → ${after.triangles}</td><td>${changed} / Δ${maxDelta}</td><td>${row.ok?'PASSA':'FALHA'}</td>`;document.querySelector('tbody').append(tr);document.querySelector('#json').textContent=JSON.stringify(results,null,2);
 if(name==='Sobrado320'||name==='Edificio9600Terreno'){const block=document.createElement('div');block.innerHTML=`<h2>${name} ${view}</h2><div class="capture"></div>`;for(const url of[beforeImage,afterImage]){const img=new Image();img.src=url;block.querySelector('.capture').append(img);}document.querySelector('#captures').append(block);}
 return row;
}
if(!q.has('interactions'))for(const [name,areaTotal,floors,typology,ground] of cases){
 for(const view of extras?['disciplinas','pavimentos']:['conjunto','corte','planta']){
  document.querySelector('#state').textContent=`Medindo ${name} ${view} (${mobile?'móvel':'AO ligado'})…`;
  const spec=buildingSpec({areaTotal,areaProj:areaTotal/floors,floors,typology,standard:'Alto',services:ground?[...all,'TERRAPLENAGEM']:all,areaTerreno:ground?areaTotal:undefined});a.update(spec,view);b.update(spec,view);await settled();measure(name,view,!extras);
 }
}
if(q.has('interactions')){
 const spec=services=>buildingSpec({areaTotal:320,areaProj:160,floors:2,typology:'CASA',standard:'Alto',services});
 a.update(spec(all),'conjunto');b.update(spec(all),'conjunto');await settled();
 for(const layer of['estrutura','hidrossanitario','eletrica','incendio','gas',null]){a.setIsolate(layer);b.setIsolate(layer);await settled();measure('Isolar '+(layer??'todas'),'conjunto',false);}
 a.setView('corte');b.setView('corte');await settled();
 for(const cut of[0.1,0.5,0.9]){a.setCut(cut);b.setCut(cut);await settled();measure('Corte '+cut,'corte',false);}
 a.setView('planta');b.setView('planta');await settled();
 for(const floor of[0,1]){a.setPlanFloor(floor);b.setPlanFloor(floor);await settled();measure('Pavimento '+floor,'planta',false);}
 a.setView('conjunto');b.setView('conjunto');await settled();
 for(const fraction of[0.15,0.5,1]){a.scrub(fraction);b.scrub(fraction);measure('Montagem '+fraction,'conjunto',false);}
 for(const services of[all.slice(0,4),all]){a.update(spec(services),'conjunto');b.update(spec(services),'conjunto');await settled();measure('Disciplinas '+services.length,'conjunto',false);}
 for(const zoom of[1.2,0.8]){a.zoomBy(zoom);b.zoomBy(zoom);await settled();measure('Zoom '+zoom,'conjunto',false);}
}
document.querySelector('#state').textContent=`Concluído: ${results.filter(r=>r.ok).length}/${results.length} PASSAM; ${results.filter(r=>!r.ok).length} falhas`;
document.querySelector('#json').textContent=JSON.stringify(results,null,2);
