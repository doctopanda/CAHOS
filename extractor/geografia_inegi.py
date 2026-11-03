"""CAHOS · geografía pública municipal de INEGI, sin datos de pacientes.
Descarga en el equipo local desde servicios oficiales y conserva la última copia válida.
"""
import json, os, urllib.request, urllib.parse
from pathlib import Path
ROOT=Path(os.environ.get("LOCALAPPDATA",str(Path(__file__).parent)))/"CAHOS"/"cartografia"
DEST=ROOT/"INEGI_SONORA_MUNICIPIOS.geojson"
URLS=[
    "https://lcidsig.inegi.org.mx/server/rest/services/Hosted/Municipios_2025/FeatureServer/0/query?"+
    urllib.parse.urlencode({"where":"cve_ent='26'","outFields":"cvegeo,nomgeo,cve_ent,cve_mun",
                          "returnGeometry":"true","outSR":"4326","f":"geojson"}),
    "https://gaia.inegi.org.mx/wscatgeo/v2/geo/mgem/26"
]
def validar(obj):
    if isinstance(obj,dict) and "features" not in obj:
        for key in ("data","resultado","result"):
            if isinstance(obj.get(key),dict) and "features" in obj[key]:
                obj=obj[key];break
    if not isinstance(obj,dict) or obj.get("type")!="FeatureCollection":
        raise ValueError("La fuente cartográfica no devolvió GeoJSON tipo FeatureCollection.")
    feats=[]
    for feature in obj.get("features",[]):
        props=feature.get("properties") or {}
        geo=feature.get("geometry") or {}
        code=str(props.get("cvegeo") or props.get("CVEGEO") or "")
        if code.startswith("26") and len(code)==5 and geo.get("type") in ("Polygon","MultiPolygon"):
            feats.append({"type":"Feature","properties":{"cvegeo":code,
                          "nombre":props.get("nomgeo") or props.get("NOMGEO") or props.get("nom_mun") or code},
                          "geometry":geo})
    if len(feats)!=72:
        raise ValueError("INEGI no devolvió exactamente las 72 geometrías municipales de Sonora.")
    return {"type":"FeatureCollection","metadata":{"fuente":"INEGI, Marco Geoestadístico Municipal (servicio oficial)",
              "entidad":"26","municipios":72},"features":feats}

def obtener_geojson(forzar=False):
    if DEST.is_file() and not forzar:
        try:return validar(json.loads(DEST.read_text(encoding="utf-8")))
        except (OSError,ValueError):pass
    fallos=[]
    for url in URLS:
        try:
            req=urllib.request.Request(url,headers={"User-Agent":"CAHOS-observatorio-SUIVE/0.5","Accept":"application/json"})
            with urllib.request.urlopen(req,timeout=25) as r:
                if int(r.status)!=200:raise RuntimeError("HTTP incorrecto")
                data=r.read(20_000_001)
                if len(data)>20_000_000:raise RuntimeError("La respuesta excede 20 MB")
                obj=validar(json.loads(data.decode("utf-8-sig")))
            ROOT.mkdir(parents=True,exist_ok=True)
            temp=DEST.with_suffix(".tmp")
            temp.write_text(json.dumps(obj,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
            temp.replace(DEST)
            return obj
        except Exception as exc:
            fallos.append(type(exc).__name__)
    raise RuntimeError("No se pudo descargar el Marco Geoestadístico de INEGI en este equipo. "+
                       "Revise acceso a lcidsig.inegi.org.mx y gaia.inegi.org.mx. La cartografía no se inventará.")
