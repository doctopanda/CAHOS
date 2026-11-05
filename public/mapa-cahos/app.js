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
 selected:null,selectedZones:new Set(),selectedMunicipalities:new Set(),regionalization:null,municipalMissing:new Set(),
 grandTotal:null,caseQuality:null,provisional:false,jobStatus:null,queryBusy:false,
 loading:false,source:null,featureMap:new Map(),leafletMap:null,leafletLayer:null,viewBox:{x:0,y:0,w:900,h:620},lastDetailRequest:0};
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
 pop_year:String(state.year),
 operational_zones:[...state.selectedZones].join(","),
 selected_municipalities:[...state.selectedMunicipalities].join(","),
  regional_scheme:scheme()
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
 let grand=null,unmatched=0,duplicate=0;const missing=new Set();
 for(const r of rows){
  const entry=CAHOSZero.normalize(r.cases),cases=entry.value;
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
  if(entry.imputed)missing.add(code);
 }
 if(result.size===0||unmatched||duplicate||grand===null)return {
  ok:false,reason:"Filas municipales no conciliadas (enlazadas "+result.size+
   ", sin clave "+unmatched+", duplicadas "+duplicate+", total estatal "+(grand===null?"ausente":"presente")+")"};
 const total=[...result.values()].reduce((a,b)=>a+b,0);
 if(total!==grand)return {ok:false,reason:"Suma municipal "+fmt(total)+" ≠ total estatal "+fmt(grand)};
 return {ok:true,values:result,total,municipalities:result.size,missing};
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


const ZONE_COLORS=["#2b8b75","#648cbd","#d2a03e","#976fb2","#b36b61","#759d57",
 "#467e9a","#d08b70","#a38b43","#428e89"];
function scheme(){return $("regionScheme")?.value||"custom"}
function schemeData(){return state.regionalization?.regionalizations?.[scheme()]||null}
function zoneList(){
 const data=schemeData(),list=[...(data?.regions||[])];
 if(scheme()==="custom"&&data?.unassigned?.length)
  list.push({id:"unassigned",name:"Sin zona asignada",municipalities:data.unassigned});
 return list;
}
function zonesFor(code){
 return state.regionalization?CAHOSRegions.membership(state.regionalization,scheme(),code).map(x=>x.id):[];
}
function selectedCodes(){
 const all=new Set(state.features.map(f=>String(f.properties.cvegeo)));
 if(!state.selectedZones.size&&!state.selectedMunicipalities.size)return all;
 const special=state.selectedZones.has("unassigned")&&scheme()==="custom"?
  (schemeData()?.unassigned||[]):[];
 const chosen=new Set(special);
 for(const code of CAHOSRegions.selection(state.regionalization,scheme(),
   [...state.selectedZones].filter(x=>x!=="unassigned"),
   [...state.selectedMunicipalities]))chosen.add(code);
 return chosen;
}
function saveRegionalScheme(){
 save();
}
function removeMunicipality(code){
 if(!state.selectedMunicipalities.delete(code))return;
 if(state.selected===code)state.selected=[...state.selectedMunicipalities].at(-1)||null;
 saveRegionalScheme();renderMunicipalitySelection();drawMap();
 if(state.selected&&state.featureMap.has(state.selected))showDetail(state.selected);
 else clearMapDetail();
}
function chooseMunicipality(code,additive=false){
 // Volver a pulsar el polígono deselecciona; conserva zoom, capas, filtros y consultas.
 if(state.selectedMunicipalities.has(code)){removeMunicipality(code);return;}
 // Se conserva la selección multiterritorial previa para comparaciones.
 state.selectedMunicipalities.add(code);
 state.selected=code;
 saveRegionalScheme();renderMunicipalitySelection();drawMap();showDetail(code);
}
function refreshZoneChips(){
 const root=$("zoneChips");root.replaceChildren();
 const regions=zoneList();
 for(let i=0;i<regions.length;i++){
  const zone=regions[i],active=state.selectedZones.has(zone.id);
  const button=document.createElement("button");
  button.type="button";button.className="zoneChip";
  button.setAttribute("aria-pressed",String(active));
  const dot=document.createElement("i");dot.className="dot";
  dot.style.background=ZONE_COLORS[i%ZONE_COLORS.length];
  const label=document.createElement("span");
  label.textContent=zone.name+" · "+
   (scheme()==="imss"?"sede":zone.municipalities.length+" mun.");
  button.append(dot,label);
  button.addEventListener("click",()=>{
   if(state.selectedZones.has(zone.id))state.selectedZones.delete(zone.id);
   else state.selectedZones.add(zone.id);
   saveRegionalScheme();refreshZoneChips();drawMap();
  });
  root.append(button);
 }
}
function renderMunicipalitySelection(){
 const root=$("selectedMunicipalities");root.replaceChildren();
 for(const code of [...state.selectedMunicipalities].sort()){
  const record=state.featureMap.get(code)?.properties;
  if(!record){state.selectedMunicipalities.delete(code);continue}
  const button=document.createElement("button");
  button.type="button";button.className="zoneChip";
  button.textContent=(record.nombre||code)+" ×";
  button.title="Quitar municipio de la selección";
  button.addEventListener("click",()=>removeMunicipality(code));
  root.append(button);
 }
}
function renderTerritorialSummary(){
 const root=$("zoneTotals");
 const data=schemeData();if(!data){root.textContent="Regionalización pendiente";return}
 const codes=selectedCodes(),popByCode=new Map(state.population.map(x=>[x.municipality_code,x]));
 const stats=CAHOSRegions.aggregate(codes,state.municipal,popByCode,rateDenominator);
 const selected=zoneList().filter(x=>state.selectedZones.has(x.id)).map(x=>x.name);
 const label=selected.length?selected.join(" + "):"Todo Sonora";
 const title=document.createElement("div");title.className="regionLabel";
 title.textContent=label+" · "+codes.size+" municipios únicos";
 const text=document.createElement("div");
 text.textContent="Población: "+(stats.population==null?"no disponible":fmt(stats.population))+
  " · Casos: "+(stats.cases==null?"información incompleta":fmt(stats.cases))+
  " · Tasa /100,000: "+(stats.rate==null?"no calculable":stats.rate.toLocaleString("es-MX",{maximumFractionDigits:2}))+
  ". Se evita duplicar municipios compartidos.";
 const note=document.createElement("div");note.className="zoneHelp";
 note.textContent=scheme()==="imss"?
  "IMSS: solo se conocen los municipios sede. Este subtotal NO representa la población ni los casos de toda la región IMSS. Esperando matriz municipal oficial.":
  scheme()==="custom"?"Zonas operativas propuestas, no límites oficiales. Hay 7 municipios sin asignar y 7 compartidos entre zonas.":
  "Límites por agrupación de municipios, derivados de la regionalización de origen.";
 if(state.municipalMissing.size){
  const imputed=[...codes].filter(code=>state.municipalMissing.has(code)).length;
  note.textContent+=" · "+imputed+" municipios/celdas contabilizados como cero imputado (naranja), no cero observado.";
 }
 root.replaceChildren(title,text,note);
 const labels={custom:"6 zonas · 65/72 municipios · 7 cruces",districts:"6 distritos · 72/72",
  coespo:"10 regiones · 72/72",imss:"10 sedes · límites pendientes"};
 $("regionCoverage").textContent=labels[scheme()];
 $("overviewMunicipalities").textContent=String(codes.size);
 $("overviewRegions").textContent=String(state.selectedZones.size||zoneList().length);
 $("panoramaContext").textContent=scheme()==="custom"?
  "6 zonas CAHOS propuestas · municipios compartidos permitidos":
  scheme()==="districts"?"Distritos de Salud · Sonora 2025":
  scheme()==="coespo"?"10 regiones COESPO · regionalización actual":
  "10 sedes IMSS Bienestar · límites regionales no verificados";
 $("regionHelp").textContent=scheme()==="custom"?
  "Agrupación analítica aportada para CAHOS. Las zonas se traslapan y siete municipios siguen sin asignación; selección múltiple sin doble conteo.":
  scheme()==="districts"?"Boletín Oficial del Estado de Sonora, 10 de febrero de 2025, artículo 29 BIS. Distribución completa de 72 municipios.":
  scheme()==="coespo"?"Regiones COESPO actuales: 10 agrupaciones de municipios, completas y excluyentes. Independientes de las 12 regiones socioeconómicas históricas.":
  "Sedes IMSS Bienestar verificadas; aún no hay padrón completo de municipios por conducción médica. Se dibujan marcadores de sedes, NO polígonos regionales.";
}
async function loadRegionalization(){
 const response=await fetch("/CAHOS/mapa-cahos/regiones-sonora.json",{cache:"no-store"});
 if(!response.ok)throw Error("No se pudo cargar el catálogo territorial actualizado");
 const data=await response.json();
 CAHOSRegions.validate(data,state.features.map(f=>String(f.properties.cvegeo)));
 state.regionalization=data;
 const candidate=shared.regional_scheme;
 if(["custom","districts","coespo","imss"].includes(candidate))$("regionScheme").value=candidate;
 const ids=new Set(zoneList().map(x=>x.id));
 state.selectedZones=new Set(String(shared.operational_zones||"").split(",").filter(x=>ids.has(x)));
 const codes=new Set(state.features.map(x=>String(x.properties.cvegeo)));
 state.selectedMunicipalities=new Set(String(shared.selected_municipalities||"").split(",").filter(x=>codes.has(x)));
 const selector=$("addMunicipality");selector.replaceChildren(new Option("Elegir municipio…",""));
 state.features.slice().sort((a,b)=>a.properties.nombre.localeCompare(b.properties.nombre,"es"))
  .forEach(x=>selector.append(new Option(x.properties.nombre,String(x.properties.cvegeo))));
 refreshZoneChips();renderMunicipalitySelection();renderTerritorialSummary();
}

function blank(svg,text){
 svg.replaceChildren();svg.append(mk("text",{x:svg.id==="map"?450:160,y:svg.id==="map"?300:90,
  "text-anchor":"middle",fill:"#708b80","font-size":"13"},text));
}


function regionColor(code,metric){
 if(metric!=="zones")return null;
 if(scheme()==="imss")return "#dce8e4"; // No official regional polygons available.
 const memberships=zonesFor(code),regions=zoneList();
 if(!memberships.length)return "#dce8e4";
 if(memberships.length>1)return "#e1a646"; // Explicit overlapping membership.
 const index=regions.findIndex(r=>r.id===memberships[0]);
 return ZONE_COLORS[Math.max(index,0)%ZONE_COLORS.length];
}
function polygonMetricMax(metric){
 if(metric==="zones")return 1;
 return Math.max(1,...state.features.map(f=>metricValue(String(f.properties.cvegeo),metric))
  .filter(v=>v!==null&&Number.isFinite(v)));
}
function polygonStyle(feature){
 const code=String(feature.properties.cvegeo),metric=$("metric").value;
 const selected=state.selectedMunicipalities.has(code),regions=zonesFor(code);
 return {
  color:selected?"#d49a39":metric==="zones"&&regions.length>1?"#67466e":"#20695b",
  weight:selected?3.8:metric==="zones"&&regions.length>1?2.1:1.2,
  opacity:1,fillColor:(metric==="cases"||metric==="rate")&&state.municipalMissing.has(code)?
   "#eeb267":regionColor(code,metric)||fill(metricValue(code,metric),polygonMetricMax(metric)),
  fillOpacity:selectedCodes().has(code)?0.77:0.13
 };
}
function tooltipNode(feature){
 const code=String(feature.properties.cvegeo),metric=$("metric").value;
 const names=zoneList().filter(x=>zonesFor(code).includes(x.id)).map(x=>x.name);
 const value=metricValue(code,metric),span=document.createElement("span");
 const description=metric==="zones"?(scheme()==="imss"?"Sede regional (sin polígonos IMSS)":
  names.join(" / ")||"Sin región asignada"):
  value===null?"Sin información":
  metric==="rate"?value.toLocaleString("es-MX",{maximumFractionDigits:2})+" /100,000":fmt(value);
 span.textContent=feature.properties.nombre+" · "+(
  (metric==="cases"||metric==="rate")&&state.municipalMissing.has(code)?
   "0 imputado por ausencia de registro":description);
 return span;
}
function updateMapFoot(){
 const metric=$("metric").value,n=state.municipal.size-state.municipalMissing.size;
 const schemes={custom:"Zonas operativas CAHOS (no oficiales)",
  districts:"Distritos de Salud · 2025",coespo:"Regiones COESPO · 10",
  imss:"IMSS Bienestar · 10 sedes, cobertura municipal pendiente"};
 const legendNames={zones:"Regionalización territorial",population:"Población proyectada",
  cases:"Casos municipales autorizados",rate:"Tasa por 100,000 habitantes"};
 $("layerLegend").textContent=legendNames[metric]||"Capa territorial";
 $("layerLegendYear").textContent=metric==="zones"?"Capa territorial":String(state.year);
 $("legendNoData").textContent=metric==="zones"?"Sin asignación":"Sin dato / retenido";
 $("legendLow").textContent=metric==="zones"?"Zona territorial":"Menor valor";
 $("legendHigh").textContent=metric==="zones"?"Zonas compartidas":"Mayor valor";
 $("legendHighSwatch").style.background=metric==="zones"?"#e1a646":"#13735e";
 $("mapFoot").textContent="Polígonos INEGI · "+(state.leafletMap&&$("mapBase").value==="osm"?
  "Base OpenStreetMap · © colaboradores de OSM · ":"")+
  (schemes[scheme()]||"")+" · "+
  (metric==="zones"?"Color por regionalización":
   metric==="population"?"Proyección poblacional":
   n>0?n+" municipios con registro y "+state.municipalMissing.size+" con 0 imputado (consulta protegida)":
   "Sin datos epidemiológicos disponibles; gris no es cero casos.")+
  " · "+state.year+" · Las cifras no certifican corte oficial.";
}
function showLeafletSeats(){
 if(!state.leafletMap)return;
 if(state.streetSeatLayer){
  state.leafletMap.removeLayer(state.streetSeatLayer);state.streetSeatLayer=null;
 }
 if(scheme()!=="imss"||!state.regionalization)return;
 const look=new Map();
 state.leafletLayer.eachLayer(layer=>look.set(String(layer.feature?.properties?.cvegeo),layer));
 const markers=window.L.layerGroup();
 for(const region of zoneList()){
  const layer=look.get(region.seat_municipality);
  if(!layer)continue;
  const where=layer.getBounds().getCenter();
  const marker=window.L.circleMarker(where,{
   radius:8,weight:2,color:"#5c426e",fillColor:"#e4b75f",fillOpacity:1
  });
  marker.bindTooltip("Sede IMSS Bienestar: "+region.name+
    " · punto aproximado al centro del municipio sede, no la dirección de la oficina.");
  marker.on("click",()=>chooseMunicipality(region.seat_municipality,true));
  markers.addLayer(marker);
 }
 markers.addTo(state.leafletMap);state.streetSeatLayer=markers;
}
function initLeafletMap(geo){
 if(!window.L)return false;
 try{
  const map=window.L.map("streetMap",{preferCanvas:true,zoomControl:true,minZoom:4,maxZoom:17});
  window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
   attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> · INEGI',
   maxZoom:17,maxNativeZoom:19,referrerPolicy:"strict-origin-when-cross-origin"
  }).addTo(map);
  const layer=window.L.geoJSON(geo,{style:polygonStyle,onEachFeature:(feature,path)=>{
   const code=String(feature.properties.cvegeo);
   path.bindTooltip(tooltipNode(feature),{sticky:true,direction:"top"});
   path.on("mouseover",()=>{path.setTooltipContent(tooltipNode(feature));path.setStyle({weight:3})});
   path.on("mouseout",()=>{if(state.leafletLayer)state.leafletLayer.resetStyle(path)});
   path.on("click",event=>{
    const original=event.originalEvent||{};
    chooseMunicipality(code,!!(original.ctrlKey||original.shiftKey||original.metaKey));
   });
  }}).addTo(map);
  state.leafletMap=map;state.leafletLayer=layer;
  map.fitBounds(layer.getBounds(),{padding:[12,12],maxZoom:9});
  map.invalidateSize();
  showLeafletSeats();
  return true;
 }catch{
  try{state.leafletMap?.remove()}catch{}
  state.leafletMap=null;state.leafletLayer=null;
  return false;
 }
}
function updateLeaflet(){
 if($("mapBase")?.value!=="osm"||!window.L||!state.features.length){
  $("streetMap").hidden=true;$("map").hidden=false;
  return false;
 }
 $("streetMap").hidden=false;$("map").hidden=true;
 if(!state.leafletLayer){
  const ok=initLeafletMap({type:"FeatureCollection",features:state.features});
  if(!ok){$("streetMap").hidden=true;$("map").hidden=false;return false}
 }
 state.leafletLayer.setStyle(polygonStyle);
 state.leafletLayer.eachLayer(layer=>{
  if(layer.feature)layer.setTooltipContent(tooltipNode(layer.feature));
 });
 showLeafletSeats();
 setTimeout(()=>state.leafletMap?.invalidateSize(false),40);
 updateMapFoot();renderTerritorialSummary();
 return true;
}
function drawMap(){
 if(updateLeaflet())return;
 const svg=$("map");svg.replaceChildren();
 if(!state.features.length){blank(svg,"Cartografía no disponible");return}
 const points=[];
 for(const f of state.features)for(const ring of rings(f.geometry))for(const p of ring)
  if(Number.isFinite(p[0])&&Number.isFinite(p[1]))points.push(p);
 if(!points.length){blank(svg,"Geometrías inválidas");return}
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const p of points){
  const x=p[0]*.87,y=p[1];
  minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
 }
 const scale=Math.min(840/(maxX-minX),565/(maxY-minY));
 const xy=p=>[(p[0]*.87-minX)*scale+30,(maxY-p[1])*scale+29];
 const metric=$("metric").value,max=polygonMetricMax(metric),activeCodes=selectedCodes();
 state.features.forEach(feature=>{
  let d="";
  for(const ring of rings(feature.geometry)){
   const stride=Math.max(1,Math.floor(ring.length/550));
   const sampled=ring.filter((_,j)=>j%stride===0);
   if(sampled.length<3)continue;
   d+=sampled.map((p,j)=>{const q=xy(p);return(j?"L":"M")+q[0].toFixed(2)+","+q[1].toFixed(2)}).join(" ")+"Z";
  }
  const code=String(feature.properties.cvegeo),value=metricValue(code,metric);
  const regions=zonesFor(code),selected=state.selectedMunicipalities.has(code);
  const fillColor=(metric==="cases"||metric==="rate")&&state.municipalMissing.has(code)?
   "#eeb267":regionColor(code,metric)||fill(value,max);
  const names=zoneList().filter(x=>regions.includes(x.id)).map(x=>x.name);
  const description=metric==="zones"?
   scheme()==="imss"?"IMSS: solo sedes, sin polígonos regionales":
    names.join(" / ")||"Sin región asignada":
    value===null?"Sin dato territorial":
    metric==="rate"?value.toFixed(2)+" por 100,000":fmt(value);
  const path=mk("path",{d,fill:fillColor,
   stroke:selected?"#f3b850":metric==="zones"&&regions.length>1?"#58466d":"#fff",
   "stroke-width":selected?3.5:metric==="zones"&&regions.length>1?2:0.85,
   "fill-opacity":activeCodes.has(code)?.98:.18,tabindex:0,role:"button",
   "aria-label":feature.properties.nombre+" · "+description});
  path.append(mk("title",{},feature.properties.nombre+" · "+description));
  path.addEventListener("click",event=>chooseMunicipality(code,!!(event.ctrlKey||event.shiftKey||event.metaKey)));
  path.addEventListener("keydown",event=>{
   if(event.key==="Enter"||event.key===" "){event.preventDefault();chooseMunicipality(code,event.shiftKey)}
  });
  svg.append(path);
 });
 svg.setAttribute("viewBox",Object.values(state.viewBox).join(" "));
 updateMapFoot();renderTerritorialSummary();
}

function pyramid(record){
 const svg=$("pyramid");svg.replaceChildren();
 if(!record){blank(svg,"Selecciona municipio");return}
 const cols=["male","female"],vals=cols.map(k=>bands.map(b=>Number(record[k]?.[b]||0)));
 const max=Math.max(1,...vals.flat()),center=160;
 const cap=s=>s==="65_mm"?"65+":s.replace("_","-");
 bands.forEach((b,i)=>{
  // Pirámide epidemiológica convencional: los menores abajo, los mayores arriba.
  const y=14+(bands.length-1-i)*27,wM=112*vals[0][i]/max,wF=112*vals[1][i]/max;
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
 $("deselectMunicipality").disabled=!state.selectedMunicipalities.has(code);
 const assignments=[];
 for(const key of ["custom","districts","coespo"]){
  const membership=CAHOSRegions.membership(state.regionalization,key,code).map(x=>x.name);
  const description={custom:"Zonas CAHOS",districts:"Distrito de Salud",coespo:"COESPO"}[key];
  assignments.push(description+": "+(membership.join(" + ")||"sin asignación"));
 }
 const seats=state.regionalization?.regionalizations?.imss?.regions?.filter(x=>x.seat_municipality===code)||[];
 assignments.push("IMSS Bienestar: "+(seats.length?
  "sede de "+seats.map(x=>x.name).join(" y "):
  "delimitación municipal pendiente"));
 $("municipalityRegions").textContent=assignments.join(" · ");
 $("note").textContent=state.provisional?"Vista preliminar privada · sin corte oficial certificado":
   "Datos territoriales según permisos del usuario y disponibilidad de extracciones.";
 if(cases===undefined){$("cases").textContent="—";$("cases").style.color="";}
 else CAHOSZero.mark($("cases"),cases,state.municipalMissing.has(code));
 $("rate").textContent=rate===null?"—":rate.toLocaleString("es-MX",{maximumFractionDigits:2});
 $("rate").style.color=rate===0?(state.municipalMissing.has(code)?"#cb7612":"#142f2a"):"";
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
 state.municipal=new Map();state.municipalMissing=new Set();state.grandTotal=null;state.provisional=false;
 state.year=yrNumber(year);save();
 inform("Consultando el cubo SINAVE desde el agente autorizado. Los datos municipales dependen de tu rol.");
 try{
  await loadPopulation();
  drawMap();
  const body={kind:"municipality",pathology,years:[year],entity:state.member.entity,
   sex:$("sex").value||"",age:$("age").value||""};
  // Create or discover exactly one job. Polling GET never resubmits an OLAP query.
  let result=await api("/api/query","POST",body);
  if(["queued","running"].includes(result?.status)&&result?.job_id){
   const jobId=String(result.job_id);
   let completed=false;
   for(let attempt=0;attempt<30;attempt++){
    inform("Consulta municipal "+(result.status==="queued"?"en cola":"en proceso")+
     " · trabajo "+(attempt+1)+"/30. No se generan extracciones duplicadas.");
    await new Promise(resolve=>setTimeout(resolve,5000));
    const progress=await api("/api/jobs/"+encodeURIComponent(jobId));
    if(progress.status==="ready"){result=progress.result;completed=true;break}
    if(["failed","awaiting_review","result_unavailable","no_data"].includes(progress.status)){
     result=progress;completed=true;break;
    }
    if(!["queued","running"].includes(progress.status)){result=progress;completed=true;break}
    result={...progress,job_id:jobId};
   }
   if(!completed&&["queued","running"].includes(result?.status))
    inform("El agente sigue procesando el trabajo. No se repetirá la extracción; regresa más tarde.","");
  }
  if(Array.isArray(result?.rows)){
   const check=matchMunicipios(result.rows);
   if(!check.ok)throw Error("Desglose no conciliado: "+check.reason);
   // Solamente después de una extracción válida y reconciliada: ausencia = 0
   // operativo, pero siempre con procedencia para marcarlo naranja.
   state.municipal=new Map(check.values);
   state.municipalMissing=new Set(check.missing);
   for(const feature of state.features){
    const code=String(feature.properties.cvegeo);
    if(!state.municipal.has(code)){
     state.municipal.set(code,0);state.municipalMissing.add(code);
    }
   }
   state.grandTotal=check.total;state.provisional=result.provisional===true;
   state.caseQuality=result.validacion||"revisión interna";
   inform(check.municipalities+" municipios con fila del cubo; "+state.municipalMissing.size+
    " municipios/celdas imputados a cero naranja. Total estatal "+fmt(check.total)+" casos. "+
    (state.provisional?"VISTA PRELIMINAR RESTRINGIDA A ADMINISTRADOR MAESTRO.":"Consulta habilitada para tu rol."),"ok");
  }else if(result?.status==="no_data"){
   const selected=label("pathologies",pathology);
   const alternative=selected==="Conjuntivitis(B30, H10.0)"?
     " En el catálogo existe Conjuntivitis(H10), un miembro distinto que puedes elegir explícitamente.":"";
   inform("SIN FILAS EN SINAVE: el miembro seleccionado no devolvió registros. No implica cero casos ni una tasa nula."+
    alternative,"");
  }else if(result?.status==="failed"){
   const extra=result.retry_after?(" Próximo intento permitido: "+
    new Date(result.retry_after).toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})+"."):"";
   inform("Consulta detenida: el agente informó "+(result.error_code||"extractor_error")+
    ". No se repetirá automáticamente."+extra+
    " Prueba una patología cuya extracción municipal ya terminó previamente.","error");
  }else if(result?.status==="awaiting_review"){
   inform("El desglose municipal permanece restringido por privacidad. La capa poblacional sigue disponible.");
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
  // La cartografía municipal es pública; el cubo de casos no.
  const publicCarto=await fetch("/CAHOS/data/sonora_municipios.geojson",{cache:"no-store"});
  if(!publicCarto.ok)throw Error("Cartografía pública INEGI no disponible en GitHub Pages");
  const publicGeo=await publicCarto.json();
  if(publicGeo.type!=="FeatureCollection"||publicGeo.features?.length!==72)
   throw Error("La cartografía debe contener 72 polígonos municipales");
  state.features=publicGeo.features;
  state.featureMap=new Map(publicGeo.features.map(f=>[String(f.properties.cvegeo),f]));
  state.selected=shared.pop_municipality||null;
  await loadRegionalization();
  if($("mapBase").value==="osm")initLeafletMap(publicGeo);
  drawMap();

  if(!await window.CAHOSAuth.accessToken()){
   inform("Cartografía pública disponible. Para casos y tasas, inicia sesión segura en CAHOS.","ok");
   $("access").innerHTML='<a href="/CAHOS/acceso.html">Iniciar sesión segura en CAHOS</a>';
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
  state.year=yrNumber($("year").value)||2026;
  await loadPopulation();
  drawMap();
  if(state.selected&&state.featureMap.has(state.selected))showDetail(state.selected);
  else if(state.features.length){state.selected=null;blank($("pyramid"),"Selecciona un municipio");blank($("trend"),"Selecciona un municipio")}
  inform("Cartografía y población disponibles. "+(profile.is_master?
   "La cuenta maestra puede consultar desgloses municipales preliminares.":"Los datos municipales retenidos no se publican a perfiles sin autorización."),"ok");
  if($("pathology").value)
   inform("Patología y filtros recuperados. Pulsa Consultar territorio para una consulta controlada. Abrir el mapa ya no crea trabajos automáticamente.","ok");
 }catch(e){inform("No se pudo iniciar MAPA CAHOS: "+e.message,"error");drawMap()}
}
$("search").addEventListener("input",searchPathology);
for(const id of ["pathology","year","sex","age"]){
 $(id).addEventListener("change",()=>{state.municipal=new Map();state.grandTotal=null;
  state.year=yrNumber($("year").value)||2026;save();clearMapDetail();
  if(id==="year")loadPopulation().then(drawMap).catch(e=>inform(e.message,"error"));
  else drawMap();
 });
}
$("metric").addEventListener("change",drawMap);
$("mapBase").addEventListener("change",()=>{drawMap();save();});
$("regionScheme").addEventListener("change",()=>{
 state.selectedZones.clear();
 save();refreshZoneChips();renderTerritorialSummary();drawMap();
 if(state.selected&&state.featureMap.has(state.selected))showDetail(state.selected);
});
$("addMunicipalityBtn").addEventListener("click",()=>{
 const code=$("addMunicipality").value;
 if(code&&state.featureMap.has(code)){
  state.selectedMunicipalities.add(code);
  state.selected=code;save();renderMunicipalitySelection();drawMap();showDetail(code);
 }
});
$("clearTerritory").addEventListener("click",()=>{
 state.selectedZones.clear();state.selectedMunicipalities.clear();state.selected=null;
 save();refreshZoneChips();renderMunicipalitySelection();drawMap();
 clearMapDetail();
});
$("deselectMunicipality").addEventListener("click",()=>{
 if(state.selected)removeMunicipality(state.selected);
});
$("clearMunicipalitySelection").addEventListener("click",()=>{
 state.selectedMunicipalities.clear();state.selected=null;
 saveRegionalScheme();renderMunicipalitySelection();drawMap();clearMapDetail();
});
$("consult").addEventListener("click",loadCases);
for(const [id,mult] of [["zoomIn",.72],["zoomOut",1.38]]){
 $(id).addEventListener("click",()=>{
  if(state.leafletMap&&$("mapBase").value==="osm"){
   if(mult<1)state.leafletMap.zoomIn();else state.leafletMap.zoomOut();
   return;
  }
  const v=state.viewBox,oldW=v.w,oldH=v.h;
  v.w=Math.max(250,Math.min(900,oldW*mult));v.h=v.w*620/900;
  v.x+= (oldW-v.w)/2;v.y+=(oldH-v.h)/2;
  $("map").setAttribute("viewBox",Object.values(v).join(" "));
 });
}
$("resetZoom").addEventListener("click",()=>{
 if(state.leafletMap&&state.leafletLayer&&$("mapBase").value==="osm"){
  state.leafletMap.fitBounds(state.leafletLayer.getBounds(),{padding:[12,12],maxZoom:9});
  return;
 }
 state.viewBox={x:0,y:0,w:900,h:620};$("map").setAttribute("viewBox","0 0 900 620");
});
function clearMapDetail(){
 $("deselectMunicipality").disabled=true;
 $("cases").style.color="";$("rate").style.color="";
 $("name").textContent="Sonora";
 $("note").textContent="Selecciona un polígono para analizar un municipio.";
 $("municipalityRegions").textContent="Sin municipio seleccionado.";
 for(const id of ["cases","rate","population","share"])$(id).textContent="—";
 blank($("pyramid"),"Selecciona un municipio");blank($("trend"),"Selecciona un municipio");
 $("context").textContent="La lectura de cifras epidemiológicas requiere acceso autorizado.";
}
$("mapFocus").addEventListener("click",()=>{
 if(state.leafletMap&&state.leafletLayer&&$("mapBase").value==="osm"){
  const selected=selectedCodes(),bounds=window.L.latLngBounds([]);
  state.leafletLayer.eachLayer(layer=>{
   if(selected.has(String(layer.feature?.properties?.cvegeo)))bounds.extend(layer.getBounds());
  });
  if(bounds.isValid())state.leafletMap.fitBounds(bounds,{padding:[25,25],maxZoom:11});
  return;
 }
 $("resetZoom").click();
});
$("mapRestore").addEventListener("click",()=>{
 state.selectedZones.clear();state.selectedMunicipalities.clear();state.selected=null;
 $("metric").value="zones";$("regionScheme").value="custom";$("mapBase").value="osm";
 refreshZoneChips();renderMunicipalitySelection();clearMapDetail();drawMap();
 $("resetZoom").click();save();
});
$("panelCompress").addEventListener("click",()=>{
 document.body.classList.add("controls-compact");
 setTimeout(()=>state.leafletMap?.invalidateSize(false),80);
});
$("panelExpand").addEventListener("click",()=>{
 document.body.classList.remove("controls-compact");
 setTimeout(()=>state.leafletMap?.invalidateSize(false),80);
});
document.addEventListener("keydown",event=>{
 const target=event.target;
 if(event.key!=="Escape"||target?.matches?.("input,select,textarea,[contenteditable=true]"))return;
 if(state.selected&&state.selectedMunicipalities.has(state.selected))removeMunicipality(state.selected);
});
window.addEventListener("pagehide",save);
initialize();
})();