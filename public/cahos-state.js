/* CAHOS: selections persist across modules in the same browser tab.
   No passwords, access tokens, nominal records or OLAP result data are stored. */
(()=>{
 "use strict";
 const KEY="CAHOS_SHARED_FILTERS_V1";
 const FIELDS=["pathology","year","entity","municipality","sex","age","week_start","week_end","pathology_search","municipality_search","panel","pop_year","pop_municipality","operational_zones","selected_municipalities","regional_scheme"];
 const cleanText=(v,max=250)=>typeof v==="string"?v.slice(0,max):"";
 const read=()=>{
  try{
   const v=JSON.parse(sessionStorage.getItem(KEY)||"null");
   if(!v||v.version!==1||typeof v.filters!=="object")return {};
   return v.filters;
  }catch{return {};}
 };
 const update=(patch)=>{
  const prior=read(),next={...prior};
  for(const f of FIELDS){
   if(!Object.prototype.hasOwnProperty.call(patch,f))continue;
   if(f==="week_start"||f==="week_end"){
    const n=Number(patch[f]);if(Number.isInteger(n)&&n>=1&&n<=53)next[f]=n;
   }else next[f]=cleanText(patch[f],f==="pathology_search"?100:f==="selected_municipalities"?600:250);
  }
  try{sessionStorage.setItem(KEY,JSON.stringify({version:1,filters:next,saved_at:Date.now()}));}catch{}
  return next;
 };
 const clear=()=>{try{sessionStorage.removeItem(KEY)}catch{}};
 window.CAHOSSelection=Object.freeze({read,update,clear});
})();
