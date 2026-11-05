/* CAHOS · shell de navegación único. No lee tokens, cubos ni datos sensibles. */
(()=>{
 "use strict";
 const entries=[
  {id:"visor",label:"Panorama",side:"Visor SUIVE",icon:"▤",href:"/CAHOS/"},
  {id:"map",label:"Mapa",side:"MAPA CAHOS",icon:"◈",href:"/CAHOS/mapa-cahos/"},
  {id:"population",label:"Población",side:"Población y pirámides",icon:"♙",href:"/CAHOS/poblacion.html"},
  {id:"quality",label:"Calidad",side:"Control de calidad",icon:"▣",href:"/CAHOS/revision.html"},
  {id:"connection",label:"Infraestructura",side:"Estado de conexión",icon:"⌁",href:"/CAHOS/conexion.html"},
  {id:"access",label:"Ingresar",side:"Iniciar sesión",icon:"◉",href:"/CAHOS/acceso.html"},
  {id:"admin",label:"Administración",side:"Administración maestra",icon:"⚙",href:"/CAHOS/admin.html",masterOnly:true}
 ];
 const names={
  visor:["Visor SUIVE","Explora el comportamiento epidemiológico por patología, territorio y tiempo."],
  map:["Centro de Capas","Consulta las capas territoriales y sus indicadores autorizados."],
  population:["Población y denominadores","Explora la estructura demográfica de Sonora sin perder los filtros."],
  quality:["Control de calidad","Revisa consistencia, autorizaciones y trazabilidad de las extracciones."],
  access:["Acceso seguro","Administra tu sesión institucional y consulta tus permisos."],
  connection:["Infraestructura","Consulta el estado de la conexión del servicio CAHOS."],
  admin:["Administración maestra","Vinculación del agente central, generación y revocación de tokens."]
 };
 function applySonoraMark(emblem){
  if(!emblem)return;
  fetch("/CAHOS/data/sonora_municipios.geojson",{cache:"force-cache"}).then(r=>{
   if(!r.ok)throw Error("geometry unavailable");return r.json();
  }).then(geo=>{
   if(geo?.type!=="FeatureCollection"||geo.features?.length!==72)return;
   const rings=geom=>geom?.type==="Polygon"?geom.coordinates:geom?.type==="MultiPolygon"?geom.coordinates.flat():[];
   let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
   for(const f of geo.features)for(const ring of rings(f.geometry))for(const p of ring){
    if(!Number.isFinite(p[0])||!Number.isFinite(p[1]))continue;
    const x=p[0]*.87,y=p[1];minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
   }
   if(!Number.isFinite(minX)||maxX===minX||maxY===minY)return;
   const factor=Math.min(90/(maxX-minX),90/(maxY-minY));
   const project=p=>[(p[0]*.87-minX)*factor+5,(maxY-p[1])*factor+5];
   const NS="http://www.w3.org/2000/svg",svg=document.createElementNS(NS,"svg");
   svg.setAttribute("viewBox","0 0 100 100");svg.setAttribute("role","img");
   svg.setAttribute("aria-label","Silueta de Sonora desde polígonos INEGI");svg.style.cssText="width:100%;height:100%;display:block";
   for(const f of geo.features){
    let d="";
    for(const ring of rings(f.geometry)){
     const skip=Math.max(1,Math.floor(ring.length/250)),pts=ring.filter((_,i)=>i%skip===0);
     if(pts.length<3)continue;
     d+=pts.map((p,i)=>{const [x,y]=project(p);return (i?"L":"M")+x.toFixed(2)+" "+y.toFixed(2)}).join(" ")+"Z";
    }
    const path=document.createElementNS(NS,"path");path.setAttribute("d",d);path.setAttribute("fill","#8A1F5B");
    svg.append(path);
   }
   emblem.replaceChildren(svg);
  }).catch(()=>{ /* Emblema decorativo: conservar ícono si cartografía no está disponible */ });
 }
 function link(e,side=false){
  const a=document.createElement("a");
  a.href=e.href;a.textContent=side?e.side:e.label;
  if(e.id===document.body.dataset.cahosModule){a.setAttribute("aria-current","page");a.classList.add("cahos-global-active");}
  if(side){const i=document.createElement("span");i.className="cahos-nav-icon";i.textContent=e.icon;a.prepend(i);}
  return a;
 }
 function init(){
  const body=document.body,page=body.dataset.cahosModule;
  if(!page||page==="map"||document.querySelector(".cahos-global-topbar"))return;
  body.classList.add("cahos-unified","cahos-page-"+page);
  const head=document.createElement("header");head.className="cahos-global-topbar";head.setAttribute("aria-label","Navegación general CAHOS");
  const toggle=document.createElement("button");toggle.type="button";toggle.textContent="☰";toggle.setAttribute("aria-label","Mostrar u ocultar panel lateral");toggle.setAttribute("aria-expanded","true");
  toggle.addEventListener("click",()=>{const collapsed=body.classList.toggle("cahos-side-collapsed");toggle.setAttribute("aria-expanded",String(!collapsed));});
  const brand=document.createElement("a");brand.className="cahos-brand-link";brand.href="/CAHOS/";
  const emblem=document.createElement("span");emblem.className="cahos-brand-emblem";emblem.textContent="⌁";
  applySonoraMark(emblem);
  const words=document.createElement("span");words.className="cahos-brand-words";
  const title=document.createElement("strong");title.textContent="CAHOS";
  const small=document.createElement("small");small.textContent="OBSERVATORIO EPIDEMIOLÓGICO";
  words.append(title,small);brand.append(emblem,words);
  const caption=document.createElement("span");caption.className="cahos-global-caption";caption.textContent="Inteligencia epidemiológica · Sonora";
  const nav=document.createElement("nav");nav.className="cahos-global-links";nav.setAttribute("aria-label","Productos CAHOS");
  for(const e of entries.filter(e=>!e.masterOnly))nav.append(link(e));
  head.append(toggle,brand,caption,nav);
  body.prepend(head);
  // Panorama y Población comparten el mismo sidebar y conservan sus controles
  // sin recrearlos: los listeners y los IDs de la consulta siguen intactos.
  const root=page==="visor"?body.querySelector(":scope > .shell"):body.querySelector(":scope > main");
  const main=page==="visor"?root?.querySelector(":scope > main.main"):root;
  if(root&&main){
   const frame=document.createElement("div");frame.className="cahos-standard-layout";
   const aside=document.createElement("aside");aside.className="cahos-global-side";aside.setAttribute("aria-label","Panel de procesamiento CAHOS");
   const asideTitle=document.createElement("div");asideTitle.className="cahos-side-top";asideTitle.textContent="◈ Centro de procesamiento";
   const card=document.createElement("section");card.className="cahos-side-card";
   const kicker=document.createElement("div");kicker.className="cahos-side-kicker";kicker.textContent="CAHOS · PRODUCTO";
   const h2=document.createElement("h2");h2.textContent=names[page]?.[0]||"Observatorio";
   const p=document.createElement("p");p.textContent=names[page]?.[1]||"Panel de navegación territorial";
   card.append(kicker,h2,p);
   const sideNav=document.createElement("nav");sideNav.className="cahos-module-nav";sideNav.setAttribute("aria-label","Cambiar de módulo");
   for(const e of entries.filter(e=>!e.masterOnly))sideNav.append(link(e,true));
   aside.append(asideTitle,card,sideNav);
   const content=document.createElement("div");content.className="cahos-content-area";
   root.parentNode.insertBefore(frame,root);
   frame.append(aside,content);
   if(page==="visor"){
    const oldAside=root.querySelector(":scope > aside.side");
    const inner=document.createElement("details");inner.className="cahos-sidebar-section";inner.open=true;
    const summary=document.createElement("summary");summary.textContent="Secciones del Panorama";
    const native=document.createElement("div");native.className="cahos-native-controls";
    if(oldAside)while(oldAside.firstChild)native.append(oldAside.firstChild);
    inner.append(summary,native);aside.append(inner);
    const filters=main.querySelector("#filters");
    if(filters){
     const filterBox=document.createElement("details");filterBox.className="cahos-sidebar-section";
     const filterSummary=document.createElement("summary");filterSummary.textContent="Filtros del cubo SUIVE";
     filterBox.append(filterSummary,filters);aside.insertBefore(filterBox,inner);
    }
   }else if(page==="population"){
    const filters=main.querySelector(".selectors");
    if(filters){
     const filterBox=document.createElement("details");filterBox.className="cahos-sidebar-section";filterBox.open=true;
     const filterSummary=document.createElement("summary");filterSummary.textContent="Procesamiento poblacional";
     filterBox.append(filterSummary,filters);aside.append(filterBox);
    }
   }
   content.append(main);
   if(root!==main)root.remove();
  }
  // Si la sesión está activa, reemplazar "Ingresar" por una salida real;
  // "Acceso" redirige a Panorama y no debe impedir cambiar de usuario.
  if(window.CAHOSAuth?.accessToken){
   window.CAHOSAuth.accessToken().then(token=>{
    if(!token)return;
    document.querySelectorAll('.cahos-global-links a[href="/CAHOS/acceso.html"], .cahos-module-nav a[href="/CAHOS/acceso.html"]').forEach(link=>link.remove());
    const logout=document.createElement("button");logout.type="button";
    logout.className="cahos-global-logout";logout.textContent="Salir";
    logout.setAttribute("aria-label","Cerrar sesión CAHOS");
    logout.addEventListener("click",()=>{
     window.CAHOSAuth.logout();location.assign("/CAHOS/acceso.html");
    });
    nav.append(logout);
    return window.CAHOSAuth.profile?.();
   }).then(profile=>{
    if(profile?.enabled&&profile?.is_master===true){
     const master=entries.find(e=>e.id==="admin");
     nav.insertBefore(link(master),nav.querySelector(".cahos-global-logout"));
     document.querySelector(".cahos-module-nav")?.append(link(master,true));
    }
   }).catch(()=>{});
  }
  if(window.matchMedia&&window.matchMedia("(max-width: 750px)").matches){body.classList.add("cahos-side-collapsed");toggle.setAttribute("aria-expanded","false");}
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
 else init();
})();
