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
# The scheduled-task environment may not provide LOCALAPPDATA consistently.
# The installer always places this agent in <LocalAppData>/CAHOS/cloud.
# Derive the private state directory from the installed script location.
PRIVATE = APP.parent if APP.name.lower() == "cloud" else (
    Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "CAHOS"
)
PRIVATE.mkdir(parents=True, exist_ok=True)
TOKEN_FILE = PRIVATE / "cloud_agent_token.txt"
STATE_FILE = PRIVATE / "cloud_agent_status.json"
DIAGNOSTIC_FILE = PRIVATE / "cloud_agent_diagnostic.log"
API = "https://lywrtuibmzzsylfbybqo.supabase.co/functions/v1/cahos-api"
PUBLIC_KEY = "sb_publishable_MW2u0v8hucbGgaW5Aol7lA_3mcoFhIy"
DIMENSIONS = ("pathologies","years","weeks","municipalities","entities","sex","age","institutions")
NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)

def diagnostic(event, exc=None):
    """Minimal local diagnostics. Never log token, MDX, HTTP headers or exceptions' text."""
    try:
        code = type(exc).__name__ if exc is not None else "none"
        winerror = getattr(exc, "winerror", None)
        record = {"at": datetime.now(timezone.utc).isoformat(),
                  "event": str(event)[:45], "error_type": code,
                  "winerror": winerror if isinstance(winerror, int) else None}
        with DIAGNOSTIC_FILE.open("a", encoding="utf-8") as out:
            out.write(json.dumps(record, ensure_ascii=False) + "\n")
    except OSError:
        pass


def state(status, message):
    output = {"status": status, "detail": str(message)[:130],
              "at": datetime.now(timezone.utc).isoformat()}
    content = json.dumps(output, ensure_ascii=False)
    dest = STATE_FILE.with_suffix(".tmp")
    try:
        dest.write_text(content, encoding="utf-8")
        dest.replace(STATE_FILE)
    except OSError as exc:
        diagnostic("atomic_status_write_failed", exc)
        try:
            STATE_FILE.write_text(content, encoding="utf-8")
        except OSError as fallback:
            diagnostic("fallback_status_write_failed", fallback)
            # An optional status display must never terminate a working OLAP agent.

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
        # The bridge emits a fixed code, never a raw provider exception.
        allowed={"local_query_validation_error","olap_result_axis_error",
                 "olap_measure_missing","olap_catalog_member_missing",
                 "olap_empty_provider_response","olap_query_timeout",
                 "local_olap_error"}
        try:
            failure=json.loads(result.stdout.strip())
            code=failure.get("code") if isinstance(failure,dict) else None
        except (ValueError,TypeError):
            code=None
        raise RuntimeError(code if code in allowed else "local_olap_error")
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
    except Exception as exc:
        # Only categorical codes are allowed in Supabase; no exception messages.
        safe_codes={"local_query_validation_error","olap_result_axis_error",
                    "olap_measure_missing","olap_catalog_member_missing",
                    "olap_empty_provider_response","olap_query_timeout",
                    "local_olap_error"}
        reason=str(exc)
        code=reason if reason in safe_codes else "local_olap_error"
        diagnostic("job_failed_"+code, exc)
        try:
            call("/worker/result", {"job_id":job_id,"error":code})
        except Exception:
            pass
        state("failed", "La consulta terminó con código "+code)

def run():
    diagnostic("agent_started")
    state("starting", "Arranque del agente CAHOS")
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
    try:
        run()
    except BaseException as fatal:
        diagnostic("agent_fatal_exit", fatal)
        state("fatal", type(fatal).__name__)
        raise

