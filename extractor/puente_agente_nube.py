"""CAHOS Cloud: limited local bridge, never accepts raw MDX or credentials from the web."""
from __future__ import annotations
import json
import sys
import servidor

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
    except Exception:
        # No raw provider errors or connection strings are written to the cloud.
        print(json.dumps({"error": "local_olap_query_failed"}))
        sys.exit(1)
