// CAHOS Cloud API v0.2. Authenticated people + restricted Windows agent.
// Every query is assembled from catalog member IDs. Arbitrary MDX is forbidden.
const BASE=Deno.env.get("SUPABASE_URL")||"";
const PUBLIC_KEY=Deno.env.get("SUPABASE_ANON_KEY")||
  (()=>{try{return JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}").default||""}catch{return""}})();
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||
  (()=>{try{return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||""}catch{return""}})();
const ORIGINS=new Set(["https://doctopanda.github.io","http://127.0.0.1:8789","http://localhost:8789"]);
const DIMS=new Set(["pathologies","years","weeks","municipalities","entities","sex","age","institutions"]);
const KINDS=new Set(["annual","weekly","sex","age","municipality","institution"]);
function headers(req) {
 const h=new Headers({"content-type":"application/json;charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","vary":"origin"});
 const origin=req.headers.get("origin")||"";
 if(ORIGINS.has(origin)){h.set("access-control-allow-origin",origin);h.set("access-control-allow-headers","authorization,apikey,content-type");h.set("access-control-allow-methods","GET,POST,OPTIONS");}
 return h;
}
function send(req,body,status=200){return new Response(JSON.stringify(body),{status,headers:headers(req)})}
function requireObject(x){if(!x||Array.isArray(x)||typeof x!=="object")throw new Error("invalid_request");return x}
function id(v){return typeof v==="string"&&v.length>0&&v.length<=320?v:""}
function uuid(v){return typeof v==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8a-f][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)}
function adminHeaders(extra={}){
 if(!SERVICE_KEY)throw new Error("backend_service_credential_not_configured");
 const h={"apikey":SERVICE_KEY,"content-type":"application/json","accept":"application/json",...extra};
 if(SERVICE_KEY.split(".").length===3)h.authorization="Bearer "+SERVICE_KEY;
 return h;
}
async function db(method,route,body=null,prefer="return=representation"){
 const opts=body===null?{method,headers:adminHeaders({"prefer":prefer})}:{method,headers:adminHeaders({"prefer":prefer}),body:JSON.stringify(body)};
 const r=await fetch(BASE+"/rest/v1/"+route,opts);
 if(!r.ok)throw new Error("db_"+r.status);
 if(r.status===204)return [];
 const txt=await r.text();return txt?JSON.parse(txt):[];
}
async function auth(req){
 const bearer=req.headers.get("authorization")||"";
 if(!/^Bearer\s+[A-Za-z0-9._-]+$/.test(bearer))return null;
 const token=bearer.slice(7).trim();
 if(token.split(".").length!==3||!PUBLIC_KEY)return null;
 const response=await fetch(BASE+"/auth/v1/user",{headers:{"apikey":PUBLIC_KEY,"authorization":"Bearer "+token}});
 if(!response.ok)return null;
 const user=await response.json();
 if(!uuid(user?.id))return null;
 const found=await db("GET","cahos_members?select=role,is_master,enabled,entity_code&user_id=eq."+user.id+"&limit=1");
 const member=found[0];
 if(!member?.enabled)return {userId:user.id,role:"disabled",entity:""};
 return {userId:user.id,role:member.role,isMaster:member.is_master===true,entity:member.entity_code};
}
async function identity(req){
 const authHeader=req.headers.get("authorization")||"";
 const token=authHeader.startsWith("Bearer ")?authHeader.slice(7).trim():"";
 if(/^[a-f0-9]{64}$/i.test(token)){
  const hash=await sha256(token);
  const agents=await db("GET","cahos_agents?select=id,enabled,revoked_at&token_hash=eq."+hash+"&limit=1");
  const agent=agents[0];
  if(!agent?.enabled||agent.revoked_at)return null;
  return {userId:null,agentId:agent.id,role:"agent",entity:"26"};
 }
 return await auth(req);
}
function allowed(user){return user&&user.role!=="disabled"}
function checkUser(user,role){return allowed(user)&&(role==="any"||user.role===role||(role==="analyst"&&user.role==="admin"))}
const eq=(v)=>encodeURIComponent(v);
const dateISO=()=>new Date().toISOString();
async function sha256(s){
 const bytes=new TextEncoder().encode(s);
 const digest=await crypto.subtle.digest("SHA-256",bytes);
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function lookupCatalog(dim){
 return await db("GET","cahos_catalog?select=member_id,label&dimension=eq."+dim+"&limit=12000");
}
async function validateParams(req,user){
 const data=requireObject(req);
 if(!KINDS.has(data.kind))throw new Error("invalid_query_kind");
 if(!checkUser(user,"analyst"))throw new Error("analyst_permission_required");
 if(user.entity!=="26")throw new Error("pilot_sonora_only");
 const pathology=id(data.pathology);
 const years=Array.isArray(data.years)?data.years:[];
 if(!pathology||years.length<1||years.length>7||new Set(years).size!==years.length||years.some(v=>!id(v)))throw new Error("invalid_query_members");
 const [pathologies,yearMembers,entities]=await Promise.all([lookupCatalog("pathologies"),lookupCatalog("years"),lookupCatalog("entities")]);
 if(!pathologies.some(x=>x.member_id===pathology)||years.some(x=>!yearMembers.some(y=>y.member_id===x)))throw new Error("members_not_in_verified_catalog");
 const sonora=entities.find(x=>x.label.trim().toLowerCase().replace(/^26\s+/,"")==="sonora");
 if(!sonora||data.entity!==sonora.member_id)throw new Error("entity_must_be_sonora");
 const p={kind:data.kind,pathology,years,entity:sonora.member_id,municipality:id(data.municipality),sex:id(data.sex),age:id(data.age),week_start:Number(data.week_start??1),week_end:Number(data.week_end??53)};
 if(!Number.isInteger(p.week_start)||!Number.isInteger(p.week_end)||p.week_start<1||p.week_end>53||p.week_start>p.week_end)throw new Error("invalid_weeks");
 for(const [dim,value] of [["municipalities",p.municipality],["sex",p.sex],["age",p.age]]){
  if(value){const members=await lookupCatalog(dim);if(!members.some(m=>m.member_id===value))throw new Error("members_not_in_verified_catalog");}
 }
 if(["municipality","sex","age","institution"].includes(p.kind)&&p.years.length!==1)throw new Error("one_year_required");
 return p;
}
async function getPublished(hash,user){
 const r=await db("GET","cahos_snapshots?select=id,query_hash,query_kind,result_rows,extracted_at,source_system,coverage,publication_status&query_hash=eq."+hash+"&publication_status=eq.approved&entity_code=eq."+eq(user.entity)+"&limit=1");
 return r[0]||null;
}
function asCube(snapshot){
 return {rows:snapshot.result_rows,axes:snapshot.query_kind==="weekly"?["years","weeks"]:snapshot.query_kind==="annual"?["years"]:[snapshot.query_kind==="municipality"?"municipalities":snapshot.query_kind],
  extraido_en:snapshot.extracted_at,cache:true,fuente:snapshot.source_system,corte_oficial:snapshot.coverage?.corte_oficial||null,
  validacion:snapshot.coverage?.status||"unknown",validacion_nota:snapshot.coverage?.review_summary||null,
  oficial_corte_verificado:snapshot.coverage?.official_cut_verified===true,snapshot_id:snapshot.id};
}
async function requestQuery(body,user,req){
 let params;
 try{params=await validateParams(body,user)}catch(e){return send(req,{error:e.message},400)}
 const hash=await sha256(JSON.stringify(params));
 const snapshot=await getPublished(hash,user);
 if(snapshot)return send(req,asCube(snapshot));
 const pending=await db("GET","cahos_snapshots?select=id,query_hash,query_kind,result_rows,extracted_at,source_system,coverage,publication_status&query_hash=eq."+hash+"&publication_status=eq.pending&limit=1");
 if(pending.length){
  if(Array.isArray(pending[0].result_rows)&&pending[0].result_rows.length===0)
    return send(req,{status:"no_data",reason:"no_rows_returned_by_cube",source:"SINAVE_OLAP",
      message:"El cubo no devolvió filas para este miembro y filtros. Esto NO significa cero casos. Prueba otra categoría seleccionándola explícitamente."});
  if(user.isMaster===true){
   return send(req,{...asCube(pending[0]),provisional:true,publication_status:"pending",
     warning:"VISTA PRELIMINAR PARA ADMINISTRADOR MAESTRO. Datos SIN validar ni autorizados para publicación."});
  }
  return send(req,{status:"awaiting_review",message:"Resultado extraído, pendiente de validación epidemiológica."},202);
 }
 const active=await db("GET","cahos_jobs?select=id,state&query_hash=eq."+hash+"&state=in.(queued,running)&limit=1");
 if(active.length)return send(req,{status:active[0].state,job_id:active[0].id},202);
 // Protect the institutional OLAP connection from browser polling after a failed job.
 const failures=await db("GET","cahos_jobs?select=id,error_code,finished_at&query_hash=eq."+hash+
   "&state=eq.failed&order=finished_at.desc&limit=1");
 if(failures.length){
   const failedAt=Date.parse(failures[0].finished_at||"");
   const retryAt=failedAt+15*60*1000;
   if(Number.isFinite(retryAt)&&Date.now()<retryAt)
    return send(req,{status:"failed",job_id:failures[0].id,
      error_code:failures[0].error_code||"extractor_error",
      failed_at:failures[0].finished_at,retry_after:new Date(retryAt).toISOString(),
      message:"El cubo no completó la última consulta. Se suspendieron las repeticiones durante 15 minutos."});
 }
 let inserted;
 try{inserted=await db("POST","cahos_jobs",[{query_hash:hash,query_kind:params.kind,entity_code:"26",request_params:params,requester_id:user.userId}]);}
 catch(_e){
  const existing=await db("GET","cahos_jobs?select=id,state&query_hash=eq."+hash+"&state=in.(queued,running)&limit=1");
  if(!existing.length)throw _e;
  inserted=existing;
 }
 return send(req,{status:"queued",job_id:inserted[0].id},202);
}
async function claimJob(user,req){
 const now=dateISO();
 let rows=await db("GET","cahos_jobs?select=*&state=eq.queued&attempts=lt.3&order=created_at.asc&limit=1");
 let isExpired=false;
 if(!rows.length){rows=await db("GET","cahos_jobs?select=*&state=eq.running&lease_until=lt."+eq(now)+"&attempts=lt.3&order=created_at.asc&limit=1");isExpired=true;}
 if(!rows.length)return send(req,{job:null});
 const j=rows[0],lease=new Date(Date.now()+6*60*1000).toISOString();
 const patchRoute="cahos_jobs?id=eq."+j.id+"&state=eq."+(isExpired?"running":"queued")+(isExpired?"&lease_until=lt."+eq(now):"");
 const updated=await db("PATCH",patchRoute,{state:"running",started_at:now,lease_until:lease,agent_id:user.agentId,attempts:j.attempts+1});
 if(updated.length!==1)return send(req,{job:null});
 return send(req,{job:{id:j.id,params:j.request_params,attempts:j.attempts+1}});
}

function technicalReview(rows,job){
 const p=job.request_params||{},kind=job.query_kind;
 const issues=[];
 const axis=kind==="weekly"?["years","weeks"]:kind==="annual"?["years"]:
   kind==="municipality"?["municipalities"]:kind==="institution"?["institutions"]:[kind];
 if(rows.length===0)issues.push("empty_result");
 const expectedYears=new Set((Array.isArray(p.years)?p.years:[]).map(x=>{
  const m=String(x).match(/&\[([0-9]{4})\]$/);return m?m[1]:null;
 }));
 const seen=new Set();
 let sum=0,nonzero=0,missingMeasures=0;
 for(const row of rows){
  if(row.cases===null){
   // Celda sin número en una extracción existente: 0 para suma, con procedencia.
   missingMeasures++;
  }else if(!Number.isSafeInteger(row.cases)||row.cases<0){
   issues.push("invalid_measure");break;
  }
  sum+=row.cases===null?0:row.cases;if(row.cases>0)nonzero++;
  const coords=[];
  for(const col of axis){
   if(typeof row[col]!=="string"||!row[col].trim()){issues.push("missing_axis");break;}
   coords.push(row[col]);
  }
  const key=JSON.stringify(coords);
  if(seen.has(key))issues.push("duplicate_axis");
  seen.add(key);
  if((kind==="annual"||kind==="weekly")&&!expectedYears.has(row.years))issues.push("unexpected_year");
  if(kind==="weekly"&&(!/^\d{1,2}$/.test(row.weeks||"")||
     Number(row.weeks)<Number(p.week_start??1)||Number(row.weeks)>Number(p.week_end??53)))
   issues.push("unexpected_week");
 }
 if(sum>1e10)issues.push("measure_total_limit");
 // Municipal and institutional cells require additional privacy review. Never auto-release.
 const sensitive=kind==="municipality"||kind==="institution";
 if(sensitive)issues.push("privacy_review_required");
 return {passed:issues.length===0,issues:[...new Set(issues)],
  row_count:rows.length,measure_sum:sum,nonzero_rows:nonzero,missing_measures_imputed_zero:missingMeasures,missing_measure_provenance:"null_only"};
}

function cleanRows(rows){
 if(!Array.isArray(rows)||rows.length>7500)throw new Error("invalid_result_rows");
 const allowedFields=new Set(["years","weeks","sex","age","institutions","municipalities","municipalities_id","cases"]);
 return rows.map(row=>{
  requireObject(row);
  const obj={};
  for(const [key,val] of Object.entries(row)){
   if(!allowedFields.has(key))continue;
   if(key==="cases"){
    if(val===null)obj.cases=null;
    else if(typeof val==="number"&&Number.isFinite(val)&&val>=0&&val<=1e9)obj.cases=val;
    else throw new Error("invalid_case_measure");
   } else {
    if(typeof val!=="string"||val.length>250)throw new Error("invalid_dimension_label");
    obj[key]=val;
   }
  }
  if(!Object.hasOwn(obj,"cases"))throw new Error("missing_case_measure");
  return obj;
 });
}
async function commitResult(user,data,req){
 if(!uuid(data.job_id))return send(req,{error:"invalid_job_id"},400);
 const found=await db("GET","cahos_jobs?select=*&id=eq."+data.job_id+"&agent_id=eq."+user.agentId+"&state=eq.running&limit=1");
 const job=found[0];if(!job)return send(req,{error:"job_not_assigned"},409);
 if(data.error){
  const errorCode=String(data.error).replace(/[^a-z0-9_-]/gi,"").slice(0,60)||"extractor_error";
  await db("PATCH","cahos_jobs?id=eq."+job.id+"&state=eq.running",{state:"failed",error_code:errorCode,finished_at:dateISO(),lease_until:null});
  return send(req,{ok:true,state:"failed"});
 }
 const result=requireObject(data.result);
 const rows=cleanRows(result.rows);
 if(result.axes&&!Array.isArray(result.axes))return send(req,{error:"invalid_result_axes"},400);
 const review=technicalReview(rows,job);
 const reviewDate=dateISO();
 const coverage={status:rows.length===0?"source_no_rows":
     review.passed?"technical_consistency_checked":"technical_review_required",
  corte_oficial:result.corte_oficial??null,official_cut_verified:false,
  review_method:"server_side_rules_v1",reviewed_at:reviewDate,
  review_summary:rows.length===0?"Consulta ejecutada sin filas del cubo; NO equivale a cero casos.":
    review.passed?"Integridad interna comprobada; corte oficial no certificado.":"Resultado retenido por control técnico o privacidad.",
  internal_check:review};
 const publication=review.passed?"approved":"pending";
 const saved=await db("POST","cahos_snapshots?on_conflict=query_hash",[{query_hash:job.query_hash,query_kind:job.query_kind,pathology_id:job.request_params.pathology,entity_code:job.entity_code,filter_params:job.request_params,result_rows:rows,coverage,source_system:"SINAVE_OLAP",extracted_at:dateISO(),publication_status:publication,approved_by:null,approved_at:review.passed?reviewDate:null}],"resolution=merge-duplicates,return=representation");
 const snapshot=saved[0];
 await db("PATCH","cahos_jobs?id=eq."+job.id+"&agent_id=eq."+user.agentId+"&state=eq.running",{state:"done",result_snapshot_id:snapshot.id,finished_at:dateISO(),lease_until:null});
 await db("POST","cahos_sync_state?on_conflict=worker_name",[{worker_name:"ca-agent-"+user.agentId.slice(0,8),status:"idle",last_success_at:dateISO(),last_attempt_at:dateISO(),updated_at:dateISO()}],"resolution=merge-duplicates,return=representation");
 return send(req,{ok:true,state:review.passed?"technical_checked":"restricted_pending_review",
  review_issues:review.issues,snapshot_id:snapshot.id});
}
async function catalogSync(user,data,req){
 const dim=data.dimension;
 if(!DIMS.has(dim)||!Array.isArray(data.members)||data.members.length>4000||data.members.length===0)return send(req,{error:"invalid_catalog_batch"},400);
 const unique=new Map();
 for(const m of data.members){
  if(!m||!id(m.id)||typeof m.nombre!=="string"||m.nombre.length<1||m.nombre.length>250)return send(req,{error:"invalid_catalog_member"},400);
  unique.set(m.id,{dimension:dim,member_id:m.id,label:m.nombre,refreshed_at:dateISO()});
 }
 const rows=[...unique.values()];
 for(let i=0;i<rows.length;i+=500)await db("POST","cahos_catalog?on_conflict=dimension,member_id",rows.slice(i,i+500),"resolution=merge-duplicates,return=minimal");
 return send(req,{ok:true,stored:rows.length,dimension:dim});
}
async function handler(req){
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(req)});
 const url=new URL(req.url),s=url.pathname;
 const i=s.indexOf("/cahos-api");
 const path=i>=0?(s.slice(i+10)||"/"):s;
 if(path==="/health"&&req.method==="GET"){
  let worker="not_connected",dataAvailable=false;
  if(BASE&&SERVICE_KEY){
   try{
    const rows=await db("GET","cahos_sync_state?select=last_attempt_at,status&order=last_attempt_at.desc&limit=1");
    if(rows.length){
     const age=Date.now()-Date.parse(rows[0].last_attempt_at||"");
     worker=Number.isFinite(age)&&age>=0&&age<180000?"online":"offline";
    }
    const approved=await db("GET","cahos_snapshots?select=id&publication_status=eq.approved&limit=1");
    dataAvailable=approved.length>0;
   }catch{worker="unknown"}
  }
  return send(req,{ok:true,service:"CAHOS cloud API",version:"0.3",phase:"protected_agent_pipeline",worker,epidemiological_data_available:dataAvailable});
 }
 if(!BASE||!PUBLIC_KEY||!SERVICE_KEY)return send(req,{error:"backend_configuration_pending"},503);
 const user=await identity(req);
 if(!allowed(user))return send(req,{error:user?"access_not_approved":"authentication_required"},user?403:401);
 if(path==="/api/status"&&req.method==="GET"){
  if(user.role==="agent")return send(req,{error:"not_a_viewer"},403);
  const [state,fav]=await Promise.all([db("GET","cahos_sync_state?select=worker_name,last_success_at,last_attempt_at,status&limit=10"),db("GET","cahos_favorites?select=pathology_id&user_id=eq."+user.userId+"&limit=25")]);
  return send(req,{version:"cloud-0.3",modo:"supabase_protected",servidor:"SINAVE via CAHOS Agent",catalogo:"Cubo_2003_Actual",intervalo_minutos:360,favoritos:fav.map(x=>x.pathology_id),favoritos_inicializados:true,
    actividad:{ultima_consulta:state[0]?.last_success_at||null,ultima_extraccion_automatica:state[0]?.last_success_at||null,ultimo_error:null},estado_agente:state.length?state:"not_paired"});
 }
 if(path==="/api/catalog"&&req.method==="GET"){
  if(user.role==="agent")return send(req,{error:"not_a_viewer"},403);
  const dim=url.searchParams.get("dim");if(!DIMS.has(dim))return send(req,{error:"invalid_dimension"},400);
  const rows=await lookupCatalog(dim);return send(req,{dimension:dim,members:rows.map(x=>({id:x.member_id,nombre:x.label}))});
 }
 if(path==="/api/population/status"&&req.method==="GET"){
  if(user.role==="agent")return send(req,{error:"not_a_viewer"},403);
  const all=await db("GET","cahos_population?select=year,population_total,source_sha256&order=year.asc&limit=1500");
  const grouped={};for(const row of all){
   const key=String(row.year);if(!grouped[key])grouped[key]={municipalities:0,population:0,hashes:[]};
   grouped[key].municipalities++;grouped[key].population+=Number(row.population_total);
   if(!grouped[key].hashes.includes(row.source_sha256))grouped[key].hashes.push(row.source_sha256);
  }
  const years=Object.entries(grouped).map(([year,v])=>({year:Number(year),
   municipalities:v.municipalities,total:v.population,complete:v.municipalities===72&&v.hashes.length===1}));
  return send(req,{available:years.length>0,years,expected_municipalities:72,
   source:"COESPO/CONAPO Proyecciones municipales Sonora 2015-2030",precision:"grupo_quinquenal_y_65_mas"});
 }
 if(path==="/api/population/trend"&&req.method==="GET"){
  if(user.role==="agent")return send(req,{error:"not_a_viewer"},403);
  const code=url.searchParams.get("municipality");
  if(!code||!/^26[0-9]{3}$/.test(code))return send(req,{error:"invalid_municipality_code"},400);
  const rows=await db("GET","cahos_population?select=year,population_total,municipality_name,source_sha256&municipality_code=eq."+code+"&order=year.asc&limit=20");
  return send(req,{municipality:code,rows});
 }
 if(path==="/api/population"&&req.method==="GET"){
  if(user.role==="agent")return send(req,{error:"not_a_viewer"},403);
  const year=Number(url.searchParams.get("year"));
  if(!Number.isInteger(year)||year<2015||year>2030)return send(req,{error:"invalid_population_year"},400);
  const entries=await db("GET","cahos_population?select=year,municipality_code,municipality_name,female,male,population_total,source,source_sha256&year=eq."+year+"&order=municipality_code.asc&limit=100");
  if(entries.length!==72||new Set(entries.map(x=>x.source_sha256)).size!==1)
   return send(req,{available:false,year,municipalities:entries.length,reason:"population_year_incomplete"},200);
  const code=url.searchParams.get("municipality");
  const selected=code?entries.filter(x=>x.municipality_code===code):entries;
  if(code&&!/^26[0-9]{3}$/.test(code))return send(req,{error:"invalid_municipality_code"},400);
  return send(req,{available:true,year,source:entries[0].source,source_sha256:entries[0].source_sha256,
   municipality_count:72,precision:"quinquenios_y_65_mas",rows:selected});
 }

 if(path==="/api/query"&&req.method==="POST")return await requestQuery(await req.json(),user,req);
 if(path.startsWith("/api/jobs/")&&req.method==="GET"){
  const jobId=path.split("/").pop();if(!uuid(jobId))return send(req,{error:"invalid_job_id"},400);
  const j=(await db("GET","cahos_jobs?select=id,state,requester_id,result_snapshot_id,error_code&limit=1&id=eq."+jobId))[0];
  if(!j||!(j.requester_id===user.userId||user.role==="admin"))return send(req,{error:"job_not_found"},404);
  if(j.state==="done"&&j.result_snapshot_id){
   const a=await db("GET","cahos_snapshots?select=*&id=eq."+j.result_snapshot_id+"&limit=1");
   if(!a.length)return send(req,{status:"result_unavailable",message:"La extracción terminó pero no tiene snapshot."});
   if(Array.isArray(a[0].result_rows)&&a[0].result_rows.length===0)
     return send(req,{status:"no_data",reason:"no_rows_returned_by_cube",source:"SINAVE_OLAP",
       message:"La extracción finalizó sin filas. No equivale a cero casos ni a una categoría epidemiológica sustituta."});
   if(a[0].publication_status==="approved")return send(req,{status:"ready",result:asCube(a[0])});
   if(user.isMaster===true)return send(req,{status:"ready",result:{
     ...asCube(a[0]),provisional:true,publication_status:"pending",
     warning:"VISTA PRELIMINAR PRIVADA. No constituye un corte epidemiológico oficial."}});
   return send(req,{status:"awaiting_review",
     message:"La extracción municipal continúa restringida por controles de privacidad."});
  }
  if(j.state==="failed")return send(req,{status:"failed",
    error_code:j.error_code||"extractor_error",
    message:"El extractor local no completó esta consulta. No se volverá a ejecutar automáticamente."});
  return send(req,{status:j.state,error_code:j.error_code||null});
 }
 if(path==="/api/favorites"&&req.method==="POST"){
  const body=requireObject(await req.json());const fav=body.favoritos;
  if(!Array.isArray(fav)||fav.length>25||fav.some(x=>!id(x)))return send(req,{error:"invalid_favorites"},400);
  const valid=new Set((await lookupCatalog("pathologies")).map(x=>x.member_id));
  if(fav.some(x=>!valid.has(x)))return send(req,{error:"favorites_not_in_catalog"},400);
  await db("DELETE","cahos_favorites?user_id=eq."+user.userId,null,"return=minimal");
  if(fav.length)await db("POST","cahos_favorites",[...new Set(fav)].map(x=>({user_id:user.userId,pathology_id:x})));
  return send(req,{favoritos:[...new Set(fav)]});
 }
 if(path==="/api/refresh"&&req.method==="POST")return send(req,{error:"manual_refresh_scheduling_pending"},503);
 if(path==="/worker/catalog"&&req.method==="POST"){
  if(user.role!=="agent"||!user.agentId)return send(req,{error:"agent_only"},403);
  return await catalogSync(user,requireObject(await req.json()),req);
 }
 if(path==="/worker/poll"&&req.method==="POST"){
  if(user.role!=="agent"||!user.agentId)return send(req,{error:"agent_only"},403);
  return await claimJob(user,req);
 }
 if(path==="/worker/result"&&req.method==="POST"){
  if(user.role!=="agent"||!user.agentId)return send(req,{error:"agent_only"},403);
  return await commitResult(user,requireObject(await req.json()),req);
 }
 if(path==="/worker/heartbeat"&&req.method==="POST"){
  if(user.role!=="agent"||!user.agentId)return send(req,{error:"agent_only"},403);
  await db("POST","cahos_sync_state?on_conflict=worker_name",[{worker_name:"ca-agent-"+user.agentId.slice(0,8),status:"running",last_attempt_at:dateISO(),updated_at:dateISO()}],"resolution=merge-duplicates,return=minimal");
  return send(req,{ok:true});
 }
 if(path==="/admin/population/import"&&req.method==="POST"){
  if(user.role!=="admin"||!user.isMaster)return send(req,{error:"master_admin_only"},403);
  const body=requireObject(await req.json()),rows=body.rows,year=Number(body.year);
  const sourceHash=String(body.source_sha256||"");
  if(!Number.isInteger(year)||year<2015||year>2030||!/^[a-f0-9]{64}$/.test(sourceHash)||
     !Array.isArray(rows)||rows.length!==72)return send(req,{error:"invalid_population_batch"},400);
  const bands=["00_04","05_09","10_14","15_19","20_24","25_29","30_34","35_39","40_44","45_49","50_54","55_59","60_64","65_mm"];
  const names=new Set(),prepared=[];
  for(const item of rows){
   if(!item||Number(item.year)!==year||typeof item.code!=="string"||!/^26[0-9]{3}$/.test(item.code)||
     typeof item.name!=="string"||item.name.trim().length<2||item.name.length>100||
     names.has(item.code))return send(req,{error:"invalid_population_identity"},400);
   names.add(item.code);
   let total=0;
   for(const sex of ["M","H"]){
    const block=item[sex];
    if(!block||typeof block!=="object"||Object.keys(block).length!==14||
       bands.some(key=>!Number.isSafeInteger(block[key])||block[key]<0||block[key]>1e7))
       return send(req,{error:"invalid_population_age_sex"},400);
    for(const key of bands)total+=block[key];
   }
   if(total!==item.total||total<=0||total>1e7)return send(req,{error:"invalid_population_total"},400);
   prepared.push({year,municipality_code:item.code,municipality_name:item.name,
    female:item.M,male:item.H,population_total:total,
    source:"COESPO/CONAPO Sonora, Proyecciones municipales 2015-2030",source_sha256:sourceHash});
  }
  const existing=await db("GET","cahos_population?select=year,source_sha256&year=eq."+year+"&limit=100");
  if(existing.length&&existing.some(x=>x.source_sha256!==sourceHash))
   return send(req,{error:"year_already_loaded_from_different_source"},409);
  await db("POST","cahos_population?on_conflict=year,municipality_code",prepared,
   "resolution=merge-duplicates,return=minimal");
  return send(req,{ok:true,year,municipalities:prepared.length,
    population:prepared.reduce((n,r)=>n+r.population_total,0),source_sha256:sourceHash});
 }

 if(path==="/admin/create-agent"&&req.method==="POST"){
  if(user.isMaster!==true)return send(req,{error:"master_admin_only"},403);
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const token=[...bytes].map(x=>x.toString(16).padStart(2,"0")).join("");
  const hash=await sha256(token);
  const added=await db("POST","cahos_agents",[{token_hash:hash,label:"CAHOS Windows Agent",created_by:user.userId}]);
  return send(req,{agent_id:added[0].id,token,warning:"Copie el token una sola vez en el Windows autorizado. No estará disponible nuevamente."},201);
 }
 if(path==="/admin/revoke-agent"&&req.method==="POST"){
  if(user.isMaster!==true)return send(req,{error:"master_admin_only"},403);
  const body=requireObject(await req.json());if(!uuid(body.agent_id))return send(req,{error:"invalid_agent_id"},400);
  const changed=await db("PATCH","cahos_agents?id=eq."+body.agent_id+"&created_by=eq."+user.userId+"&enabled=eq.true",
    {enabled:false,revoked_at:dateISO()});
  if(changed.length!==1)return send(req,{error:"agent_not_found"},404);
  return send(req,{ok:true});
 }
 if(path.startsWith("/admin/snapshot/")&&req.method==="GET"){
  if(user.role!=="admin")return send(req,{error:"admin_only"},403);
  const snapId=path.split("/").pop();
  if(!uuid(snapId))return send(req,{error:"invalid_snapshot"},400);
  const rows=await db("GET","cahos_snapshots?select=id,query_kind,filter_params,result_rows,coverage,extracted_at,publication_status&limit=1&id=eq."+snapId);
  if(!rows.length)return send(req,{error:"snapshot_not_found"},404);
  const snapshot=rows[0],entries=snapshot.result_rows;
  const total=entries.filter(x=>x.cases!==null&&Number.isFinite(x.cases)).reduce((a,x)=>a+x.cases,0);
  return send(req,{id:snapId,query_kind:snapshot.query_kind,filter_params:snapshot.filter_params,
    coverage:snapshot.coverage,extracted_at:snapshot.extracted_at,publication_status:snapshot.publication_status,
    rows_count:entries.length,sum_cases:total,preview:entries.slice(0,20),
    ...(url.searchParams.get("full")==="1"?{rows:entries}:{})});
 }
 if(path==="/admin/agents"&&req.method==="GET"){
  if(user.isMaster!==true)return send(req,{error:"master_admin_only"},403);
  const agents=await db("GET","cahos_agents?select=id,label,enabled,created_at,last_seen_at,revoked_at&order=created_at.desc&limit=20");
  return send(req,{agents});
 }
 if(path==="/admin/quality-report"&&req.method==="GET"){
  if(user.role!=="admin")return send(req,{error:"admin_only"},403);
  const snapshots=await db("GET",
   "cahos_snapshots?select=id,query_kind,pathology_id,entity_code,filter_params,extracted_at,coverage,publication_status,approved_at&order=extracted_at.desc&limit=150");
  return send(req,{snapshots,scope:"authenticated_cahos_users_only",
   warning:"Control técnico interno; no acredita el corte oficial epidemiológico."});
 }
 if(path==="/admin/pending"&&req.method==="GET"){
  if(user.role!=="admin")return send(req,{error:"admin_only"},403);
  const snapshots=await db("GET","cahos_snapshots?select=id,query_kind,pathology_id,entity_code,filter_params,extracted_at,coverage&publication_status=eq.pending&order=extracted_at.desc&limit=30");
  return send(req,{snapshots});
 }
 if(path==="/admin/approve"&&req.method==="POST"){
  if(user.role!=="admin")return send(req,{error:"admin_only"},403);
  const body=requireObject(await req.json());
  if(!uuid(body.snapshot_id))return send(req,{error:"invalid_snapshot"},400);
  const note=typeof body.review_note==="string"?body.review_note.trim():"";
  if(body.verified!==true||note.length<10||note.length>350)return send(req,{error:"Se requiere confirmación y una nota de validación (10 a 350 caracteres)."},400);
  const selected=await db("GET","cahos_snapshots?select=id,coverage,publication_status&id=eq."+body.snapshot_id+"&limit=1");
  if(!selected.length||selected[0].publication_status!=="pending")return send(req,{error:"snapshot_not_pending"},409);
  const coverage={...(selected[0].coverage||{}),status:"verified_by_administrator",
    validation_note:note.replace(/[\x00-\x1f]/g," "),validated_at:dateISO()};
  const approved=await db("PATCH","cahos_snapshots?id=eq."+body.snapshot_id+"&publication_status=eq.pending",
    {publication_status:"approved",coverage,approved_by:user.userId,approved_at:dateISO()});
  if(approved.length!==1)return send(req,{error:"snapshot_not_pending"},409);
  return send(req,{ok:true,approved_id:body.snapshot_id});
 }
 return send(req,{error:"unknown_route"},404);
}
Deno.serve(async(req)=>{
 try{return await handler(req)}catch(e){const m=String(e?.message||e);return send(req,{error:m.startsWith("db_")?"backend_database_error":m.startsWith("invalid_")?m:"backend_unavailable"},503)}
});
