/* CAHOS · Regionalizations with explicit provenance and overlapping memberships.
   Pure helpers. Never infer IMSS medical-service polygons from administrative centers. */
(function(root){
 "use strict";
 const supported=["custom","districts","coespo","imss"];
 const membership=(dataset,scheme,code)=>{
  const regions=dataset?.regionalizations?.[scheme]?.regions||[];
  return regions.filter(r=>Array.isArray(r.municipalities)&&r.municipalities.includes(code));
 };
 const regionById=(dataset,scheme,id)=>
  dataset?.regionalizations?.[scheme]?.regions?.find(r=>r.id===id)||null;
 const selection=(dataset,scheme,regionIds=[],municipalCodes=[])=>{
  const ids=new Set(municipalCodes||[]);
  for(const regionId of regionIds||[]){
   const region=regionById(dataset,scheme,regionId);
   if(!region)continue;
   if(scheme==="imss"){
    if(region.seat_municipality)ids.add(region.seat_municipality);
   }else for(const m of region.municipalities||[])ids.add(m);
  }
  return ids;
 };
 const validate=(data,codes)=>{
  const expected=new Set(codes);
  if(expected.size!==72)throw Error("Se requieren las 72 claves municipales INEGI");
  if(data?.schema!=="cahos_regionalization_v1"||!data.regionalizations)throw Error("Catálogo territorial inválido");
  for(const k of supported){
   const item=data.regionalizations[k];
   if(!item||!Array.isArray(item.regions))throw Error("Falta regionalización "+k);
   const occurrences=new Map();
   for(const r of item.regions){
    for(const code of r.municipalities||[]){
     if(!expected.has(code))throw Error("Clave territorial desconocida: "+code);
     occurrences.set(code,(occurrences.get(code)||0)+1);
    }
    if(k==="imss"&&r.seat_municipality&&!expected.has(r.seat_municipality))
      throw Error("Sede IMSS sin municipio: "+r.name);
   }
   if(item.type==="partition"&&(occurrences.size!==72||
     [...occurrences.values()].some(n=>n!==1)))throw Error("Regionalización incompleta o solapada: "+k);
   if(k==="imss"&&item.regions.some(r=>r.municipalities?.length))
    throw Error("IMSS requiere padrón municipal verificado, solo sedes disponibles");
  }
  return true;
 };
 const aggregate=(codes,caseMap,populationByCode,denominator)=>{
  let people=0,known=0,cases=0,rateDenom=0,denomComplete=true,popComplete=true;
  for(const code of codes){
   const pop=populationByCode.get(code);
   if(pop?.population_total!=null)people+=Number(pop.population_total);
   else popComplete=false;
   if(caseMap.has(code)){known++;cases+=caseMap.get(code)}
   const d=denominator(code);
   if(Number.isFinite(d)&&d>0)rateDenom+=d;
   else denomComplete=false;
  }
  return {municipalities:codes.size,known_municipalities:known,
   complete_cases:known===codes.size&&codes.size>0,
   cases:known===codes.size&&codes.size>0?cases:null,
   population:popComplete?people:null,
   rate:denomComplete&&known===codes.size&&rateDenom>0?100000*cases/rateDenom:null};
 };
 root.CAHOSRegions=Object.freeze({membership,regionById,selection,validate,aggregate});
})(window);
