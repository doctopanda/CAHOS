"""CAHOS Cloud: limited local bridge, never accepts raw MDX or credentials from the web."""
from __future__ import annotations
import json
import sys
import servidor

# Safe, fixed error codes. Never send provider messages, MDX or connection details.
def safe_error_code(exc: Exception) -> str:
    if isinstance(exc, ValueError):
        return "local_query_validation_error"
    message = str(exc).lower()
    if "estructura de filas inesperada" in message or "metadatos de columnas" in message:
        return "olap_result_axis_error"
    if "no incluye la medida casos" in message:
        return "olap_measure_missing"
    if "miembro de" in message and "no existe" in message:
        return "olap_catalog_member_missing"
    if "proveedor no devolvió datos" in message:
        return "olap_empty_provider_response"
    if "too long" in message or "timeout" in message or "tiempo de espera" in message:
        return "olap_query_timeout"
    return "local_olap_error"

ALLOWED_DIMS = frozenset(servidor.WITH_HIERARCHIES)
ALLOWED_KINDS = frozenset(servidor.AXES)

def main():
    if len(sys.argv) < 2:
        raise ValueError("action_required")
    action = sys.argv[1]
    if action == "catalog":
        if len(sys.argv) != 3 or sys.argv[2] not in ALLOWED_DIMS:
            raise ValueError("invalid_dimension")
        result = {"members": servidor.get_catalog(sys.argv[2])}
    elif action == "query":
        if len(sys.argv) != 2:
            raise ValueError("invalid_arguments")
        request = json.load(sys.stdin)
        if not isinstance(request, dict) or request.get("kind") not in ALLOWED_KINDS:
            raise ValueError("invalid_query")
        if request.get("entity") != servidor.entity_default_id():
            raise ValueError("only_authorized_sonora_queries")
        result = servidor.query_cube(request, force=False)
    else:
        raise ValueError("invalid_action")
    print(json.dumps(result, ensure_ascii=False, allow_nan=False, separators=(",", ":")))

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Print only a whitelisted technical category. Raw exception strings can
        # contain OLAP connection details and must never leave this Windows PC.
        print(json.dumps({"error": "local_olap_query_failed", "code": safe_error_code(exc)}))
        sys.exit(1)
