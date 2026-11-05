/* CAHOS · semanas epidemiológicas y LESP agregado PRIVADO.
 No almacena ni envía información del archivo importado.
 Nunca interpreta resultados positivos LESP como casos confirmados de vigilancia. */
(function(root){
 "use strict";
 const $=id=>document.getElementById(id);
 const memory={rows:null,year:null,source:null,catalog:[],quality:null,lastPositiveWeek:null,loaded:false,master:false,origin:"none"};
 const callbacks=new Set(),importCallbacks=new Set();
 const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g," ").trim();
 const nameAliases={"MAGDALENA DE KINO":"MAGDALENA","SAN LUIS RIO COLORADO":"SAN LUIS RIO COLORADO","PUERTO PENASCO":"PUERTO PENASCO"};
 const canonical=v=>nameAliases[norm(v)]||norm(v);
 const maxWeeks=year=>[new Date(Date.UTC(year,11,31)),new Date(Date.UTC(year,11,25))]
  .map(d=>epiWeek(d).year===year?epiWeek(d).week:0).reduce((a,b)=>Math.max(a,b),52);
 function epiStart(year){const d=new Date(Date.UTC(year,0,4));d.setUTCDate(d.getUTCDate()-d.getUTCDay());return d;}
 function epiWeek(date){const d=new Date(date.getTime());let y=d.getUTCFullYear();
  if(d<epiStart(y))y--;else if(d>=epiStart(y+1))y++;
  return {year:y,week:Math.floor((d-epiStart(y))/604800000)+1};}
 function current(){
  const mode=$("periodMode")?.value||"annual",year=Number($("year")?.selectedOptions?.[0]?.textContent?.match(/20\d{2}/)?.[0]||$("yearFallback")?.value||2026);
  const n=maxWeeks(year),start=Math.max(1,Math.min(n,Number($("weekStart")?.value)||1));
  const end=Math.max(start,Math.min(n,Number($("weekEnd")?.value)||n));
  if(mode==="annual")return {mode,year,start:1,end:n,annual:true};
  const block=Number($("periodBlock")?.value)||1;
  if(mode==="quarter")return {mode,year,start:(block-1)*13+1,end:block===4?n:Math.min(n,block*13),annual:false};
  if(mode==="semester")return {mode,year,start:block===1?1:27,end:block===1?26:n,annual:false};
  if(mode==="single")return {mode,year,start:end,end,annual:false};
  if(mode==="cumulative")return {mode,year,start:1,end,annual:false};
  return {mode,year,start,end,annual:false};
 }
 function label(){const p=current();return p.annual?"Año epidemiológico "+p.year:"SE "+String(p.start).padStart(2,"0")+"–"+String(p.end).padStart(2,"0")+" · "+p.year;}
 function fire(){const range=current();const caption=$("periodCaption");
  if(caption)caption.textContent=label()+" · domingo a sábado";
  for(const fn of callbacks)fn(range);
 }
 function syncWeekOptions(){
  const y=current().year,n=maxWeeks(y);
  for(const id of ["weekStart","weekEnd"]){
   const sel=$(id);if(!sel)continue;
   const old=Number(sel.value)|| (id==="weekStart"?1:n);
   sel.replaceChildren();
   for(let i=1;i<=n;i++)sel.add(new Option("SE "+String(i).padStart(2,"0"),String(i)));
   sel.value=String(Math.min(n,Math.max(1,old)));
  }
  const saved=root.CAHOSSelection?.read()||{};
  if(saved.week_start&&$("weekStart"))$("weekStart").value=String(saved.week_start);
  if(saved.week_end&&$("weekEnd"))$("weekEnd").value=String(Math.min(n,Number(saved.week_end)));
  fire();
 }
 function saveWeeks(){
  const p=current();
  root.CAHOSSelection?.update({week_start:String(p.start),week_end:String(p.end)});
  fire();
 }
 function labFilter(){
  const w=current(),pathology=$("labPathology")?.value||"";
  if(!memory.loaded||memory.year!==w.year||w.start>memory.lastPositiveWeek)return null;
  const totals=new Map(),byDisease=new Map();
  let stateTotal=0,matchingRows=0;
  for(const r of memory.rows){
   if(r.week<w.start||r.week>w.end||(pathology&&r.pathology!==pathology))continue;
   matchingRows++;
   const key=canonical(r.municipality);
   totals.set(key,(totals.get(key)||0)+r.positive_lab_results);
   stateTotal+=r.positive_lab_results;
   if(!byDisease.has(key))byDisease.set(key,new Map());
   const dist=byDisease.get(key);dist.set(r.pathology,(dist.get(r.pathology)||0)+r.positive_lab_results);
  }
  // Un extracto de positivos no acredita cobertura negativa ni ausencia de notificación.
  // Si no hay registros en el intervalo, no se transforma la extracción en cero.
  if(!matchingRows)return null;
  return {totals,byDisease,stateTotal,matchingRows,window:w};
 }
 function labCount(name){
  const a=labFilter();if(!a)return null;
  const key=canonical(name);
  return a.totals.has(key)?a.totals.get(key):null;
 }
 function labStateTotal(){return labFilter()?.stateTotal??null;}
 function labSummary(){
  const a=labFilter();
  return a?{
   total:a.stateTotal,
   municipalities:a.totals.size,
   groupedRows:a.matchingRows,
   year:memory.year,
   lastPositiveWeek:memory.lastPositiveWeek,
   period:a.window
  }:null;
 }
 function labBreakdown(name){return [...(labFilter()?.byDisease.get(canonical(name))||new Map())]
  .sort((a,b)=>b[1]-a[1]).map(([pathology,count])=>({pathology,count}));}
 function labWeeks(name){
  const w=current(),nameKey=canonical(name);
  if(!memory.loaded||memory.year!==w.year||w.start>memory.lastPositiveWeek)return null;
  const path=$("labPathology")?.value||"",values=[];
  for(let week=w.start;week<=Math.min(w.end,memory.lastPositiveWeek);week++)values.push({
   week,count:memory.rows.filter(r=>r.week===week&&canonical(r.municipality)===nameKey&&(!path||r.pathology===path))
    .reduce((a,b)=>a+b.positive_lab_results,0)
  });
  return values;
 }
 function labStatus(){
  const label=$("labStatus");
  if(!label)return;
  const w=current();
  label.textContent=memory.loaded?
   (memory.year===w.year?
    (memory.origin==="protected"?"Supabase protegido: ":"Vista previa local: ")+memory.rows.length+" celdas agregadas · Año "+
      memory.year+" · último positivo registrado SE "+memory.lastPositiveWeek+
      ". Datos locales y preliminares, no casos confirmados.":
    "LESP importado para "+memory.year+"; el mapa está consultando "+w.year+
     ". Cambia el año para visualizar el archivo.") :
   (memory.master?
     "LESP no cargado. Selecciona el JSON privado en el control de importación para visualizar la capa.":
     "LESP sin fuente cargada en esta pestaña. La importación está reservada al Administrador Maestro.");
 }
 function loadAggregate(parsed,origin){
  if(!memory.master)throw Error("Solo el Administrador Maestro puede consultar agregados LESP");
  if(parsed?.schema!=="cahos-lesp-aggregates-v1"||parsed?.data_classification!=="PRIVATE_AGGREGATE_DO_NOT_PUBLISH"||
   !Array.isArray(parsed.rows)||parsed.rows.length>12000)throw Error("Formato agregado LESP no autorizado");
  const rows=parsed.rows.map(r=>{
   const keys=Object.keys(r);
   if(keys.some(k=>!["year","week","municipality","pathology","positive_lab_results"].includes(k)))
    throw Error("El archivo incluye columnas no permitidas (potencialmente nominales)");
   if(typeof r.year!=="number"||typeof r.week!=="number"||
      typeof r.positive_lab_results!=="number")
    throw Error("El agregado LESP requiere valores numéricos explícitos, no celdas nulas");
   const year=r.year,week=r.week,count=r.positive_lab_results;
   if(!/^20\d{2}$/.test(String(year))||!Number.isInteger(week)||week<1||week>53||
      !Number.isSafeInteger(count)||count<0||count>100000||
      typeof r.municipality!=="string"||r.municipality.length>110||
      typeof r.pathology!=="string"||r.pathology.length>100)throw Error("Agregado no válido");
   return {year,week,municipality:r.municipality,pathology:r.pathology,positive_lab_results:count};
  });
  const years=new Set(rows.map(r=>r.year));if(years.size!==1)throw Error("Un solo año epidemiológico por archivo");
  const keys=new Set();
  for(const row of rows){
   const key=[row.year,row.week,row.municipality.normalize("NFC").trim().toLocaleUpperCase("es-MX"),row.pathology.normalize("NFC").trim()].join("|");
   if(keys.has(key))throw Error("El archivo contiene una agrupación duplicada");
   keys.add(key);
  }
  memory.rows=rows;memory.year=[...years][0];memory.source=String(parsed.source||"LESP").slice(0,120);
  memory.catalog=[...new Set(rows.map(r=>r.pathology))].sort((a,b)=>a.localeCompare(b,"es"));
  memory.quality=parsed.quality||{};memory.lastPositiveWeek=Math.max(...rows.map(r=>r.week));memory.loaded=true;
  memory.origin=origin;
  const sel=$("labPathology");if(sel){
   sel.replaceChildren(new Option("Todas las patologías positivas",""));
   for(const name of memory.catalog)sel.add(new Option(name,name));
  }
  labStatus();
  for(const fn of importCallbacks)fn({year:memory.year,lastPositiveWeek:memory.lastPositiveWeek,rows:memory.rows.length,origin});
  fire();
 }
 async function importPrivateFile(file){
  if(!memory.master)throw Error("Solo el Administrador Maestro puede importar agregados LESP");
  if(!file||file.size>4000000)throw Error("Archivo demasiado grande para importación local");
  const parsed=JSON.parse(await file.text());
  loadAggregate(parsed,"local");
 }
 function loadRemoteSnapshot(payload){
  if(payload?.status!=="ready")throw Error("No hay una versión activa autorizada de LESP");
  loadAggregate(payload,"protected");
 }
 function pendingPayload(){
  if(!memory.master||!memory.loaded||memory.origin!=="local")return null;
  return {schema:"cahos-lesp-aggregates-v1",data_classification:"PRIVATE_AGGREGATE_DO_NOT_PUBLISH",
   source:memory.source,quality:memory.quality,rows:memory.rows.map(r=>({...r})),
   confirm_full_year_snapshot:true};
 }
 function setMaster(v){memory.master=v===true;
  const panel=$("lespImportPanel");if(panel)panel.hidden=!memory.master;
  labStatus();
 }
 function bind(){
  const mode=$("periodMode"),start=$("weekStart"),end=$("weekEnd");
  if(mode)mode.addEventListener("change",()=>{
   const single=mode.value==="single",blockMode=["quarter","semester"].includes(mode.value);
   const blockLabel=$("periodBlockLabel"),block=$("periodBlock");
   if(blockLabel)blockLabel.hidden=!blockMode;
   if(block&&blockMode){
    block.replaceChildren();
    const count=mode.value==="quarter"?4:2;
    for(let i=1;i<=count;i++)block.add(new Option((mode.value==="quarter"?"Trimestre ":"Semestre ")+i,String(i)));
   }
   if(start)start.disabled=single||mode.value==="annual"||blockMode;
    if(end)end.disabled=mode.value==="annual"||blockMode;
    const saved=root.CAHOSSelection?.read()||{};
    if(start&&end&&mode.value==="single")start.value=end.value;
    saveWeeks();
  });
  for(const el of [start,end,$("labPathology"),$("periodBlock")])el?.addEventListener("change",saveWeeks);
  $("lespFile")?.addEventListener("change",async e=>{
   try{await importPrivateFile(e.target.files[0]);}
   catch(error){const el=$("labStatus");if(el)el.textContent="No se pudo importar: "+error.message;}
   finally{e.target.value="";}
  });
  syncWeekOptions();
 }
 root.CAHOSTemporal=Object.freeze({
  current,label,epiWeek,syncWeekOptions,onChange:fn=>callbacks.add(fn),
  onImport:fn=>importCallbacks.add(fn),
  bind,setMaster,loadRemoteSnapshot,pendingPayload,labFilter,labCount,labStateTotal,labSummary,labBreakdown,labWeeks,labStatus,
  hasLab:()=>memory.loaded,labYear:()=>memory.year,origin:()=>memory.origin
 });
})(window);