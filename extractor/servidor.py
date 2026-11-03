"""CAHOS SUIVE: servicio local de extracción OLAP de solo lectura.
Sin dependencias Python de terceros. No utiliza ni extrae las claves del XLSX original.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from poblacion_sonora import poblacion_anual
from geografia_inegi import obtener_geojson

APP_VERSION = '0.6.2'
ROOT = Path(__file__).resolve().parent
# Los snapshots son LOCALES, nunca se publican automaticamente en GitHub Pages.
PRIVATE_ROOT = Path(os.environ.get('LOCALAPPDATA', str(ROOT))) / 'CAHOS' / 'extracciones_privadas'
PRIVATE_ROOT.mkdir(parents=True, exist_ok=True)
# Preferencias y ruta del XLSX se guardan fuera del repositorio público.
CONFIG_PATH = Path(os.environ.get('LOCALAPPDATA', str(ROOT))) / 'CAHOS' / 'configuracion_local.json'
DEFAULT_CONFIG_PATH = ROOT / 'configuracion.ejemplo.json'
LEGACY_CONFIG_PATH = ROOT / 'configuracion.json'
BRIDGE_PATH = ROOT / 'conector_sinave.ps1'
WITH_HIERARCHIES = {
    'pathologies': '[Padecimientos].[Padecimiento]',
    'years': '[Años].[Año]',
    'weeks': '[Semanas epidemiológicas].[Semana]',
    'municipalities': '[Municipios].[Municipio]',
    'entities': '[Entidades].[Entidad]',
    'sex': '[Sexo].[Sexo]',
    'age': '[Grupos de edades].[Grupo de edad]',
    'institutions': '[Instituciones].[Institución]',
}
AXES = {'annual': ('years',), 'weekly': ('years', 'weeks'), 'sex': ('sex',), 'age': ('age',), 'institution': ('institutions',), 'municipality': ('municipalities',)}
VALID_MDX_NAME = re.compile(r'^\[[^\]\r\n;]+\](?:\.&?\[(?:[^\]\r\n;]|\]\]){1,190}\])+$')
MAX_CATALOG = 12000
LOCK = threading.RLock()
QUERY_GATE = threading.Semaphore(1)
SYNC_GATE = threading.Lock()
CATALOG_CACHE: dict[str, dict] = {}
QUERY_CACHE: dict[str, dict] = {}
RECENT_ACTIVITY: dict = {'ultima_consulta': None, 'ultima_extraccion_automatica': None, 'ultimo_error': None, 'extracciones_automaticas': 0}


def get_config():
    cfg = json.loads(DEFAULT_CONFIG_PATH.read_text(encoding='utf-8-sig'))
    for local_source in (LEGACY_CONFIG_PATH, CONFIG_PATH):
        if local_source.exists():
            cfg.update(json.loads(local_source.read_text(encoding='utf-8-sig')))
    cfg.setdefault('origen_conexion', 'integrada')
    cfg.setdefault('ruta_archivo_excel', '')
    if cfg['origen_conexion'] not in ('integrada', 'excel'):
        raise ValueError('Origen de conexión desconocido')
    if cfg['origen_conexion'] == 'excel' and not Path(cfg['ruta_archivo_excel']).is_file():
        raise ValueError('No se encuentra el Excel original. Ejecuta SELECCIONAR_EXCEL.bat.')
    for key in ('servidor', 'catalogo', 'cubo', 'proveedor'):
        if key not in cfg or not isinstance(cfg[key], str):
            raise ValueError(f'Falta configuración: {key}')
    cfg['intervalo_actualizacion_minutos'] = max(15, min(1440, int(cfg.get('intervalo_actualizacion_minutos', 360))))
    return cfg


def run_connector(action: str, *, hierarchy: str = '', mdx: str = '') -> dict:
    cfg = get_config()
    query = {'action': action, 'config': {k: cfg[k] for k in ('servidor', 'catalogo', 'cubo', 'proveedor', 'origen_conexion', 'ruta_archivo_excel')}}
    if hierarchy:
        query['hierarchy'] = hierarchy
    if mdx:
        query['mdx'] = mdx
    if sys.platform != 'win32':
        raise RuntimeError('El conector MSOLAP de esta versión requiere Windows con PowerShell y el proveedor Microsoft MSOLAP.')
    with QUERY_GATE:
        proc = subprocess.run(
            ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', str(BRIDGE_PATH)],
            input=json.dumps(query, ensure_ascii=False), text=True, encoding='utf-8', errors='replace',
            capture_output=True, timeout=min(int(cfg.get('tiempo_maximo_consulta_segundos', 90)), 180),
            cwd=str(ROOT), env=os.environ.copy(),
            # pythonw.exe no tiene consola; sin CREATE_NO_WINDOW, cada
            # consulta OLAP abre una ventana powershell/conhost pasajera.
            creationflags=(subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0),
        )
    if not proc.stdout.strip():
        raise RuntimeError('El proveedor no devolvió datos. Comprueba Microsoft MSOLAP y la conectividad institucional.')
    try:
        result = json.loads(proc.stdout.strip().lstrip('\ufeff'))
    except ValueError as exc:
        raise RuntimeError('No se pudo interpretar la respuesta del proveedor OLAP.') from exc
    if not result.get('ok') or proc.returncode:
        raise RuntimeError(result.get('error', 'La consulta de solo lectura falló.'))
    if len(result.get('rows', [])) > 7500:
        raise RuntimeError('La consulta es demasiado extensa.')
    return result


def diagnostico_olap() -> dict:
    """Prueba conexión sin extraer casos ni divulgar credenciales."""
    result = run_connector('probe')
    return {'conectado': bool(result.get('connected')), 'catalogo': get_config()['catalogo'],
            'fecha_prueba_utc': datetime.now(timezone.utc).isoformat()}


def canonical_member(s: str) -> bool:
    return isinstance(s, str) and len(s) <= 230 and bool(VALID_MDX_NAME.fullmatch(s))


def members_from_response(response: dict, hierarchy: str):
    cols = [str(x).upper() for x in response['columns']]
    def ix(key):
        return next((i for i, c in enumerate(cols) if c.endswith(key)), None)
    u, cap, typ, h = ix('MEMBER_UNIQUE_NAME'), ix('MEMBER_CAPTION'), ix('MEMBER_TYPE'), ix('HIERARCHY_UNIQUE_NAME')
    if u is None or cap is None:
        raise RuntimeError('El servidor no devolvió las columnas necesarias del catálogo de miembros.')
    result = []
    seen = set()
    for row in response['rows']:
        uid = str(row[u] or '')
        if not canonical_member(uid) or uid in seen or (h is not None and row[h] != hierarchy):
            continue
        if typ is not None and str(row[typ]) in ('2', '4', '5', '6'):
            continue  # All, formulas de cálculo y otros miembros no regulares
        seen.add(uid)
        result.append({'id': uid, 'nombre': str(row[cap] or uid)[:180]})
    if len(result) > MAX_CATALOG:
        raise RuntimeError('Catálogo demasiado grande para el visor local.')
    return result


def get_catalog(dim: str, force: bool = False):
    if dim not in WITH_HIERARCHIES:
        raise ValueError('Dimensión no permitida')
    now = time.time()
    with LOCK:
        cached = CATALOG_CACHE.get(dim)
        if cached and not force and now - cached['epoch'] < 14400:
            return cached['members']
    members = members_from_response(run_connector('catalog', hierarchy=WITH_HIERARCHIES[dim]), WITH_HIERARCHIES[dim])
    with LOCK:
        CATALOG_CACHE[dim] = {'epoch': now, 'members': members}
    return members


def ids_by_dimension(dim: str):
    return {r['id']: r['nombre'] for r in get_catalog(dim)}


def pick(dim: str, id_: str | None):
    if not id_:
        return None
    if not canonical_member(id_):
        raise ValueError(f'Miembro no válido: {dim}')
    if id_ not in ids_by_dimension(dim):
        raise ValueError(f'El miembro de {dim} no existe en el catálogo autorizado')
    return id_


def nweek(text):
    m = re.search(r'(?<!\d)0?([1-9]|[1-4]\d|5[0-3])(?!\d)', text)
    return int(m.group(1)) if m else None


def pick_years(year_ids):
    if not isinstance(year_ids, list) or not (1 <= len(year_ids) <= 10):
        raise ValueError('Selecciona entre 1 y 10 años')
    catalog = ids_by_dimension('years')
    ids = []
    for year_id in year_ids:
        if not isinstance(year_id, str) or year_id not in catalog:
            raise ValueError('Año fuera del catálogo')
        if year_id not in ids:
            ids.append(year_id)
    return ids


def week_members(from_week: int, to_week: int):
    if not (1 <= from_week <= to_week <= 53):
        raise ValueError('Intervalo de semanas fuera de rango')
    out = []
    for m in get_catalog('weeks'):
        w = nweek(m['nombre'])
        if w is not None and from_week <= w <= to_week:
            out.append((w, m['id']))
    seen = {}
    for w, uid in out:
        # Si múltiples miembros representan la misma SE, no mezclar sin validar el modelo temporal.
        if w in seen and seen[w] != uid:
            raise RuntimeError('Semanas epidemiológicas ambiguas en el cubo; requiere calibración de sus claves')
        seen[w] = uid
    if not seen:
        raise RuntimeError('No fue posible identificar las semanas solicitadas en el catálogo')
    return [seen[w] for w in sorted(seen)]


def build_mdx(req: dict) -> tuple[str, list[str]]:
    kind = req.get('kind')
    if kind not in AXES:
        raise ValueError('Tipo de consulta no permitido')
    pathology = pick('pathologies', req.get('pathology'))
    if not pathology:
        raise ValueError('Selecciona una patología del catálogo')
    years = pick_years(req.get('years', []))
    municipality = pick('municipalities', req.get('municipality'))
    entity = pick('entities', req.get('entity'))
    sex = pick('sex', req.get('sex'))
    age = pick('age', req.get('age'))
    week_start = int(req.get('week_start', 1))
    week_end = int(req.get('week_end', 53))
    slicer = [pathology]
    if entity: slicer.append(entity)
    if municipality and kind != 'municipality': slicer.append(municipality)
    if sex and kind != 'sex': slicer.append(sex)
    if age and kind != 'age': slicer.append(age)
    axes = AXES[kind]
    if kind == 'annual':
        rowset = '{' + ', '.join(years) + '}'
    elif kind == 'weekly':
        wm = week_members(week_start, week_end)
        rowset = 'CROSSJOIN({' + ', '.join(years) + '}, {' + ', '.join(wm) + '})'
    else:
        if len(years) != 1:
            raise ValueError('El desglose por dimensión requiere un solo año')
        slicer.append(years[0])
        dim = axes[0]
        # Un miembro de sexo o edad no puede ir a la vez en eje y segmentador.
        if kind == 'municipality':
            if not entity:
                raise ValueError('El mapa requiere seleccionar una entidad federativa')
            rowset = WITH_HIERARCHIES['municipalities'] + '.Members'
        else:
            members = get_catalog(dim)
            if not members or len(members) > 250:
                raise RuntimeError('La dimensión no tiene un catálogo acotado de miembros')
            rowset = '{' + ', '.join(m['id'] for m in members) + '}'
    where = '\nWHERE (' + ', '.join(slicer) + ')' if slicer else ''
    cube = get_config()['cubo'].replace(']', ']]')
    props = 'MEMBER_CAPTION, MEMBER_UNIQUE_NAME' if kind == 'municipality' else 'MEMBER_CAPTION'
    mdx = (f'SELECT {{[Measures].[Casos]}} ON COLUMNS,\n'
           f'NON EMPTY {rowset} DIMENSION PROPERTIES {props} ON ROWS\n'
           f'FROM [{cube}]{where}')
    return mdx, list(axes)


def normalise_flat_response(result: dict, axes: list[str]):
    headers = [str(x) for x in result.get('columns', [])]
    if not headers:
        return []
    h_upper = [s.upper() for s in headers]
    idx = {}
    for axis in axes:
        key = WITH_HIERARCHIES[axis].upper()
        matching = [i for i, h in enumerate(h_upper) if key in h]
        named = [i for i in matching if 'MEMBER_CAPTION' in h_upper[i]]
        if not matching:
            # Compatibilidad con respuestas aplanadas que incluyen únicamente el nombre del nivel
            fragment = axis.upper()
            named = [i for i, h in enumerate(h_upper) if fragment in h]
        if not matching and not named:
            raise RuntimeError('El cubo devolvió una estructura de filas inesperada; debe calibrarse el eje ' + axis)
        idx[axis] = (named or matching)[0]
    measures = [i for i, h in enumerate(h_upper) if '[MEASURES].[CASOS]' in h]
    if not measures:
        measures = [i for i, h in enumerate(h_upper) if h.endswith('.CASOS') or h == 'CASOS']
    if not measures:
        raise RuntimeError('El resultado del cubo no incluye la medida Casos')
    m = measures[-1]
    out = []
    for values in result['rows']:
        obj = {ax: str(values[ix]) if values[ix] is not None else '' for ax, ix in idx.items()}
        # Para cartografia, aprovechar la clave del miembro devuelta por MSOLAP.
        # Si el proveedor no expone MEMBER_UNIQUE_NAME, la UI usará
        # nombres normalizados con diagnóstico de claves sin emparejar.
        if 'municipalities' in axes:
            pref = WITH_HIERARCHIES['municipalities'].upper()
            ids = [i for i, h in enumerate(h_upper)
                   if pref in h and 'MEMBER_UNIQUE_NAME' in h]
            if ids:
                obj['municipalities_id'] = str(values[ids[0]] or '')
        val = values[m]
        if val is None or str(val).strip() == '':
            obj['cases'] = None
        else:
            try:
                obj['cases'] = float(val)
            except (TypeError, ValueError):
                raise RuntimeError('Medida Casos no numérica en la respuesta')
        out.append(obj)
    return out


def query_cube(request: dict, force=False):
    mdx, axes = build_mdx(request)
    key = json.dumps({'mdx': mdx, 'axes': axes}, ensure_ascii=False, sort_keys=True)
    now = time.time()
    ttl = get_config()['intervalo_actualizacion_minutos'] * 60
    with LOCK:
        old = QUERY_CACHE.get(key)
        if old and now - old['epoch'] < ttl and not force:
            return {**old['payload'], 'cache': True}
    digest = hashlib.sha256(key.encode('utf-8')).hexdigest()
    saved = PRIVATE_ROOT / (digest + '.json')
    if not force and saved.exists():
        try:
            data = json.loads(saved.read_text(encoding='utf-8'))['resultado']
            stamp = datetime.fromisoformat(data['extraido_en'].replace('Z','+00:00')).timestamp()
            if now - stamp < ttl:
                return {**data, 'cache': True}
        except (OSError, KeyError, ValueError, TypeError):
            pass
    result = run_connector('query', mdx=mdx)
    payload = {'rows': normalise_flat_response(result, axes), 'axes': axes,
               'extraido_en': datetime.now(timezone.utc).isoformat(),
               'cache': False, 'fuente': 'Cubo SINAVE / Analysis Services', 'corte_oficial': None}
    with LOCK:
        QUERY_CACHE[key] = {'epoch': now, 'payload': payload}
        RECENT_ACTIVITY['ultima_consulta'] = payload['extraido_en']
        RECENT_ACTIVITY['ultimo_error'] = None
    # Persistencia privada para que la sincronizacion programada no se pierda al reiniciar.
    digest = hashlib.sha256(key.encode('utf-8')).hexdigest()
    output = PRIVATE_ROOT / (digest + '.json')
    temporary = output.with_suffix('.tmp')
    temporary.write_text(json.dumps({'consulta_sha256': digest, 'resultado': payload}, ensure_ascii=False), encoding='utf-8')
    temporary.replace(output)
    return payload


def save_favorites(ids):
    if not isinstance(ids, list) or len(ids) > 25 or not all(isinstance(x, str) for x in ids):
        raise ValueError('Entre 0 y 25 patologías')
    valid = ids_by_dimension('pathologies')
    if any(m not in valid for m in ids):
        raise ValueError('Hay patologías fuera del catálogo del cubo')
    cfg = get_config()
    cfg['favoritos'] = list(dict.fromkeys(ids))
    cfg['favoritos_inicializados'] = True
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = CONFIG_PATH.with_suffix('.tmp')
    tmp.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp.replace(CONFIG_PATH)
    return cfg['favoritos']


def last_year_ids(limit=7):
    pairs = []
    for o in get_catalog('years'):
        m = re.search(r'(?:19|20)\d{2}', o['nombre'])
        if m:
            pairs.append((int(m.group()), o['id']))
    return [p[1] for p in sorted(pairs, reverse=True)[:limit]]


def entity_default_id():
    preferred = get_config().get('entidad_preferida', 'Sonora')
    return next((x['id'] for x in get_catalog('entities') if x['nombre'].lower().strip() == preferred.lower().strip()), None)


def sync_favorites():
    # Un barrido a la vez: evita saturar el servidor institucional por clics repetidos.
    if not SYNC_GATE.acquire(blocking=False):
        return
    try:
        favorite = get_config()['favoritos'][:25]
        years = last_year_ids(7)
        state = entity_default_id()
        if not years:
            raise RuntimeError('No se localizaron años disponibles en el cubo')
        for pathology in favorite:
            for kind in ('weekly', 'annual'):
                request = {'kind': kind, 'pathology': pathology,
                           'years': years[:7],
                           'entity': state, 'week_start': 1, 'week_end': 53}
                query_cube(request, force=True)
                with LOCK:
                    RECENT_ACTIVITY['extracciones_automaticas'] += 1
                    RECENT_ACTIVITY['ultima_extraccion_automatica'] = datetime.now(timezone.utc).isoformat()
    except Exception as exc:
        with LOCK:
            RECENT_ACTIVITY['ultimo_error'] = str(exc)[:300]
    finally:
        SYNC_GATE.release()


def recurring_sync():
    # Dar prioridad a la primera consulta interactiva y luego sincronizar
    # mientras Windows mantenga encendido el servicio local.
    time.sleep(60)
    while True:
        delay = 360 * 60
        try:
            cfg = get_config()
            delay = cfg['intervalo_actualizacion_minutos'] * 60
            if cfg.get('favoritos'):
                sync_favorites()
        except Exception as exc:
            with LOCK:
                RECENT_ACTIVITY['ultimo_error'] = 'Sincronización automática: ' + str(exc)[:220]
            delay = 5 * 60
        time.sleep(delay)


class Handler(BaseHTTPRequestHandler):
    server_version = 'CAHOS-Extractor/0.4'

    def log_message(self, fmt, *args):
        # Evita registrar consultas y rutas que podrían contener información operativa.
        pass

    def json_response(self, status, data):
        payload = json.dumps(data, ensure_ascii=False, allow_nan=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def fail(self, exc):
        status = 400 if isinstance(exc, ValueError) else 503
        self.json_response(status, {'error': str(exc)[:320]})

    def origin_guard(self):
        host = self.headers.get('Host','').lower()
        origin = self.headers.get('Origin','')
        if host not in ('localhost:8789','127.0.0.1:8789'):
            raise ValueError('Host no autorizado')
        if origin and origin not in ('http://localhost:8789','http://127.0.0.1:8789'):
            raise ValueError('Origen no autorizado')

    def do_GET(self):
        try:
            self.origin_guard()
            p = urlparse(self.path)
            if p.path == '/':
                content = (ROOT / 'visor_local.html').read_bytes()
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
                self.send_header('X-Content-Type-Options', 'nosniff')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            elif p.path == '/mapa_sonora.js':
                data = (ROOT / 'mapa_sonora.js').read_bytes()
                self.send_response(200)
                self.send_header('Content-Type', 'text/javascript; charset=utf-8')
                self.send_header('X-Content-Type-Options', 'nosniff')
                self.send_header('Cache-Control', 'no-cache')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            elif p.path == '/api/status':
                cfg = get_config()
                with LOCK:
                    activity = RECENT_ACTIVITY.copy()
                self.json_response(200, {'version': APP_VERSION, 'modo': 'excel_local' if cfg['origen_conexion'] == 'excel' else 'conector_local', 'servidor': cfg['servidor'], 'catalogo': cfg['catalogo'],
                                         'intervalo_minutos': cfg['intervalo_actualizacion_minutos'],
                                         'favoritos': cfg['favoritos'], 'favoritos_inicializados': cfg.get('favoritos_inicializados', False), 'actividad': activity,
                                         'autenticacion': 'conexión guardada en el libro local' if cfg['origen_conexion'] == 'excel' else 'integrada o sesión temporal (sin credenciales en el navegador)'})
            elif p.path == '/api/geografia/sonora':
                self.json_response(200, obtener_geojson())
            elif p.path == '/api/poblacion':
                year_txt = parse_qs(p.query).get('year',[''])[0]
                if not year_txt.isdigit():
                    raise ValueError('Indica año válido para denominadores.')
                self.json_response(200, poblacion_anual(int(year_txt)))
            elif p.path == '/api/diagnostic':
                self.json_response(200, diagnostico_olap())
            elif p.path == '/api/catalog':
                dim = parse_qs(p.query).get('dim', [''])[0]
                self.json_response(200, {'dimension': dim, 'members': get_catalog(dim)})
            else:
                self.json_response(404, {'error': 'Ruta desconocida'})
        except (Exception,) as exc:
            self.fail(exc)

    def do_POST(self):
        try:
            self.origin_guard()
            if 'application/json' not in self.headers.get('Content-Type', ''):
                raise ValueError('Solo se permite JSON')
            length = int(self.headers.get('Content-Length', 0))
            if length < 2 or length > 10000:
                raise ValueError('Contenido fuera de límites')
            request = json.loads(self.rfile.read(length))
            if not isinstance(request, dict):
                raise ValueError('Solicitud inválida')
            path = urlparse(self.path).path
            if path == '/api/query':
                self.json_response(200, query_cube(request, force=bool(request.get('force'))))
            elif path == '/api/favorites':
                favorites = save_favorites(request.get('favoritos'))
                self.json_response(200, {'favoritos': favorites})
                # Siguiente ciclo predescarga favoritos recién guardados.
                threading.Thread(target=sync_favorites, daemon=True).start()
            elif path == '/api/refresh':
                if request.get('favoritos') is True:
                    threading.Thread(target=sync_favorites, daemon=True).start()
                    self.json_response(202, {'status': 'extraccion_iniciada'})
                else:
                    self.json_response(400, {'error': 'Indica favoritos=true para actualizar'})
            else:
                self.json_response(404, {'error': 'Ruta desconocida'})
        except (Exception,) as exc:
            self.fail(exc)


def start():
    if sys.platform != 'win32':
        print('ATENCIÓN: el conector real requiere Windows; la interfaz abre pero no puede consultar MSOLAP aquí.')
    server = ThreadingHTTPServer(('127.0.0.1', 8789), Handler)
    threading.Thread(target=recurring_sync, daemon=True).start()
    print('CAHOS | Extraccion automatica local: http://127.0.0.1:8789')
    print('Cierra esta ventana o pulsa Ctrl+C para detener la conexión.')
    try:
        server.serve_forever(poll_interval=0.3)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    start()
