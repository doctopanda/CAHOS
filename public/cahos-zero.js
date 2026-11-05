/* CAHOS SUIVE · Cero con procedencia, no pérdida silenciosa de registros.
   Un valor nulo de una extracción válida puede contarse como 0 imputado.
   Ausencia de extracción, error, privacidad o retención son estados distintos. */
(function(root){
 "use strict";
 const isMissing=value=>value===null||value===undefined||
  (typeof value==="string"&&value.trim()==="");
 function normalize(value){
  if(isMissing(value))return {value:0,imputed:true,status:"SIN_REGISTRO_IMPUTADO_0"};
  if(typeof value!=="number"&&typeof value!=="string")
   throw new Error("Medida SUIVE inválida: tipo no numérico");
  const number=Number(value);
  if(!Number.isFinite(number)||number<0||!Number.isSafeInteger(number))
   throw new Error("Medida SUIVE inválida: no se permite convertir errores de dato en cero");
  return {value:number,imputed:false,status:number===0?"CERO_OBSERVADO":"VALOR_OBSERVADO"};
 }
 function row(record){
  const measure=normalize(record?.cases);
  return {...record,cases:measure.value,case_imputed:measure.imputed,case_status:measure.status};
 }
 function color(n,imputed){
  if(n!==0)return null;
  return imputed?"#cb7612":"#142f2a";
 }
 function mark(element,value,imputed){
  if(!element)return;
  element.textContent=Number(value).toLocaleString("es-MX");
  const col=color(value,imputed);
  element.style.color=col||"";
  element.setAttribute("title",value===0?(imputed?"0 imputado: celda sin medida numérica":"0 registrado explícitamente en SINAVE"):"Valor con registro");
  element.setAttribute("data-zero-source",value===0?(imputed?"imputado":"observado"):"valor");
 }
 root.CAHOSZero=Object.freeze({isMissing,normalize,row,color,mark});
})(window);