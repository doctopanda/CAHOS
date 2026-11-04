/* CAHOS Auth: browser login through Supabase Auth. Uses sessionStorage (tab-scoped). */
(()=>{"use strict";
const config=()=>window.SUIVE_CONFIG||{};
const STORE="cahos_cloud_session_v1";
const base=()=>String(config().supabaseUrl||"").replace(/\/$/,"");
const publicKey=()=>String(config().supabasePublishableKey||"");
const get=()=>{try{return JSON.parse(sessionStorage.getItem(STORE)||"null")}catch{return null}};
const set=(s)=>{sessionStorage.setItem(STORE,JSON.stringify({access_token:s.access_token,refresh_token:s.refresh_token,expires_at:Date.now()+Math.max(60,s.expires_in||3600)*1000}));return s};
async function tokenRequest(grant,body){
 const res=await fetch(base()+"/auth/v1/token?grant_type="+encodeURIComponent(grant),{
  method:"POST",headers:{"apikey":publicKey(),"Content-Type":"application/json"},
  body:JSON.stringify(body),cache:"no-store"});
 let data={};try{data=await res.json()}catch{}
 if(!res.ok||!data.access_token)throw new Error("No fue posible iniciar sesión. Verifica las credenciales y la cuenta.");
 return set(data);
}
async function login(email,password){return tokenRequest("password",{email,password})}
async function signup(email,password){
 const res=await fetch(base()+"/auth/v1/signup",{
  method:"POST",headers:{"apikey":publicKey(),"Content-Type":"application/json"},
  body:JSON.stringify({email,password})});
 let data={};try{data=await res.json()}catch{}
 if(!res.ok)throw new Error("No se pudo registrar la cuenta. Revisa la configuración de Auth.");
 if(data.access_token)set(data);
 return data;
}
let renewing=null;
async function accessToken(){
 const session=get();
 if(!session)return null;
 if(session.access_token&&session.expires_at>Date.now()+60000)return session.access_token;
 if(!session.refresh_token){sessionStorage.removeItem(STORE);return null}
 if(!renewing)renewing=tokenRequest("refresh_token",{refresh_token:session.refresh_token}).finally(()=>renewing=null);
 try{const renewed=await renewing;return renewed.access_token}catch{sessionStorage.removeItem(STORE);return null}
}
function logout(){sessionStorage.removeItem(STORE)}
async function api(path,opts={}){
 const token=await accessToken();
 if(!token)throw new Error("Se requiere iniciar sesión en CAHOS.");
 const url=String(config().apiBaseUrl||"").replace(/\/$/,"")+path;
 const response=await fetch(url,{method:opts.method||"GET",cache:"no-store",headers:{
  "apikey":publicKey(),"Authorization":"Bearer "+token,
  ...(opts.body!==undefined?{"Content-Type":"application/json"}:{})},
  ...(opts.body!==undefined?{body:JSON.stringify(opts.body)}:{})});
 let body={};try{body=await response.json()}catch{}
 if(!response.ok)throw new Error(body?.error||"No fue posible completar la solicitud.");
 return {body,status:response.status};
}
window.CAHOSAuth=Object.freeze({login,signup,logout,accessToken,api,getSession:get});
})();