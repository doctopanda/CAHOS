from poblacion_sonora import importar_excel
from pathlib import Path
import sys
try:
    if len(sys.argv)>1:
        archivo=sys.argv[1]
    else:
        import tkinter as tk
        from tkinter import filedialog
        root=tk.Tk();root.withdraw()
        archivo=filedialog.askopenfilename(title="Selecciona proyecciones municipales Sonora 2015-2030",filetypes=[("Excel","*.xlsx")])
        root.destroy()
    if not archivo:
        print("Selección cancelada.");raise SystemExit(2)
    r=importar_excel(archivo)
    print("POBLACION IMPORTADA EN ALMACENAMIENTO LOCAL PRIVADO:")
    print("Municipios:",r["municipios"],"registros:",r["filas"],"años:",", ".join(r["anios"]))
    print("No se subió el libro original a GitHub.")
except Exception as e:
    print("Error al importar denominadores:",str(e)[:250])
    raise SystemExit(1)
