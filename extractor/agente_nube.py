"""CAHOS Cloud Agent (Windows) | Polls a protected HTTPS queue. No inbound ports."""
from __future__ import annotations
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

APP = Path(__file__).resolve().parent
PRIVATE = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "CAHOS"
PRIVATE.mkdir(parents=True, exist_ok=True)
TOKEN_FILE = PRIVATE / "cloud_agent_token.txt"
STATE_FILE = PRIVATE / "cloud_agent_status.json"
API = "https://lywrtuibmzzsylfbybqo.supabase.co/functions/v1/cahos-api"
PUBLIC_KEY = "sb_publishable_MW2u0v8hucbGgaW5Aol7lA_3mcoFhIy"
DIMENSIONS = ("pathologies","years","weeks","municipalities","entities","sex","age","institutions")
NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)

def state(status, message):
    output = {"status": status, "detail": message[:130],
              "at": datetime.now(timezone.utc).isoformat()}
    dest = STATE_FILE.with_suffix(".tmp")
    dest.write_text(json.dumps(output, ensure_ascii=False), encoding="utf-8")
    dest.replace(STATE_FILE)

def agent_token():
    token = os.environ.get("CAHOS_AGENT_TOKEN", "").strip()
    if not token and TOKEN_FILE.is_file():
        token = TOKEN_FILE.read_text(encoding="utf-8").strip()
    if not re.fullmatch(r"[0-9a-fA-F]{64}", token):
        raise RuntimeError("agent_not_paired")
    return token

def call(path, payload):
    headers = {"Content-Type": "application/json", "Accept": "application/json",
               "apikey": PUBLIC_KEY, "Authorization": "Bearer " + agent_token()}
    req = urllib.request.Request(API + path, method="POST", headers=headers,
             data=json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8"))
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read(2_000_000).decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 403):
            raise RuntimeError("agent_authorization_failed")
        raise RuntimeError("cloud_api_error_" + str(exc.code))

def python_executable():
    e = Path(sys.executable)
    if e.name.lower().startswith("pythonw"):
        candidate = e.with_name(e.name.replace("pythonw", "python", 1))
        if candidate.is_file():
            return str(candidate)
    return str(e)

def extract(action, dimension=None, params=None):
    argv = [python_executable(), "-B", str(APP / "puente_agente_nube.py"), action]
    if dimension is not None:
        argv.append(dimension)
    result = subprocess.run(argv, input=None if params is None else json.dumps(params,ensure_ascii=False),
                 capture_output=True, text=True, encoding="utf-8", errors="replace",
                 timeout=160, cwd=str(APP), creationflags=NO_WINDOW)
    if result.returncode:
        raise RuntimeError("local_olap_error")
    try:
        out = json.loads(result.stdout)
    except (ValueError, TypeError):
        raise RuntimeError("local_bridge_invalid_response")
    if not isinstance(out, dict) or out.get("error"):
        raise RuntimeError("local_olap_error")
    return out

def refresh_catalog():
    state("catalog", "Consultando catálogos SINAVE autorizados")
    for dim in DIMENSIONS:
        members = extract("catalog", dimension=dim)["members"]
        if not members:
            raise RuntimeError("empty_catalog_" + dim)
        result = call("/worker/catalog", {"dimension":dim,"members":members})
        if result.get("ok") is not True:
            raise RuntimeError("remote_catalog_rejected")
    state("ready","Catálogos sincronizados")

def run_job(job):
    job_id = job["id"]
    kind = job.get("params", {}).get("kind", "?")
    state("extracting", "Consulta MDX " + str(kind))
    try:
        data = extract("query", params=job["params"])
        saved = call("/worker/result", {"job_id":job_id,"result":data})
        if saved.get("ok") is not True:
            raise RuntimeError("remote_result_rejected")
        state("pending_review", "Extracción entregada para validación epidemiológica")
    except Exception:
        try:
            call("/worker/result", {"job_id":job_id,"error":"local_olap_error"})
        except Exception:
            pass
        state("failed", "La consulta necesita revisión local; no se publicó")

def run():
    if os.name != "nt":
        raise RuntimeError("windows_only")
    if not (APP/"servidor.py").exists():
        raise RuntimeError("missing_local_extractor")
    agent_token()
    refresh_at = 0
    heartbeat_at = 0
    failures = 0
    while True:
        try:
            now = time.monotonic()
            if now >= refresh_at:
                refresh_catalog()
                refresh_at = time.monotonic() + 4*3600
            if now >= heartbeat_at:
                call("/worker/heartbeat", {})
                heartbeat_at = time.monotonic() + 60
            job = call("/worker/poll", {}).get("job")
            if job:
                run_job(job)
            else:
                state("online", "Conectado; esperando consultas validadas")
                time.sleep(15)
            failures=0
        except KeyboardInterrupt:
            break
        except Exception as exc:
            failures+=1
            reason=str(exc)
            if not re.fullmatch(r"[a-z_0-9]{3,90}",reason):
                reason="cloud_agent_error"
            state("error",reason)
            time.sleep(min(300, max(20,20*failures)))

if __name__=="__main__":
    run()
