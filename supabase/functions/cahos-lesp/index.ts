// CAHOS LESP protected service: aggregate-only, current-by-year, no nominal input.
// Dedicated function so existing SUIVE API deployment is not replaced.
const BASE=(Deno.env.get("SUPABASE_URL")||"").replace(/\/$/,"");
const PUBLISHABLE=Deno.env.get("SUPABASE_ANON_KEY")||
 (()=>{try{return JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}").default||""}catch{return""}})();
const SECRET=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||
 (()=>{try{return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||""}catch{return""}})();
const ALLOWED=new Set(["https://doctopanda.github.io","http://localhost:8789","http://127.0.0.1:8789"]);
const QUALITY_KEYS=new Set(["rows_inspected","other_epi_year","positive_disease_results",
 "no_conservative_positive_classification","duplicate_lab_key_excluded",
 "environmental_excluded","invalid_issue_date","unmapped_procedencia"]);
function response(req,obj,status=200){
 const origin=req.headers.get("origin")||"";
 const h=new Headers({"Content-Type":"application/json;charset=utf-8",
  "Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff","Vary":"Origin"});
 if(ALLOWED.has(origin)){
  h.set("Access-Control-Allow-Origin",origin);
  h.set("Access-Control-Allow-Headers","authorization,apikey,content-type");
  h.set("Access-Control-Allow-Methods","GET,POST,OPTIONS");
 }
 return new Response(JSON.stringify(obj),{status,headers:h});
}
function fail(code,http=400){const e=new Error(code);e.http=http;throw e;}
function apiKeyHeaders(key){return {"apikey":key,"authorization":"Bearer "+key,"Content-Type":"application/json"};}
async function db(method,path,data=null,prefer="return=representation"){
 if(!SECRET||!BASE)fail("service_not_configured",503);
 const h=apiKeyHeaders(SECRET);
 h.Prefer=prefer;
 const result=await fetch(BASE+"/rest/v1/"+path,{
  method,headers:h,...(data!==null?{body:JSON.stringify(data)}:{})
 });
 if(!result.ok)fail("protected_db_unavailable",503);
 const text=await result.text();
 if(!text)return [];
 try{return JSON.parse(text)}catch{fail("db_response_invalid",503)}
}
async function principal(req){
 const match=(req.headers.get("authorization")||"").match(/^Bearer (\S+)$/);
 if(!match||!PUBLISHABLE||!BASE)fail("authentication_required",401);
 const userRes=await fetch(BASE+"/auth/v1/user",{
  headers:{"apikey":PUBLISHABLE,"Authorization":"Bearer "+match[1]}
 });
 if(!userRes.ok)fail("authentication_required",401);
 const user=await userRes.json();
 if(!user?.id||!/^[0-9a-f-]{36}$/i.test(user.id))fail("authentication_required",401);
 const members=await db("GET","cahos_members?select=role,is_master,enabled,entity_code&user_id=eq."+user.id+"&limit=1");
 const m=members[0];
 if(!m?.enabled||m.is_master!==true)fail("master_admin_only",403);
 return {userId:user.id,role:m.role,entity:m.entity_code};
}
function yearValue(text){
 const n=Number(text);
 if(!Number.isInteger(n)||n<2020||n>2100)fail("invalid_epi_year");
 return n;
}
function hashText(bytes){return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,"0")).join("");}
async function fingerprint(rows){
 const input=new TextEncoder().encode(JSON.stringify(rows));
 return hashText(await crypto.subtle.digest("SHA-256",input));
}
function canonicalize(payload){
 if(payload?.schema!=="cahos-lesp-aggregates-v1"||
    payload?.data_classification!=="PRIVATE_AGGREGATE_DO_NOT_PUBLISH"||
    !Array.isArray(payload.rows)||!payload.rows.length||payload.rows.length>12000)
   fail("invalid_private_aggregate");
 const rows=[],seen=new Set();
 let total=0,year=null;
 for(const item of payload.rows){
  if(!item||typeof item!=="object"||Array.isArray(item)||
    Object.keys(item).some(k=>!["year","week","municipality","pathology","positive_lab_results"].includes(k)))
   fail("invalid_aggregate_columns");
  const y=yearValue(item.year),w=Number(item.week),count=Number(item.positive_lab_results);
  const municipality=typeof item.municipality==="string"?item.municipality.normalize("NFC").trim().toLocaleUpperCase("es-MX"):"";
  const pathology=typeof item.pathology==="string"?item.pathology.normalize("NFC").trim():"";
  if(!Number.isSafeInteger(w)||w<1||w>53||
     !Number.isSafeInteger(count)||count<0||count>1000000||
     municipality.length<2||municipality.length>110||pathology.length<2||pathology.length>110)
    fail("invalid_aggregate_measure");
  if(year!==null&&y!==year)fail("mixed_epi_years");year=y;
  const key=[y,w,municipality,pathology].join("\u001F");
  if(seen.has(key))fail("duplicate_aggregate_cell");seen.add(key);
  total+=count;
  if(!Number.isSafeInteger(total))fail("aggregate_total_overflow");
  rows.push({year:y,week:w,municipality,pathology,positive_lab_results:count});
 }
 rows.sort((a,b)=>a.year-b.year||a.week-b.week||
    a.municipality.localeCompare(b.municipality,"es")||
    a.pathology.localeCompare(b.pathology,"es"));
 const quality={};
 if(payload.quality!==undefined){
  if(!payload.quality||typeof payload.quality!=="object"||Array.isArray(payload.quality))
   fail("invalid_quality_metadata");
  for(const [key,val] of Object.entries(payload.quality)){
   if(!QUALITY_KEYS.has(key)||!Number.isSafeInteger(val)||val<0||val>1e9)
    fail("invalid_quality_metadata");
   quality[key]=val;
  }
 }
 const source=(typeof payload.source==="string"?payload.source:"LESP Sonora · agregado protegido").trim();
 if(source.length<3||source.length>160)fail("invalid_source_label");
 return {rows,total,year,quality,source,
  first:Math.min(...rows.map(r=>r.week)),last:Math.max(...rows.map(r=>r.week))};
}
async function activeFor(year){
 const a=await db("GET","cahos_lesp_active?select=version_id&epi_year=eq."+year+"&limit=1");
 if(!a.length)return null;
 const v=await db("GET","cahos_lesp_versions?select=id,epi_year,source_hash,source_label,coverage_start,coverage_end,row_count,positive_total,quality,status,published_at&id=eq."+a[0].version_id+"&limit=1");
 return v[0]||null;
}
async function rowsFor(versionId){
 const rows=[];
 for(let offset=0;offset<=30000;offset+=500){
  const chunk=await db("GET","cahos_lesp_counts?select=epi_year,epi_week,municipality,pathology,positive_lab_results&version_id=eq."+
   versionId+"&order=epi_week.asc,municipality.asc,pathology.asc&limit=500&offset="+offset);
  if(!Array.isArray(chunk))fail("db_response_invalid",503);
  rows.push(...chunk);
  if(chunk.length<500)break;
 }
 return rows.map(r=>({year:r.epi_year,week:r.epi_week,
  municipality:r.municipality,pathology:r.pathology,positive_lab_results:r.positive_lab_results}));
}
async function readSnapshot(req,url){
 const year=yearValue(url.searchParams.get("year"));
 const v=await activeFor(year);
 if(!v)return response(req,{status:"not_imported",year,rows:[]});
 const rows=await rowsFor(v.id);
 if(rows.length!==v.row_count||rows.reduce((a,r)=>a+r.positive_lab_results,0)!==Number(v.positive_total))
  fail("active_aggregate_integrity_error",503);
 return response(req,{
  status:"ready",schema:"cahos-lesp-aggregates-v1",
  data_classification:"PRIVATE_AGGREGATE_DO_NOT_PUBLISH",
  source:v.source_label,quality:v.quality,rows,
  metadata:{year,version_id:v.id,source_hash:v.source_hash,
   published_at:v.published_at,row_count:v.row_count,positive_total:v.positive_total,
   observed_last_positive_week:v.coverage_end,
   caveat:"Positive laboratory results are not automatically confirmed surveillance cases."}
 });
}
async function storeSnapshot(req,actor){
 const raw=await req.text();
 if(raw.length>2200000)fail("aggregate_payload_too_large",413);
 let parsed;
 try{parsed=JSON.parse(raw)}catch{fail("invalid_json")}
 if(parsed.confirm_full_year_snapshot!==true)fail("complete_year_snapshot_confirmation_required");
 const clean=canonicalize(parsed);
 const digest=await fingerprint(clean.rows);
 const active=await activeFor(clean.year);
 if(active?.source_hash===digest)return response(req,{status:"unchanged",year:clean.year,
  version_id:active.id,row_count:clean.rows.length,positive_total:clean.total});
 if(active&&clean.last<active.coverage_end)
  fail("older_partial_snapshot_would_erase_newer_weeks",409);
 const existing=await db("GET","cahos_lesp_versions?select=id,status&epi_year=eq."+clean.year+
  "&source_hash=eq."+digest+"&limit=1");
 if(existing[0]?.status!=="staging"&&existing.length)fail("previously_imported_version",409);
 const id=existing[0]?.id||crypto.randomUUID();
 if(!existing.length){
  await db("POST","cahos_lesp_versions",[{
   id,epi_year:clean.year,source_hash:digest,source_label:clean.source,
   coverage_start:clean.first,coverage_end:clean.last,
   row_count:clean.rows.length,positive_total:clean.total,quality:clean.quality,
   imported_by:actor.userId,status:"staging"
  }],"return=minimal");
 }
 // Resume a failed staging import using its version id, without affecting active rows.
 await db("DELETE","cahos_lesp_counts?version_id=eq."+id,null,"return=minimal");
 for(let i=0;i<clean.rows.length;i+=300){
  const batch=clean.rows.slice(i,i+300).map(x=>({
   version_id:id,epi_year:x.year,epi_week:x.week,municipality:x.municipality,
   pathology:x.pathology,positive_lab_results:x.positive_lab_results
  }));
  await db("POST","cahos_lesp_counts?on_conflict=version_id,epi_year,epi_week,municipality,pathology",
   batch,"resolution=merge-duplicates,return=minimal");
 }
 const verify=await rowsFor(id);
 const validated=canonicalize({schema:"cahos-lesp-aggregates-v1",
  data_classification:"PRIVATE_AGGREGATE_DO_NOT_PUBLISH",
  source:clean.source,rows:verify});
 if(verify.length!==clean.rows.length||validated.total!==clean.total||
  await fingerprint(validated.rows)!==digest)
  fail("staging_validation_failed",503);
 await db("PATCH","cahos_lesp_versions?id=eq."+id,
  {status:"ready",published_at:new Date().toISOString()},"return=minimal");
 await db("POST","cahos_lesp_active?on_conflict=epi_year",[{
  epi_year:clean.year,version_id:id,updated_at:new Date().toISOString(),updated_by:actor.userId
 }],"resolution=merge-duplicates,return=minimal");
 await db("POST","cahos_lesp_audit",[{
  epi_year:clean.year,event_type:active?"publish":"initial_load",source_hash:digest,
  affected_rows:clean.rows.length,positive_total:clean.total,actor_id:actor.userId,
  note:"Full annual aggregate replacement; previous row data removed after activation"
 }],"return=minimal");
 let cleanupPending=false;
 if(active?.id&&active.id!==id){
  try{
   await db("DELETE","cahos_lesp_counts?version_id=eq."+active.id,null,"return=minimal");
   await db("PATCH","cahos_lesp_versions?id=eq."+active.id,
    {status:"retired"},"return=minimal");
  }catch{cleanupPending=true;}
 }
 return response(req,{status:"published",year:clean.year,version_id:id,
  source_hash:digest,row_count:clean.rows.length,positive_total:clean.total,
  previous_rows_retired:!!active?.id&&!cleanupPending,
  cleanup_pending:cleanupPending,preliminary:true});
}
Deno.serve(async(req)=>{
 try{
  if(req.method==="OPTIONS")return response(req,{ok:true});
  const url=new URL(req.url);
  if(url.pathname.endsWith("/health")&&req.method==="GET")
   return response(req,{status:"ok",private:true});
  const actor=await principal(req);
  if(url.pathname.endsWith("/snapshot")&&req.method==="GET")
   return await readSnapshot(req,url);
  if(url.pathname.endsWith("/import")&&req.method==="POST")
   return await storeSnapshot(req,actor);
  return response(req,{error:"not_found"},404);
 }catch(e){
  const known=["authentication_required","master_admin_only","service_not_configured",
   "protected_db_unavailable","db_response_invalid","invalid_epi_year",
   "invalid_private_aggregate","invalid_aggregate_columns","invalid_aggregate_measure",
   "mixed_epi_years","duplicate_aggregate_cell","aggregate_total_overflow",
   "invalid_quality_metadata","invalid_source_label","active_aggregate_integrity_error",
   "aggregate_payload_too_large","invalid_json","complete_year_snapshot_confirmation_required",
   "older_partial_snapshot_would_erase_newer_weeks","previously_imported_version",
   "staging_validation_failed"];
  const msg=String(e?.message||"");
  return response(req,{error:known.includes(msg)?msg:"protected_lesp_error"},
   Number.isInteger(e?.http)?e.http:503);
 }
});
