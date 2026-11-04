"""CAHOS: read-only check of the installed agent's state directory.
No token, no OLAP query, no network operations, no agent restart.
"""
from __future__ import annotations
import importlib.util
import json
from pathlib import Path
import sys
import tempfile

def line(label, value):
    print(f"[{label}] {value}", flush=True)

def main():
    if len(sys.argv) != 2:
        line("ERROR", "Se requiere la ruta del agente instalado")
        return 2
    script = Path(sys.argv[1]).resolve(strict=True)
    if script.name.lower() != "agente_nube.py":
        line("ERROR", "Solo se admite agente_nube.py")
        return 2
    spec = importlib.util.spec_from_file_location("cahos_agent_local_probe", script)
    if spec is None or spec.loader is None:
        line("ERROR", "No fue posible cargar el modulo del agente")
        return 2
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # The agent's run() is guarded by __main__.
    state = Path(module.STATE_FILE)
    line("SCRIPT", str(script))
    line("RUTA MODULO", str(module.APP))
    line("RUTA ESTADO CALCULADA", str(state))
    line("ESTADO EXISTE", "SI" if state.is_file() else "NO")
    line("VERSION RUTA", "corregida" if module.PRIVATE == module.APP.parent else "alternativa")
    if state.is_file():
        line("ULTIMA MODIFICACION", str(state.stat().st_mtime))
        try:
            obj = json.loads(state.read_text(encoding="utf-8"))
            line("ESTADO", str(obj.get("status", "sin_estado"))[:70])
            line("DETALLE", str(obj.get("detail", "sin_detalle"))[:130])
        except (ValueError, OSError):
            line("ESTADO", "Existe, pero no es JSON legible")
    try:
        with tempfile.NamedTemporaryFile(
            prefix=".cahos_probe_", suffix=".tmp", dir=state.parent,
            mode="w", encoding="utf-8", delete=False
        ) as tmp:
            tmp.write("ok")
            created = Path(tmp.name)
        try:
            line("PERMISO ESCRITURA", "OK (archivo temporal, no se modifico el estado)")
        finally:
            created.unlink(missing_ok=True)
    except OSError as exc:
        line("PERMISO ESCRITURA", "ERROR "+type(exc).__name__)
    line("SEGURIDAD", "No se leyeron ni mostraron tokens o credenciales")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        line("ERROR", type(exc).__name__)
        raise SystemExit(2)
