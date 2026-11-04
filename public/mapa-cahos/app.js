/* MAPA CAHOS · standalone territorial viewer.
   Geographic boundaries from public INEGI GeoJSON.
   Epidemiological records only from authenticated Supabase Edge API.
   No nominal data, patient addresses or access tokens are exported. */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const NS="http://www.w3.org/2000/svg";
const SEP=new Intl.NumberFormat("es-MX");
const fmt=n=>Number.isFinite(Number(n))?SEP.format(Number(n)):"—";
const bands=["00_04","05_09","10_14","15_19","20_24","25_29","30_34","35_39","40_44","45_49","50_54","55_59","60_64","65_mm"];
const shared=window.CAHOSSelection?.read()||{};
const state={features:[],catalog:{},member:{},year:2026,population:[],municipal:new Map(),
 selected:null,grandTotal:null,caseQuality:null,provisional:false,jobStatus:null,queryBusy:false,
 loading:false,source:null,featureMap:new Map(),viewBox:{x:0,y:0,w:900,h:620},lastDetailRequest:0};
const inform=(text,cls="")=>{$("status").className="notice "+cls;$("status").textContent=text};
const api=async(path,method="GET",body=null)=>(await window.CAHOSAuth.api(path,{method,...(body?{body}: {})})).body;
const label=(dim,id)=>state.catalog[dim]?.find(x=>x.id===id)?.nombre||"";
const yrNumber=id=>Number((label("years",id).match(/(?:19|20)\d{2}/)||[])[0]);
const mk=(tag,attrs={},text)=>{
 const el=document.createElementNS(NS,tag);
 for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));
 if(text!==undefined)el.textContent=String(text);return el;
};
function save(){
 window.CAHOSSelection?.update({
 pathology:$("pathology").value,year:$("year").value,entity:state.member.entity||"",
 sex:$("sex").value,age:$("age").value,
 pathology_search:$("search").value,pop_municipality:state.selected||"",
 pop_year:String(state.year)
 });
}
function selectOption(id,val){
 const sel=$(id);
 if(val&&[...sel.options].some(opt=>opt.value===val)){sel.value=val;return true}
 return false;
}
function options(id,members,empty){
 const sel=$(id),prior=sel.value;sel.replaceChildren();
 if(empty)sel.append(new Option(empty,""));
 for(const m of members)sel.append(new Option(m.nombre,m.id));
 if(prior)selectOption(id,prior);
}
function searchPathology(){
 const term=$("search").value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 const all=state.catalog.pathologies||[],previous=$("pathology").value;
 const selected=all.some(x=>x.id===previous)?previous:shared.pathology||"";
 const clean=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 let result=all.filter(m=>clean(m.nombre).includes(term)).slice(0,80);
 if(selected&&!result.some(x=>x.id===selected)){
  const match=all.find(x=>x.id===selected);if(match)result.unshift(match);
 }
 options("pathology",result,"Seleccionar patología");selectOption("pathology",selected);
 save();
}
function codeFrom(raw){
 const s=String(raw||"");
 const c=s.match(/(?:^|\D)(26\d{3})(?!\d)/);
 if(c)return c[1];
 const three=s.match(/&\[(\d{3})(?:\s|\])/)||s.match(/^(\d{3})(?:\s|\b)/);
 return three?"26"+three[1]:"";
}
function norm(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
 .replace(/^(?:\d{3}\s+)?/,"").replace(/\b(de|municipio|sonora)\b/g,"").replace(/\s+/g," ").trim()}
function matchMunicipios(rows){
 const result=new Map(),byName=new Map();
 for(const x of state.features){
  const name=norm(x.properties?.nombre),code=String(x.properties?.cvegeo);
  if(!byName.has(name))byName.set(name,[]);byName.get(name).push(code);
 }
 let grand=null,unmatched=0,duplicate=0;
 for(const r of rows){
  const cases=Number(r.cases);
  if(!Number.isSafeInteger(cases)||cases<0){return {ok:false,reason:"Valores municipales inválidos"}}
  if(!String(r.municipalities||"").trim()&&!String(r.municipalities_id||"").trim()){
   if(grand!==null)return {ok:false,reason:"Se recibieron varias filas de total estatal"};
   grand=cases;continue;
  }
  let code=codeFrom(r.municipalities_id)||codeFrom(r.municipalities);
  if(!state.featureMap.has(code)){
   const label=String(r.municipalities||"").replace(/^\d{3}\s*/,"").trim();
   const choices=byName.get(norm(label))||[];
   code=choices.length===1?choices[0]:"";
  }
  if(!code||!state.featureMap.has(code)){unmatched++;continue}
  if(result.has(code)){duplicate++;continue}
  result.set(code,cases);
 }
 if(result.size===0||unmatched||duplicate||grand===null)return {
  ok:false,reason:"Filas municipales no conciliadas (enlazadas "+result.size+
   ", sin clave "+unmatched+", duplicadas "+duplicate+", total estatal "+(grand===null?"ausente":"presente")+")"};
 const total=[...result.values()].reduce((a,b)=>a+b,0);
 if(total!==grand)return {ok:false,reason:"Suma municipal "+fmt(total)+" ≠ total estatal "+fmt(grand)};
 return {ok:true,values:result,total,municipalities:result.size};
}
function populationFor(code){
 return state.population.find(x=>x.municipality_code===code)||null;
}
function rateDenominator(code){
 const record=populationFor(code);if(!record)return null;
 const sexId=$("sex").value,ageId=$("age").value;
 const sex=label("sex",sexId).toLowerCase();
 const activeSex=sexId?
  /mujer|fem/.test(sex)?["female"]:/hombre|masc/.test(sex)?["male"]:null
  :["female","male"];
 if(!activeSex)return null;
 const age=label("age",ageId).toLowerCase();
 let key=null;
 if(ageId){
  const match=age.match(/(\d{1,2})\s*(?:a|al|hasta|-)\s*(\d{1,2})/);
  if(match&&Number(match[2])-Number(match[1])===4&&Number(match[1])%5===0){
   key=String(match[1]).padStart(2,"0")+"_"+String(match[2]).padStart(2,"0");
  }else if(/65\s*(?:y|o)\s*m[aá]s|65\+/.test(age))key="65_mm";
  else return null;
 }
 let total=0;
 for(const gender of activeSex){
  const vals=record[gender];if(!vals)return null;
  if(key){if(!Object.hasOwn(vals,key))return null;total+=Number(vals[key]||0)}
  else total+=Object.values(vals).reduce((a,b)=>a+Number(b||0),0);
 }
 return total>0?total:null;
}
function metricValue(code,metric){
 if(metric==="population")return populationFor(code)?.population_total??null;
 const cases=state.municipal.get(code);
 if(cases===undefined)return null;
 if(metric==="cases")return cases;
 const denom=rateDenominator(code);
 return denom?cases/denom*100000:null;
}
function fill(value,max){
 if(value===null||!Number.isFinite(value))return "#dce8e4";
 const t=Math.sqrt(Math.max(0,Math.min(1,value/Math.max(1,max))));
 const a=[204,237,224],b=[13,104,83];
 return "rgb("+a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(",")+")";
}
function rings(geometry){
 if(geometry?.type==="Polygon")return geometry.coordinates;
 if(geometry?.type==="MultiPolygon")return geometry.coordinates.flat();
 return [];
}
function blank(svg,text){
 svg.replaceChildren();svg.append(mk("text",{x:svg.id==="map"?450:160,y:svg.id==="map"?300:90,
  "text-anchor":"middle",fill:"#708b80","font-size":"13"},text));
}
function drawMap(){
 const svg=$("map");svg.replaceChildren();
 if(!state.features.length){blank(svg,"Cartografía no disponible");return}
 const points=[];
 for(const f of state.features)for(const ring of rings(f.geometry))for(const p of ring)
  if(Number.isFinite(p[0])&&Number.isFinite(p[1]))points.push(p);
 if(points.length===0){blank(svg,"Geometrías inválidas");return}
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const p of points){
  const x=p[0]*.87,y=p[1];
  minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
 }
 const scale=Math.min(840/(maxX-minX),565/(maxY-minY));
 const xy=p=>[(p[0]*.87-minX)*scale+30,(maxY-p[1])*scale+29];
 const metric=$("metric").value,values=state.features.map(f=>metricValue(f.properties.cvegeo,metric));
 const max=Math.max(1,...values.filter(v=>v!==null&&Number.isFinite(v)));
 state.features.forEach((feature,i)=>{
  let d="";
  for(const ring of rings(feature.geometry)){
   const stride=Math.max(1,Math.floor(ring.length/550));
   const sampled=ring.filter((_,j)=>j%stride===0);
   if(sampled.length<3)continue;
   d+=sampled.map((p,j)=>{const q=xy(p);return(j?"L":"M")+q[0].toFixed(2)+","+q[1].toFixed(2)}).join(" ")+"Z";
  }
  const code=String(feature.properties.cvegeo),value=values[i];
  const path=mk("path",{d,fill:fill(value,max),stroke:state.selected===code?"#f3b850":"#fff",
   "stroke-width":state.selected===code?3:0.85,tabindex:0,role:"button",
   "aria-label":feature.properties.nombre+" · "+(value===null?"sin dato":fmt(value))});
  path.append(mk("title",{},feature.properties.nombre+" · "+
   (value===null?"Sin información asociable":
    metric==="rate"?value.toFixed(2)+" por 100,000":fmt(value))));
  const choose=()=>{state.selected=code;save();drawMap();showDetail(code)};
  path.addEventListener("click",choose);
  path.addEventListener("keydown",event=>{
   if(event.key==="Enter"||event.key===" "){event.preventDefault();choose()}
  });
  svg.append(path);
 });
 svg.setAttribute("viewBox",Object.values(state.viewBox).join(" "));
 const n=state.municipal.size;
 $("mapFoot").textContent="INEGI · 72 municipios · "+(metric==="population"?"Capa demográfica COESPO/CONAPO":
  n>0?n+" municipios conciliados con total estatal del cubo (consulta protegida).":
  "Datos epidemiológicos restringidos o no disponibles · gris ≠ cero casos.")+
  " · "+state.year+" · El mapa no acredita el corte oficial.";
}
function pyramid(record){
 const svg=$("pyramid");svg.replaceChildren();
 if(!record){blank(svg,"Selecciona municipio");return}
 const cols=["male","female"],vals=cols.map(k=>bands.map(b=>Number(record[k]?.[b]||0)));
 const max=Math.max(1,...vals.flat()),center=160;
 const cap=s=>s==="65_mm"?"65+":s.replace("_","-");
 bands.forEach((b,i)=>{
  const y=14+i*27,wM=112*vals[0][i]/max,wF=112*vals[1][i]/max;
  const lm=mk("rect",{x:center-21-wM,y,width:wM,height:20,rx:2,fill:"#558db8"});
  lm.append(mk("title",{},cap(b)+": "+fmt(vals[0][i])+" hombres"));svg.append(lm);
  const lf=mk("rect",{x:center+21,y,width:wF,height:20,rx:2,fill:"#1b9b87"});
  lf.append(mk("title",{},cap(b)+": "+fmt(vals[1][i])+" mujeres"));svg.append(lf);
  svg.append(mk("text",{x:center,y:y+14,"font-size":9,"text-anchor":"middle",fill:"#264f44"},cap(b)));
 });
 svg.append(mk("text",{x:77,y:398,"font-size":11,fill:"#558db8","text-anchor":"middle"},"Hombres"));
 svg.append(mk("text",{x:241,y:398,"font-size":11,fill:"#1b9b87","text-anchor":"middle"},"Mujeres"));
}
async function trend(code,requestId){
 const svg=$("trend");blank(svg,"Cargando tendencia…");
 try{
  const res=await api("/api/population/trend?municipality="+encodeURIComponent(code));
  if(requestId!==state.lastDetailRequest)return;
  const rows=(res.rows||[]).sort((a,b)=>a.year-b.year);
  if(rows.length<2){blank(svg,"Tendencia no disponible");return}
  svg.replaceChildren();
  const max=Math.max(...rows.map(x=>Number(x.population_total))),min=Math.min(...rows.map(x=>Number(x.population_total)));
  const base=Math.max(0,min-(max-min)*.2),top=max+(max-min)*.2,w=270,h=92;
  const pts=rows.map((x,i)=>{
   const px=30+i*(w/(rows.length-1)),py=14+h-(Number(x.population_total)-base)/(top-base||1)*h;
   return [px,py];
  });
  for(let i=0;i<3;i++)svg.append(mk("line",{x1:28,y1:15+i*45,x2:302,y2:15+i*45,stroke:"#e1ece6"}));
  svg.append(mk("polyline",{points:pts.map(p=>p.join(",")).join(" "),fill:"none",stroke:"#137c68","stroke-width":3}));
  rows.forEach((row,i)=>{
   const circle=mk("circle",{cx:pts[i][0],cy:pts[i][1],r:2.6,fill:"#137c68"});
   circle.append(mk("title",{},row.year+": "+fmt(row.population_total)));svg.append(circle);
  });
  svg.append(mk("text",{x:28,y:135,fill:"#738c81","font-size":11},"2015"));
  svg.append(mk("text",{x:302,y:135,fill:"#738c81","font-size":11,"text-anchor":"end"},"2030"));
 }catch{if(requestId===state.lastDetailRequest)blank(svg,"Sin tendencia disponible")}
}
function showDetail(code){
 const record=populationFor(code),feature=state.featureMap.get(code);
 const cases=state.municipal.get(code),denom=rateDenominator(code);
 const rate=cases!==undefined&&denom?cases/denom*100000:null;
 $("name").textContent=feature?.properties?.nombre||record?.municipality_name||"Sonora";
 $("note").textContent=state.provisional?"Vista preliminar privada · sin corte oficial certificado":
   "Datos territoriales según permisos del usuario y disponibilidad de extracciones.";
 $("cases").textContent=cases===undefined?"—":fmt(cases);
 $("rate").textContent=rate===null?"—":rate.toLocaleString("es-MX",{maximumFractionDigits:2});
 $("population").textContent=record?fmt(record.population_total):"—";
 $("share").textContent=cases===undefined||!state.grandTotal?"—":
  (cases/state.grandTotal*100).toFixed(2)+" %";
 pyramid(record);
 const token=++state.lastDetailRequest;trend(code,token);
 $("context").textContent="Municipio "+$("name").textContent+" · Población proyectada "+state.year+
  ". "+(rate===null?"No se calcula tasa con filtros/denominadores incompatibles. ":
  "La tasa combina la medida de casos del cubo con el denominador poblacional territorial. ")+
  (state.provisional?"Desglose municipal sin liberación oficial; visible solo para cuenta maestra.":
  "Los valores se muestran solo conforme a la autorización de CAHOS.");
}
async function loadPopulation(){
 const year=state.year;
 const result=await api("/api/population?year="+year);
 if(!result.available||!Array.isArray(result.rows)||result.rows.length!==72)
  throw Error("El año no tiene 72 denominadores poblacionales verificados");
 state.population=result.rows;
}
async function loadCases(){
 if(state.queryBusy)return;
 const pathology=$("pathology").value,year=$("year").value;
 if(!pathology||!year){inform("Selecciona patología y año antes de consultar.","error");return}
 state.queryBusy=true;$("consult").disabled=true;
 state.municipal=new Map();state.grandTotal=null;state.provisional=false;
 state.year=yrNumber(year);save();
 inform("Consultando el cubo SINAVE desde el agente autorizado. Los datos municipales dependen de tu rol.");
 try{
  await loadPopulation();
  drawMap();
  const body={kind:"municipality",pathology,years:[year],entity:state.member.entity,
   sex:$("sex").value||"",age:$("age").value||""};
  let result=null;
  for(let attempt=0;attempt<10;attempt++){
   result=await api("/api/query","POST",body);
   if(result?.rows||result?.status==="awaiting_review"||result?.status==="failed")break;
   if(!["queued","running"].includes(result?.status))break;
   inform("Extracción municipal en curso. Intento de consulta "+(attempt+1)+"/10; el agente trabaja en Supabase.");
   await new Promise(resolve=>setTimeout(resolve,6000));
  }
  if(Array.isArray(result?.rows)){
   const check=matchMunicipios(result.rows);
   if(!check.ok)throw Error("Desglose no conciliado: "+check.reason);
   state.municipal=check.values;state.grandTotal=check.total;state.provisional=result.provisional===true;
   state.caseQuality=result.validacion||"revisión interna";
   inform(check.municipalities+" municipios conciliados. Total estatal "+fmt(check.total)+" casos. "+
    (state.provisional?"VISTA PRELIMINAR RESTRINGIDA A ADMINISTRADOR MAESTRO.":"Consulta habilitada para tu rol."),"ok");
  }else if(result?.status==="awaiting_review"){
   inform("La extracción contiene datos municipales, pero permanece restringida por privacidad. El mapa puede mostrar la capa de población; los casos municipales requieren acceso maestro.");
  }else if(["queued","running"].includes(result?.status)){
   inform("La extracción continúa en la cola. Vuelve a pulsar Consultar territorio dentro de unos momentos.");
  }else{
   inform("Todavía no hay datos municipales utilizables para esta selección.");
  }
 }catch(e){inform("Consulta territorial: "+e.message,"error")}
 finally{state.queryBusy=false;$("consult").disabled=false;drawMap();if(state.selected)showDetail(state.selected)}
}
async function initialize(){
 try{
  if(!await window.CAHOSAuth.accessToken()){
   inform("Inicia sesión primero en Acceso de CAHOS. Los datos del cubo no son públicos.","error");
   $("access").innerHTML='<a href="../acceso.html">Iniciar sesión segura en CAHOS</a>';
   return;
  }
  const [profile,status,...catalogs]=await Promise.all([
   window.CAHOSAuth.profile(),api("/api/status"),
   ...["pathologies","years","entities","sex","age"].map(dim=>api("/api/catalog?dim="+dim))
  ]);
  if(!profile?.enabled)throw Error("La cuenta no está habilitada en CAHOS");
  $("access").textContent=profile.is_master?"Administrador Maestro · Vista protegida":
    "Cuenta autorizada · Capas limitadas por privacidad";
  ["pathologies","years","entities","sex","age"].forEach((dim,i)=>state.catalog[dim]=catalogs[i].members||[]);
  state.member.entity=state.catalog.entities.find(x=>x.nombre.replace(/^26\s+/,"").trim().toLowerCase()==="sonora")?.id;
  if(!state.member.entity)throw Error("No se encontró 26 Sonora en el catálogo");
  options("year",(state.catalog.years||[]).filter(x=>yrNumber(x.id)>=2015&&yrNumber(x.id)<=2030)
   .sort((a,b)=>yrNumber(b.id)-yrNumber(a.id)));
  options("sex",state.catalog.sex,"Ambos sexos");options("age",state.catalog.age,"Todas las edades");
  selectOption("year",shared.year)||selectOption("year",(state.catalog.years||[]).find(x=>yrNumber(x.id)===2026)?.id);
  selectOption("sex",shared.sex);selectOption("age",shared.age);
  state.selected=shared.pop_municipality||null;
  $("search").value=shared.pathology_search||"";
  searchPathology();
  if(shared.pathology)selectOption("pathology",shared.pathology);
  if(!$("pathology").value&&status.favoritos?.length)selectOption("pathology",status.favoritos[0]);
  const carto=await fetch("../data/sonora_municipios.geojson",{cache:"no-store"});
  if(!carto.ok)throw Error("Cartografía INEGI no incluida en la última publicación de GitHub Pages");
  const geo=await carto.json();
  if(geo.type!=="FeatureCollection"||geo.features?.length!==72)
   throw Error("El mapa INEGI no contiene las 72 geometrías municipales de Sonora");
  state.features=geo.features;state.featureMap=new Map(geo.features.map(f=>[String(f.properties.cvegeo),f]));
  state.year=yrNumber($("year").value)||2026;
  await loadPopulation();drawMap();
  if(state.selected&&state.featureMap.has(state.selected))showDetail(state.selected);
  else if(state.features.length){state.selected=null;blank($("pyramid"),"Selecciona un municipio");blank($("trend"),"Selecciona un municipio")}
  inform("Cartografía y población disponibles. "+(profile.is_master?
   "La cuenta maestra puede consultar desgloses municipales preliminares.":"Los datos municipales retenidos no se publican a perfiles sin autorización."),"ok");
  if($("pathology").value)await loadCases();
 }catch(e){inform("No se pudo iniciar MAPA CAHOS: "+e.message,"error");drawMap()}
}
$("search").addEventListener("input",searchPathology);
for(const id of ["pathology","year","sex","age"]){
 $(id).addEventListener("change",()=>{state.municipal=new Map();state.grandTotal=null;
  state.year=yrNumber($("year").value)||2026;save();
  if(id==="year")loadPopulation().then(drawMap).catch(e=>inform(e.message,"error"));
  else drawMap();
 });
}
$("metric").addEventListener("change",drawMap);
$("consult").addEventListener("click",loadCases);
for(const [id,mult] of [["zoomIn",.72],["zoomOut",1.38]]){
 $(id).addEventListener("click",()=>{
  const v=state.viewBox,oldW=v.w,oldH=v.h;
  v.w=Math.max(250,Math.min(900,oldW*mult));v.h=v.w*620/900;
  v.x+= (oldW-v.w)/2;v.y+=(oldH-v.h)/2;
  $("map").setAttribute("viewBox",Object.values(v).join(" "));
 });
}
$("resetZoom").addEventListener("click",()=>{
 state.viewBox={x:0,y:0,w:900,h:620};$("map").setAttribute("viewBox","0 0 900 620");
});
window.addEventListener("pagehide",save);
initialize();
})();