/* CAHOS | Visor municipal SUIVE de solo lectura, GeoJSON oficial INEGI. */
(()=>{
"use strict";
const $=s=>document.querySelector(s);
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es").replace(/\b(municipio|de|sonora)\b/g,"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
let shapes=null,observaciones=null,population=null,selectedCode=null,detailName=null;
const getF=()=>({
 pathology:$("#diseaseSelect")?.value||"",year:$("#yearSelect")?.value||"",
 entity:$("#entitySelect")?.value||"",sex:$("#sexSelect")?.value||"",age:$("#ageSelect")?.value||""
});
const yearLabel=id=>{
 const entry=state.catalog.years?.find(o=>o.id===id);
 return Number((String(entry?.nombre||"").match(/(?:19|20)\d{2}/)||[])[0])||0;
};
const label=(dim,id)=>state.catalog[dim]?.find(o=>o.id===id)?.nombre||"";
const getMunicipality=(name)=>{
 const observed=(observaciones?.rows||[]).filter(row=>norm(row.municipalities)===norm(name));
 return observed.length?observed.reduce((n,row)=>n+(Number(row.cases)||0),0):null;
};
const populationFor=(name,f)=>{
 if(!population?.disponible)return null;
 const match=population.municipios.find(m=>norm(m.nombre)===norm(name));
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
function drawAgeCurve(name){
 const root=$("#mapPopulation");root.replaceChildren();
 if(!population?.disponible){root.textContent="Sin denominadores. Ejecute IMPORTAR_POBLACION.bat con su libro de proyecciones.";return;}
 const m=population.municipios.find(x=>norm(x.nombre)===norm(name));
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
 const lons=pointPairs.map(p=>p[0]*.87),lats=pointPairs.map(p=>p[1]);
 const x0=Math.min(...lons),x1=Math.max(...lons),y0=Math.min(...lats),y1=Math.max(...lats);
 const scale=Math.min(850/(x1-x0),535/(y1-y0));
 const point=p=>[(p[0]*.87-x0)*scale+25,(y1-p[1])*scale+25];
 const vals=all.map(x=>{
  const nm=x.properties?.nombre;
  const cases=getMunicipality(nm),denom=populationFor(nm,f);
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
   drawAgeCurve(value.name);render();};
  path.addEventListener("click",choose);
  path.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();choose();}});
  svg.append(path);
 }
 $("#mapStatus").textContent=vals.filter(x=>x.cases!=null).length+" municipios con registros devueltos por el cubo · "+
  (population?.disponible?"Denominadores 2015–2030 cargados":"Sin denominadores poblacionales")+
  " · ausencia de un municipio no equivale automáticamente a cero.";
 if(detailName)drawAgeCurve(detailName);
}
async function loadShapes(){
 if(shapes)return;
 $("#mapStatus").textContent="Descargando geometrías municipales oficiales de INEGI…";
 shapes=await GET("/api/geografia/sonora");
 if(!shapes.features||shapes.features.length!==72)throw Error("No se validaron las 72 geometrías de INEGI");
}
async function query(){
 const f=getF(),year=yearLabel(f.year);
 if(!f.pathology||!year){$("#mapStatus").textContent="Selecciona primero una patología y año en Panorama.";return;}
 if(!f.entity){$("#mapStatus").textContent="Selecciona la entidad Sonora en Panorama.";return;}
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
  $("#mapTitleDisease").textContent=label("pathologies",f.pathology)+" · "+year;
  selectedCode=null;detailName=null;
  $("#mapInfoTitle").textContent="Selecciona un municipio";
  $("#mapInfoBody").textContent="Los colores se calculan desde casos registrados en el cubo; se preserva la procedencia de la fuente.";
  $("#mapPopulation").textContent="Selecciona un polígono para mostrar la curva demográfica.";
  render();
 }catch(e){$("#mapStatus").textContent="No se pudo elaborar el mapa: "+String(e.message||e).slice(0,220);}
 finally{$("#mapQuery").disabled=false;}
}
$("#mapQuery")?.addEventListener("click",query);
$("#mapMetric")?.addEventListener("change",render);
document.querySelector('[data-p="mapa"]')?.addEventListener("click",async()=>{if(!shapes){try{await loadShapes();render();}catch(e){$("#mapStatus").textContent="Cartografía oficial no disponible: "+String(e.message||e).slice(0,180);}}});
window.CAHOSMapa={consultar:query};
})();