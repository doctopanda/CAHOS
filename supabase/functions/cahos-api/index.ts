// CAHOS API v0.1: authenticated read-only cloud façade.
// Never expose SINAVE credentials, Excel, local Windows ports, or unpublished aggregates.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const PUBLIC_API_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ORIGINS = new Set(["https://doctopanda.github.io", "http://127.0.0.1:8789", "http://localhost:8789"]);
const DIMENSIONS = new Set(["pathologies","years","weeks","municipalities","entities","sex","age","institutions"]);
function cors(req: Request): Headers {
  const origin = req.headers.get("origin") ?? "";
  const h = new Headers({"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","vary":"origin"});
  if(ORIGINS.has(origin)){h.set("access-control-allow-origin",origin);h.set("access-control-allow-headers","authorization, apikey, content-type");h.set("access-control-allow-methods","GET, POST, OPTIONS");h.set("access-control-max-age","600");}
  return h;
}
function json(req:Request, payload:unknown, status=200): Response {return new Response(JSON.stringify(payload), {status,headers:cors(req)});}
async function fromSupabase(path:string, token:string):Promise<unknown[]> {
  const r=await fetch(SUPABASE_URL+path,{headers:{"apikey":PUBLIC_API_KEY,"authorization":"Bearer "+token,"accept":"application/json"}});
  if(!r.ok)throw Error("database_request_"+r.status);
  const data=await r.json();
  if(!Array.isArray(data))throw Error("unexpected_database_response");
  return data;
}
Deno.serve(async (req: Request)=>{
 try{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
  const pathname=new URL(req.url).pathname; const marker="/cahos-api"; const at=pathname.indexOf(marker); const path=at>=0?(pathname.slice(at+marker.length)||"/"):pathname;
  if(path==="/health" && req.method==="GET")
    return json(req,{ok:true,service:"CAHOS cloud API",phase:"protected_schema_ready",worker:"not_connected",epidemiological_data_available:false});
  if(!SUPABASE_URL||!PUBLIC_API_KEY)return json(req,{error:"backend_configuration_pending"},503);
  const auth=req.headers.get("authorization")??"";
  if(!/^Bearer\s+[A-Za-z0-9._-]+$/.test(auth))return json(req,{error:"authentication_required"},401);
  const token=auth.slice(auth.indexOf(" ")+1).trim();
  const userResponse=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:{"apikey":PUBLIC_API_KEY,"authorization":"Bearer "+token}});
  if(!userResponse.ok)return json(req,{error:"invalid_session"},401);
  const user=await userResponse.json();
  if(!user?.id||!/^[-a-f0-9]{36}$/i.test(user.id))return json(req,{error:"invalid_session"},401);
  const members=await fromSupabase("/rest/v1/cahos_members?select=role,entity_code,enabled&user_id=eq."+encodeURIComponent(user.id)+"&limit=1",token);
  const member=members[0] as {role:string;entity_code:string;enabled:boolean}|undefined;
  if(!member?.enabled)return json(req,{error:"cahos_access_not_approved"},403);
  if(path==="/api/status"&&req.method==="GET"){
   const [state,fav]=await Promise.all([
     fromSupabase("/rest/v1/cahos_sync_state?select=worker_name,last_success_at,status,updated_at&limit=5",token),
     fromSupabase("/rest/v1/cahos_favorites?select=pathology_id&user_id=eq."+encodeURIComponent(user.id)+"&limit=25",token)
   ]);
   const latest=(state as Array<{last_success_at?:string;status?:string}>).find(x=>x.last_success_at) ?? null;
   return json(req,{version:"cloud-0.1",modo:"supabase_protected",catalogo:"Cubo_2003_Actual",servidor:"SINAVE vía CAHOS Agent",intervalo_minutos:360,
     favoritos:(fav as Array<{pathology_id:string}>).map(x=>x.pathology_id),favoritos_inicializados:true,
     actividad:{ultima_consulta:latest?.last_success_at??null,ultima_extraccion_automatica:latest?.last_success_at??null,ultimo_error:null},
     estado_agente:state.length?state:"sin_agente",epidemiological_data_available:false});
  }
  if(path==="/api/catalog"&&req.method==="GET"){
   const dim=new URL(req.url).searchParams.get("dim")??"";
   if(!DIMENSIONS.has(dim))return json(req,{error:"invalid_dimension"},400);
   const rows=await fromSupabase("/rest/v1/cahos_catalog?dimension=eq."+encodeURIComponent(dim)+"&select=member_id,label&order=label.asc&limit=12000",token);
   return json(req,{dimension:dim,members:(rows as Array<{member_id:string;label:string}>).map(v=>({id:v.member_id,nombre:v.label}))});
  }
  if(path==="/api/query"&&req.method==="POST")
   return json(req,{error:"central_extractor_not_paired",message:"CAHOS Agent aún no envía resultados reales. No se generarán cifras ficticias."},503);
  if(path==="/api/favorites"&&req.method==="POST")
   return json(req,{error:"favorites_cloud_sync_pending"},503);
  if(path==="/api/refresh"&&req.method==="POST")
   return json(req,{error:"central_extractor_not_paired"},503);
  return json(req,{error:"route_not_available"},404);
 }catch(_e){return json(req,{error:"backend_temporarily_unavailable"},503);}
});
