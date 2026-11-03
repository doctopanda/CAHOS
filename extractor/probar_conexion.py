"""Prueba no destructiva del enlace SINAVE (sin publicar ni revelar contrasenas)."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from servidor import diagnostico_olap, get_catalog, get_config

def main():
    print('CAHOS | Diagnostico de acceso al cubo SINAVE')
    try:
        r=diagnostico_olap()
        print('1. Conexion OLAP: OK ('+r['catalogo']+')')
    except Exception as ex:
        print('1. Conexion OLAP: NO VERIFICADA')
        print('   '+str(ex)[:220])
        return 1
    ok=True
    for dim,titulo in [('years','Anos'),('pathologies','Padecimientos'),('entities','Entidades'),('weeks','Semanas epidemiologicas'),('municipalities','Municipios')]:
        try:
            items=get_catalog(dim,force=True)
            print(f'2. Catalogo {titulo}: {len(items)} miembros')
        except Exception as ex:
            ok=False
            print(f'2. Catalogo {titulo}: FALLA: {str(ex)[:180]}')
    print('Resultado: '+('METADATOS ACCESIBLES' if ok else 'AJUSTE DE JERARQUIAS NECESARIO'))
    print('Ninguna tabla con casos fue extraida ni publicada en esta prueba.')
    return 0 if ok else 2

if __name__=='__main__': raise SystemExit(main())
