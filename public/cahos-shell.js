/* CAHOS · shell de navegación único. No lee tokens, cubos ni datos sensibles. */
(()=>{
 "use strict";
 const entries=[
  {id:"visor",label:"Panorama",side:"Visor SUIVE",icon:"▤",href:"/CAHOS/"},
  {id:"map",label:"Mapa",side:"MAPA CAHOS",icon:"◈",href:"/CAHOS/mapa-cahos/"},
  {id:"population",label:"Población",side:"Población y pirámides",icon:"♙",href:"/CAHOS/poblacion.html"},
  {id:"quality",label:"Calidad",side:"Control de calidad",icon:"▣",href:"/CAHOS/revision.html"},
  {id:"connection",label:"Infraestructura",side:"Estado de conexión",icon:"⌁",href:"/CAHOS/conexion.html"},
  {id:"access",label:"Acceso",side:"Acceso seguro",icon:"◉",href:"/CAHOS/acceso.html"}
 ];
 const names={
  visor:["Visor SUIVE","Explora el comportamiento epidemiológico por patología, territorio y tiempo."],
  map:["Centro de Capas","Consulta las capas territoriales y sus indicadores autorizados."],
  population:["Población y denominadores","Explora la estructura demográfica de Sonora sin perder los filtros."],
  quality:["Control de calidad","Revisa consistencia, autorizaciones y trazabilidad de las extracciones."],
  access:["Acceso seguro","Administra tu sesión institucional y consulta tus permisos."],
  connection:["Infraestructura","Consulta el estado de la conexión del servicio CAHOS."]
 };
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
  const words=document.createElement("span");words.className="cahos-brand-words";
  const title=document.createElement("strong");title.textContent="CAHOS";
  const small=document.createElement("small");small.textContent="OBSERVATORIO EPIDEMIOLÓGICO";
  words.append(title,small);brand.append(emblem,words);
  const caption=document.createElement("span");caption.className="cahos-global-caption";caption.textContent="Inteligencia epidemiológica · Sonora";
  const nav=document.createElement("nav");nav.className="cahos-global-links";nav.setAttribute("aria-label","Productos CAHOS");
  for(const e of entries)nav.append(link(e));
  head.append(toggle,brand,caption,nav);
  body.prepend(head);
  if(page!=="visor"){
   const main=body.querySelector(":scope > main");
   if(main){
    const frame=document.createElement("div");frame.className="cahos-standard-layout";
    const aside=document.createElement("aside");aside.className="cahos-global-side";aside.setAttribute("aria-label","Panel de módulos CAHOS");
    const asideTitle=document.createElement("div");asideTitle.className="cahos-side-top";asideTitle.textContent="◈ Panel CAHOS";
    const card=document.createElement("section");card.className="cahos-side-card";
    const kicker=document.createElement("div");kicker.className="cahos-side-kicker";kicker.textContent="CAHOS · PRODUCTO";
    const h2=document.createElement("h2");h2.textContent=names[page]?.[0]||"Observatorio";
    const p=document.createElement("p");p.textContent=names[page]?.[1]||"Panel de navegación territorial";
    card.append(kicker,h2,p);
    const sideNav=document.createElement("nav");sideNav.setAttribute("aria-label","Cambiar de módulo");
    for(const e of entries)sideNav.append(link(e,true));
    aside.append(asideTitle,card,sideNav);
    const content=document.createElement("div");content.className="cahos-content-area";
    main.parentNode.insertBefore(frame,main);
    frame.append(aside,content);content.append(main);
   }
  }
  if(window.matchMedia&&window.matchMedia("(max-width: 750px)").matches){body.classList.add("cahos-side-collapsed");toggle.setAttribute("aria-expanded","false");}
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
 else init();
})();
