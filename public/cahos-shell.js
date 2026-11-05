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
 const SVG_NS="http://www.w3.org/2000/svg";
 const assets="/CAHOS/assets/";
 function applySonoraMark(emblem){
  if(!emblem)return;
  const img=document.createElement("img");img.src=assets+"cahos-emblema.svg";
  img.alt="";img.loading="eager";img.decoding="async";
  emblem.replaceChildren(img);
 }
 function artFor(module){
  const box=document.createElement("span");box.className="cahos-nav-icon";
  const svg=document.createElementNS(SVG_NS,"svg");
  svg.setAttribute("viewBox","0 0 260 150");svg.setAttribute("aria-hidden","true");
  svg.setAttribute("focusable","false");
  const use=document.createElementNS(SVG_NS,"use");
  use.setAttribute("href",assets+"cahos-modulos.svg#"+module);
  svg.append(use);box.append(svg);return box;
 }
 function addModuleCover(main,module){
  const top=main.querySelector(":scope > .top");
  let hero;
  if(top){
   hero=top;
   hero.classList.add("cahos-module-cover");
  }else{
   const h1=main.querySelector("h1");
   if(!h1)return;
   hero=document.createElement("section");hero.className="cahos-module-cover";
   const copy=document.createElement("div");copy.className="cahos-cover-copy";
   const brand=document.createElement("span");brand.className="cahos-cover-brand";
   const img=document.createElement("img");img.src=assets+"cahos-emblema.svg";img.alt="";
   const txt=document.createElement("strong");txt.textContent="CAHOS · "+module.toUpperCase();
   brand.append(img,txt);copy.append(brand);
   h1.parentNode.insertBefore(hero,h1);
   copy.append(h1);
   const desc=document.createElement("p");desc.className="cahos-cover-description";
   desc.textContent=names[module]?.[1]||"Sistema de inteligencia epidemiológica";
   copy.append(desc);hero.append(copy);
  }
  if(!hero.querySelector(".cahos-cover-art")){
   const art=document.createElement("span");art.className="cahos-cover-art";
   const svg=document.createElementNS(SVG_NS,"svg");svg.setAttribute("viewBox","0 0 260 150");
   svg.setAttribute("aria-hidden","true");svg.setAttribute("focusable","false");
   const use=document.createElementNS(SVG_NS,"use");
   use.setAttribute("href",assets+"cahos-modulos.svg#"+module);
   svg.append(use);art.append(svg);hero.append(art);
  }
 }
 function link(e,side=false){
  const a=document.createElement("a");
  a.href=e.href;a.textContent=side?e.side:e.label;
  if(e.id===document.body.dataset.cahosModule){a.setAttribute("aria-current","page");a.classList.add("cahos-global-active");}
  if(side)a.prepend(artFor(e.id));
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
  if(!document.querySelector('link[rel="icon"]')){
   const favicon=document.createElement("link");favicon.rel="icon";
   favicon.type="image/svg+xml";favicon.href=assets+"cahos-emblema.svg";
   document.head.append(favicon);
  }
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
   addModuleCover(main,page);
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
