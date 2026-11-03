/* CAHOS | Visor municipal SUIVE de solo lectura, GeoJSON oficial INEGI. */
(()=>{
"use strict";
const $=s=>document.querySelector(s);
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es").replace(/\b(municipio|de|sonora)\b/g,"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
let shapes=null,observaciones=null,population=null,selectedCode=null,detailName=null;
let joinState={byCode:new Map(),totalRows:0,withCases:0,linkedRows:0,unlinked:[]};
let currentQueryKey='',requestRunning=false,refreshTimer=null;
const codeFrom=v=>{
 const m=String(v||'').match(/(?:^|[^0-9])(26[0-9]{3})(?![0-9])/);
 return m?m[1]:'';
};
const cleanMunicipalName=v=>{
 const raw=String(v||'');
 const tail=raw.match(/\[([^\]]+)\]\s*$/);
 const candidates=[raw,tail?.[1],raw.split(',')[0],raw.split('|').pop(),raw.split(' - ')[0]]
  .filter(Boolean).map(x=>norm(x.replace(/\b26[0-9]{3}\b/g,'').replace(/^\d{1,3}\s*[-.]?\s*/,'')));
 return [...new Set(candidates.filter(Boolean))];
};
function reconcileMunicipios(){
 const byCode=new Map(),byName=new Map();
 for(const feat of (shapes?.features||[])){
  const code=String(feat.properties?.cvegeo||'');
  byCode.set(code,feat);
  const key=norm(feat.properties?.nombre);
  if(!byName.has(key))byName.set(key,[]);
  byName.get(key).push(code);
 }
 const result={byCode:new Map(),totalRows:(observaciones?.rows||[]).length,withCases:0,linkedRows:0,unlinked:[]};
 for(const row of (observaciones?.rows||[])){
  const cases=Number(row.cases);
  if(row.cases==null||!Number.isFinite(cases))continue;
  result.withCases++;
  let code=codeFrom(row.municipalities_id)||codeFrom(row.municipalities);
  if(!byCode.has(code)){
   const possible=new Set();
   for(const key of cleanMunicipalName(row.municipalities)){
    for(const found of (byName.get(key)||[]))possible.add(found);
   }
   code=possible.size===1?[...possible][0]:'';
  }
  if(code&&byCode.has(code)){
   result.linkedRows++;
   result.byCode.set(code,(result.byCode.get(code)||0)+cases);
  }else if(result.unlinked.length<5)result.unlinked.push(String(row.municipalities||'(sin nombre)').slice(0,80));
 }
 return result;
}
const getF=()=>({
 pathology:$("#diseaseSelect")?.value||"",year:$("#yearSelect")?.value||"",
 entity:$("#entitySelect")?.value||"",sex:$("#sexSelect")?.value||"",age:$("#ageSelect")?.value||""
});
const yearLabel=id=>{
 const entry=state.catalog.years?.find(o=>o.id===id);
 return Number((String(entry?.nombre||"").match(/(?:19|20)\d{2}/)||[])[0])||0;
};
const label=(dim,id)=>state.catalog[dim]?.find(o=>o.id===id)?.nombre||"";
const getMunicipality=(name,code)=>joinState.byCode.has(String(code))?joinState.byCode.get(String(code)):null;
const populationFor=(name,f,code)=>{
 if(!population?.disponible)return null;
 const match=population.municipios.find(m=>String(m.clave)===String(code))||
  population.municipios.find(m=>norm(m.nombre)===norm(name));
 if(!match)return null;
 const sex=norm(label("sex",f.sex));
 const age=norm(label("age",f.age));
 const sexes=sex?sex.startsWith("muj")||sex.startsWith("fem")?["M"]:sex.startsWith("hom")||sex.startsWith("mas")?["H"]:null:["H","M"];
 if(!sexes)return null;
 let ageKey=null;
 if(age){
  const numeric=age.match(/\b(\d{1,2})\s*(?:a|al|hasta|-)\s*(\d{1,2})\b/);
  if(numeric){
   const start=Number(numeric[1]),end=Number(numeric[2]);
   if(end-start!==4||start%5!==0)return null;
   ageKey=String(start).padStart(2,"0")+"_"+String(end).padStart(2,"0");
  }else if(/65\s*(?:y|o)\s*mas|65\+/.test(age))ageKey="65_mm";
  else return null;
 }
 let total=0;
 for(const gender of sexes){
  const g=match.edades_sexo?.[gender];
  if(!g)return null;
  if(ageKey){if(!Object.prototype.hasOwnProperty.call(g,ageKey))return null;total+=Number(g[ageKey]);}
  else total+=Object.values(g).reduce((a,b)=>a+Number(b||0),0);
 }
 return total>0?total:null;
};
function fillColor(value,max){
 if(value==null||!Number.isFinite(value)||max<=0)return "#d8e3e2";
 const t=Math.max(0,Math.min(1,value/max));
 const a=[221,239,232],b=[15,111,98],c=a.map((v,i)=>Math.round(v+(b[i]-v)*Math.sqrt(t)));
 return "rgb("+c.join(",")+")";
}
function drawAgeCurve(name,code){
 const root=$("#mapPopulation");root.replaceChildren();
 if(!population?.disponible){root.textContent="Sin denominadores. Ejecute IMPORTAR_POBLACION.bat con su libro de proyecciones.";return;}
 const m=population.municipios.find(x=>String(x.clave)===String(code))||
  population.municipios.find(x=>norm(x.nombre)===norm(name));
 if(!m){root.textContent="No se encontró un emparejamiento exacto de municipio para las curvas poblacionales.";return;}
 const ages=Object.keys(m.edades_sexo?.H||{}).sort((a,b)=>parseInt(a)-parseInt(b));
 if(!ages.length){root.textContent="Sin distribución de edades.";return;}
 const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
 svg.setAttribute("viewBox","0 0 450 275");svg.style.width="100%";
 const rows=ages.map(age=>({name:age.replace("_","-").replace("mm","+"),H:m.edades_sexo.H?.[age]||0,M:m.edades_sexo.M?.[age]||0}));
 const max=Math.max(1,...rows.map(x=>Math.max(x.H,x.M)));
 rows.forEach((r,i)=>{
  const y=15+i*17,wH=155*r.H/max,wM=155*r.M/max;
  const t=(x,y,text,color="#334155",size=10)=>{
   const e=document.createElementNS("http://www.w3.org/2000/svg","text");
   e.setAttribute("x",x);e.setAttribute("y",y);e.setAttribute("font-size",size);
   e.setAttribute("fill",color);e.textContent=text;svg.append(e);
  };
  const rect=(x,width,color)=>{
   const e=document.createElementNS("http://www.w3.org/2000/svg","rect");
   e.setAttribute("x",x);e.setAttribute("y",y-10);e.setAttribute("width",Math.max(0,width));
   e.setAttribute("height",12);e.setAttribute("rx",2);e.setAttribute("fill",color);svg.append(e);
  };
  rect(205-wH,wH,"#438f9e");rect(245,wM,"#bc82aa");t(213,y,r.name);
 });
 root.append(svg);
 const leg=document.createElement("p");leg.className="hint";leg.textContent="Azul: hombres · Magenta: mujeres · Proyección poblacional, no casos.";root.append(leg);
}
const rings=geom=>{
 if(!geom)return [];
 if(geom.type==="Polygon")return geom.coordinates;
 if(geom.type==="MultiPolygon")return geom.coordinates.flat();
 return [];
};
function render(){
 const svg=$("#mapSvg"),metric=$("#mapMetric").value,f=getF(),name=$("#mapInfoTitle");
 svg.replaceChildren();
 if(!shapes){$("#mapStatus").textContent="Cartografía oficial no cargada.";return;}
 const all=shapes.features;
 const pointPairs=[];
 for(const feature of all)for(const ring of rings(feature.geometry))for(const p of ring){if(Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1]))pointPairs.push(p);}
 if(!pointPairs.length){$("#mapStatus").textContent="INEGI no devolvió coordenadas válidas.";return;}
 let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
 for(const p of pointPairs){const x=p[0]*.87,y=p[1];if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
 const scale=Math.min(850/(x1-x0),535/(y1-y0));
 const point=p=>[(p[0]*.87-x0)*scale+25,(y1-p[1])*scale+25];
 const vals=all.map(x=>{
  const nm=x.properties?.nombre;
  const code=x.properties?.cvegeo;
  const cases=getMunicipality(nm,code),denom=populationFor(nm,f,code);
  return {name:nm,code:x.properties?.cvegeo,cases,denom,rate:cases!=null&&denom?(cases/denom)*1e5:null};
 });
 const v=vals.filter(x=>Number.isFinite(x[metric]));const max=Math.max(1,...v.map(x=>x[metric]));
 for(let i=0;i<all.length;i++){
  const feat=all[i],value=vals[i];
  const path=document.createElementNS("http://www.w3.org/2000/svg","path");
  let d="";
  for(const ring of rings(feat.geometry)){
   const stride=Math.max(1,Math.floor(ring.length/400));
   const sampled=ring.filter((_,j)=>j%stride===0);if(sampled.length<3)continue;
   d+=sampled.map((p,j)=>{const q=point(p);return(j?"L":"M")+q[0].toFixed(2)+","+q[1].toFixed(2)}).join(" ")+"Z";
  }
  path.setAttribute("d",d);
  path.setAttribute("fill",fillColor(value[metric],max));
  path.setAttribute("stroke",value.code===selectedCode?"#eeb45c":"#fff");
  path.setAttribute("stroke-width",value.code===selectedCode?"2.5":"0.8");
  path.setAttribute("tabindex","0");
  path.setAttribute("role","button");
  path.setAttribute("aria-label",value.name+": "+(value[metric]==null?"sin datos":metric==="rate"?value.rate.toFixed(1)+" por 100 mil":value.cases+" casos"));
  path.style.cursor="pointer";
  const title=document.createElementNS("http://www.w3.org/2000/svg","title");
  title.textContent=value.name+" · "+(value.cases==null?"Sin dato de casos":value.cases.toLocaleString("es-MX")+" casos")+
    (value.rate!=null?" · "+value.rate.toFixed(1)+" por 100,000":"");
  path.append(title);
  const choose=()=>{selectedCode=value.code;detailName=value.name;name.textContent=value.name;
   $("#mapInfoBody").textContent=(value.cases==null?"Casos: sin dato":("Casos: "+value.cases.toLocaleString("es-MX")))+
   " · "+(value.denom?"Población: "+value.denom.toLocaleString("es-MX"):"Denominador: no compatible")+
   " · "+(value.rate!=null?"Tasa: "+value.rate.toFixed(2)+" /100 mil":"Tasa no calculable");
   drawAgeCurve(value.name,value.code);render();};
  path.addEventListener("click",choose);
  path.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();choose();}});
  svg.append(path);
 }
 const matchedMunicipios=joinState.byCode.size;
 const diagnostic=joinState.totalRows===0
  ?'La consulta municipal no devolvió filas. El total anual no demuestra que exista desagregación municipal en la selección.'
  :matchedMunicipios===0
   ?'El cubo devolvió '+joinState.totalRows+' filas, pero ninguna coincide con las claves/nombres de INEGI. '+(joinState.unlinked.length?'Ejemplos de etiquetas sin emparejar: '+joinState.unlinked.join(', ')+'.':'')
   :matchedMunicipios+' de 72 municipios coloreables; '+joinState.totalRows+' filas del cubo ('+joinState.linkedRows+' emparejadas).'+
      (joinState.unlinked.length?' Algunas etiquetas sin emparejar: '+joinState.unlinked.join(', ')+'.':'');
 $("#mapStatus").textContent=diagnostic+' '+(population?.disponible?'Proyecciones poblacionales disponibles.':'Sin denominadores poblacionales.')+
  ' Gris significa sin información asociable, no cero casos.';
 if(detailName)drawAgeCurve(detailName,selectedCode);
}
async function loadShapes(){
 if(shapes)return;
 $("#mapStatus").textContent="Descargando geometrías municipales oficiales de INEGI…";
 try{ shapes=await GET("/api/geografia/sonora"); }
 catch(error){
  if(location.hostname.endsWith("github.io")){
   const respuesta=await fetch("./data/sonora_municipios.geojson",{cache:"no-store"});
   if(!respuesta.ok)throw Error("El mapa INEGI aún no está disponible en Pages; revisa el despliegue. La consulta de casos requiere el visor local.");
   shapes=await respuesta.json();
  }else throw error;
 }
 if(!shapes.features||shapes.features.length!==72)throw Error("No se validaron las 72 geometrías de INEGI");
}
async function query(){
 if(requestRunning)return;
 const f=getF(),year=yearLabel(f.year);
 if(!f.pathology||!year){$("#mapStatus").textContent="Selecciona primero una patología y año en Panorama.";return;}
 if(!f.entity){$("#mapStatus").textContent="Selecciona la entidad Sonora en Panorama.";return;}
 requestRunning=true;
 $("#mapQuery").disabled=true;
 $("#mapStatus").textContent="Consultando municipios del cubo SINAVE…";
 try{
  const out=await Promise.allSettled([
   loadShapes(),
   POST("/api/query",{kind:"municipality",pathology:f.pathology,years:[f.year],entity:f.entity,sex:f.sex,age:f.age}),
   GET("/api/poblacion?year="+year)
  ]);
  if(out[0].status!=="fulfilled")throw out[0].reason;
  if(out[1].status!=="fulfilled")throw out[1].reason;
  observaciones=out[1].value;
  population=out[2].status==="fulfilled"?out[2].value:{disponible:false};
  joinState=reconcileMunicipios();
  currentQueryKey=JSON.stringify(f);
  $("#mapTitleDisease").textContent=label("pathologies",f.pathology)+" · "+year;
  selectedCode=null;detailName=null;
  $("#mapInfoTitle").textContent="Selecciona un municipio";
  $("#mapInfoBody").textContent="Los colores se calculan desde casos registrados en el cubo; se preserva la procedencia de la fuente.";
  $("#mapPopulation").textContent="Selecciona un polígono para mostrar la curva demográfica.";
  render();
 }catch(e){$("#mapStatus").textContent="No se pudo elaborar el mapa: "+String(e.message||e).slice(0,220);}
 finally{requestRunning=false;$("#mapQuery").disabled=false;}
}
$("#mapQuery")?.addEventListener("click",query);
$("#mapMetric")?.addEventListener("change",render);
document.querySelector('[data-p="mapa"]')?.addEventListener("click",async()=>{
 try{
  await loadShapes();
  if(currentQueryKey!==JSON.stringify(getF()))await query();
  else render();
 }catch(e){$("#mapStatus").textContent="Cartografía oficial no disponible: "+String(e.message||e).slice(0,180);}
});
for(const id of ['#diseaseSelect','#yearSelect','#entitySelect','#sexSelect','#ageSelect']){
 $(id)?.addEventListener('change',()=>{
  if(!$("#view-mapa")?.classList.contains('hide')){
   clearTimeout(refreshTimer);refreshTimer=setTimeout(query,900);
  }
 });
}
window.CAHOSMapa={consultar:query};
})();