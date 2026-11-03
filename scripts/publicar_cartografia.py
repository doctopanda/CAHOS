"""Descarga opcional de cartografia pública INEGI para GitHub Pages.
Nunca incluye datos del cubo SINAVE ni credenciales. No rompe despliegue si INEGI está caído.
"""
import json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"extractor"))
from geografia_inegi import obtener_geojson

dest=Path(__file__).resolve().parents[1]/"public"/"data"/"sonora_municipios.geojson"
try:
    geo=obtener_geojson(forzar=True)
    if len(geo.get("features",[]))!=72:
        raise ValueError("No se obtuvieron los 72 municipios")
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(geo,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print("INEGI: poligonos públicos de 72 municipios integrados a Pages.")
except Exception as e:
    print("AVISO: no se pudo recuperar cartografia INEGI en este despliegue. Mapa base pendiente; no se fabrican polígonos. Tipo:",type(e).__name__)
