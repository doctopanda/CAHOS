"""CAHOS: lectura de proyecciones públicas de población Sonora, no de casos nominales."""
from __future__ import annotations
import json, os, re, zipfile, xml.etree.ElementTree as ET
from pathlib import Path
from collections import defaultdict
ROOT=Path(os.environ.get("LOCALAPPDATA", str(Path(__file__).parent)))/"CAHOS"
DEST=ROOT/"poblacion_sonora.json"
N="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS={"s":N}

def importar_excel(ruta: str) -> dict:
    archivo=Path(ruta).expanduser().resolve()
    if not archivo.is_file() or archivo.suffix.lower()!=".xlsx":
        raise ValueError("Selecciona la hoja Excel de proyecciones municipales de Sonora.")
    if archivo.stat().st_size>30_000_000:
        raise ValueError("Archivo mayor al límite permitido de 30 MB.")
    datos=defaultdict(lambda:defaultdict(dict))
    municipios={}
    nfilas=0
    with zipfile.ZipFile(archivo) as z:
        shared=[]
        if "xl/sharedStrings.xml" in z.namelist():
            with z.open("xl/sharedStrings.xml") as fh:
                for _,el in ET.iterparse(fh,events=("end",)):
                    if el.tag=="{"+N+"}si":
                        shared.append("".join(t.text or "" for t in el.iter() if t.tag=="{"+N+"}t"))
                        el.clear()
        if "xl/worksheets/sheet1.xml" not in z.namelist():
            raise ValueError("No se encontró la hoja de proyecciones.")
        with z.open("xl/worksheets/sheet1.xml") as fh:
            for _,row in ET.iterparse(fh,events=("end",)):
                if row.tag!="{"+N+"}row":continue
                if row.attrib.get("r")=="1":row.clear();continue
                rec={}
                for cell in row:
                    if cell.tag!="{"+N+"}c":continue
                    col=re.match(r"[A-Z]+",cell.attrib.get("r",""))
                    val=cell.find("s:v",NS)
                    if col is None or val is None or val.text is None:continue
                    v=val.text
                    if cell.attrib.get("t")=="s":v=shared[int(v)]
                    rec[col.group()]=v
                if all(k in rec for k in ("A","B","C","D","E","F","G","H")):
                    clave=str(rec["A"]).zfill(5)
                    if clave.startswith("26") and len(clave)==5:
                        year=str(rec["F"])
                        age=str(rec["G"])
                        sex="M" if str(rec["E"]).lower().startswith("mujer") else ("H" if str(rec["E"]).lower().startswith("hombre") else "")
                        if age.startswith(("pobm_","pobh_")) and sex and year.isdigit() and 2015<=int(year)<=2030:
                            try:val=max(0,int(round(float(rec["H"]))))
                            except (TypeError,ValueError):row.clear();continue
                            municipios[clave]=str(rec["D"])
                            entry=datos[year][clave].setdefault(sex,{})
                            entry[age[-5:]]=val
                            nfilas+=1
                row.clear()
    if len(municipios)!=72 or nfilas<25000:
        raise ValueError("La hoja no contiene las 72 claves municipales y grupos por edad y sexo esperados.")
    out={"fuente":"COESPO/CONAPO, Proyecciones municipales Sonora 2015-2030, archivo de referencia local",
         "nota":"Son estimaciones poblacionales, no censos INEGI; comparar tasas con denominadores congruentes.",
         "entidad":"26","municipios":municipios,"anios":datos}
    ROOT.mkdir(parents=True,exist_ok=True)
    temp=DEST.with_suffix(".tmp")
    temp.write_text(json.dumps(out,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    temp.replace(DEST)
    return {"municipios":len(municipios),"filas":nfilas,"anios":sorted(datos),"ubicacion":"almacenamiento privado local"}

def poblacion_anual(anio: int) -> dict:
    if not 2015<=anio<=2030:raise ValueError("Año fuera del intervalo poblacional 2015-2030.")
    if not DEST.is_file():return {"disponible":False,"motivo":"Ejecute IMPORTAR_POBLACION.bat una vez, usando su libro de proyecciones.","anio":anio}
    db=json.loads(DEST.read_text(encoding="utf-8"))
    anio_s=str(anio)
    by=db.get("anios",{}).get(anio_s)
    if not by:return {"disponible":False,"motivo":"Sin denominador para el año seleccionado.","anio":anio}
    return {"disponible":True,"fuente":db["fuente"],"anio":anio,
            "municipios":[{"clave":code,"nombre":db["municipios"].get(code,code),"edades_sexo":segs} for code,segs in sorted(by.items())]}
