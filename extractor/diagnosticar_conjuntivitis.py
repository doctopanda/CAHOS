"""Diagnóstico local y limitado de un único padecimiento del cubo SINAVE.

Ejecuta hasta tres SELECT MDX de ANUAL 2026 directamente en el equipo autorizado.
No conecta con Supabase, no expone contraseñas, no imprime MDX, no muestra casos.
La consola recibe solo códigos de estado, no mensajes brutos del proveedor.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

VALID_TYPES = {
    "CONEXION_OLAP_NO_VALIDADA", "ORIGEN_EXCEL", "PROVEEDOR_MSOLAP",
    "ACCESO_ORIGINAL", "RED_O_VPN", "OLAP_QUERY_FAILED",
    "MIEMBRO_MDX_NO_ENCONTRADO", "SINTAXIS_MDX",
}

def status(label: str, code: str) -> None:
    safe_label = re.sub(r"[^A-Za-z0-9_-]", "", label)[:35]
    safe_code = re.sub(r"[^A-Za-z0-9_-]", "", code)[:50]
    print(f"[{safe_label}] {safe_code}", flush=True)

def main() -> None:
    if len(sys.argv) != 2:
        status("ENTORNO", "RUTA_INSTALADA_REQUERIDA")
        return
    root = Path(sys.argv[1]).expanduser().resolve()
    if not (root / "servidor.py").is_file() or not (root / "conector_sinave.ps1").is_file():
        status("ENTORNO", "EXTRACTOR_INSTALADO_NO_ENCONTRADO")
        return
    sys.path.insert(0, str(root))
    try:
        import servidor
    except Exception as exc:
        status("ENTORNO", "ERROR_IMPORTACION_" + type(exc).__name__)
        return

    try:
        pathologies = servidor.get_catalog("pathologies")
        years = servidor.get_catalog("years")
        entity = servidor.entity_default_id()
    except Exception as exc:
        status("CATALOGO", "ERROR_" + type(exc).__name__)
        return

    wanted_year = next(
        (m["id"] for m in years if re.search(r"(?<!\d)2026(?!\d)", m["nombre"])),
        None,
    )
    if not wanted_year or not entity:
        status("CATALOGO", "ANIO_O_ENTIDAD_NO_DISPONIBLE")
        return

    tests = [
        ("CONTROL_IRA", "Infecciones respiratorias agudas(J00-J06, J20, J21 EXCEPTO J02.0 Y J03.0)"),
        ("CONJUNTIVITIS_COMBINADA", "Conjuntivitis(B30, H10.0)"),
        ("CONJUNTIVITIS_H10", "Conjuntivitis(H10)"),
    ]
    print("CAHOS: prueba MDX local, hasta TRES SELECT de solo lectura.", flush=True)
    print("Primero se comprueba IRA con una consulta nueva. Si IRA falla, se detiene la prueba.", flush=True)
    print("Si la combinada funciona, no es necesario consultar la variante H10.", flush=True)
    print("No se muestran casos, servidores, contrasenas ni cadenas MDX.", flush=True)

    control_ok = False
    combined_ok = False
    for label, name in tests:
        member = next((m["id"] for m in pathologies if m["nombre"] == name), None)
        if label == "CONJUNTIVITIS_COMBINADA" and not control_ok:
            status(label, "OMITIDA_POR_FALLO_CONTROL_IRA")
            break
        if label == "CONJUNTIVITIS_H10" and combined_ok:
            status(label, "OMITIDA_POR_EXITO_COMBINADA")
            break
        if not member:
            status(label, "NO_EXISTE_EN_CATALOGO_LOCAL")
            if label == "CONTROL_IRA":
                break
            continue
        request = {
            "kind": "annual",
            "pathology": member,
            "years": [wanted_year],
            "entity": entity,
            "municipality": "",
            "sex": "",
            "age": "",
            "week_start": 1,
            "week_end": 53,
        }
        try:
            mdx, _axes = servidor.build_mdx(request)
        except Exception as exc:
            status(label, "ERROR_VALIDACION_" + type(exc).__name__)
            continue
        cfg = servidor.get_config()
        allowed = (
            "servidor", "catalogo", "cubo", "proveedor",
            "origen_conexion", "ruta_archivo_excel"
        )
        wire = {
            "action": "query",
            "config": {k: cfg[k] for k in allowed},
            "mdx": mdx,
        }
        try:
            child = subprocess.run(
                ["powershell.exe", "-NoProfile", "-NonInteractive",
                 "-ExecutionPolicy", "Bypass", "-File", str(root / "conector_sinave.ps1")],
                input=json.dumps(wire, ensure_ascii=False),
                text=True, encoding="utf-8", errors="replace", capture_output=True,
                cwd=str(root), timeout=110,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
            try:
                data = json.loads(child.stdout.strip().lstrip("\ufeff"))
            except (ValueError, TypeError):
                status(label, "RESPUESTA_NO_JSON")
                continue
            if child.returncode or data.get("ok") is not True:
                kind = str(data.get("tipo", "OLAP_QUERY_FAILED"))
                status(label, kind if kind in VALID_TYPES else "OLAP_QUERY_FAILED")
                continue
            rows = data.get("rows")
            if not isinstance(rows, list):
                status(label, "RESPUESTA_SIN_FILAS_LISTA")
            elif not rows:
                status(label, "CONSULTA_OK_SIN_FILAS")
            else:
                status(label, "CONSULTA_OK_CON_FILAS")
                if label == "CONTROL_IRA":
                    control_ok = True
                if label == "CONJUNTIVITIS_COMBINADA":
                    combined_ok = True
        except subprocess.TimeoutExpired:
            status(label, "TIEMPO_LIMITE_110_SEGUNDOS")
        except Exception as exc:
            status(label, "ERROR_PROCESO_" + type(exc).__name__)

    print("FIN: ninguna consulta se envio a Supabase ni modifico el cubo.", flush=True)
    if not control_ok:
        print("INTERPRETACION: no se descarta un problema general de conexion, sesion o MSOLAP.", flush=True)
    elif combined_ok:
        print("INTERPRETACION: la combinada funciona; el error previo fue transitorio o dependia de los filtros.", flush=True)
    else:
        print("INTERPRETACION: el control IRA funciona, pero la combinada no; inspeccionar miembro MDX y filtros.", flush=True)

if __name__ == "__main__":
    main()
