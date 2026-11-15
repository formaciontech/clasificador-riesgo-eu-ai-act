"""Prueba de extremo a extremo del clasificador con Playwright.

Abre index.html en Chromium, recorre tres casos y comprueba que cada uno llega
a su resultado sin errores en la consola. Con --capturas guarda además las
imágenes del README en la carpeta capturas/.

    pip install -r pruebas/requirements.txt
    python -m playwright install chromium     # solo la primera vez
    python pruebas/prueba_navegador.py               # abre el fichero en local (file://)
    python pruebas/prueba_navegador.py --http        # lo sirve por HTTP, como GitHub Pages
    python pruebas/prueba_navegador.py --capturas
"""

import argparse
import functools
import http.server
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent

# Respuesta neutra para las preguntas que un caso no fija
POR_DEFECTO = {
    "cambios": ["ninguno"], "prohibidas": [], "producto": "no",
    "anexo3": ["ninguno"], "transparencia": ["ninguno"], "gpai": "no",
}

# Respuestas por pregunta (id de la pregunta -> valor o lista de valores) y nivel esperado
CASOS = [
    {
        "nombre": "Puntuación social",
        "respuestas": {"rol": "proveedor", "prohibidas": ["p0"]},
        "nivel": "Riesgo inaceptable",
    },
    {
        "nombre": "Cribado de candidaturas con perfilado",
        "respuestas": {
            "rol": "responsable", "cambios": ["ninguno"], "prohibidas": [],
            "producto": "no", "anexo3": ["a3"], "perfilado": "si",
            "transparencia": ["ninguno"], "gpai": "no",
        },
        "nivel": "Alto riesgo",
    },
    {
        "nombre": "Chatbot propio sobre la API de un modelo",
        "respuestas": {
            "rol": "integrador", "prohibidas": [], "producto": "no",
            "anexo3": ["ninguno"], "transparencia": ["interactua", "sintetico"], "gpai": "no",
        },
        "nivel": "Riesgo limitado",
    },
]


def recorrer(pagina, caso, capturas=None):
    respuestas = {**POR_DEFECTO, **caso["respuestas"]}
    for _ in range(15):
        if pagina.locator(".cl-resultado-cab").count():
            break
        grupo = pagina.locator(".cl-opciones input").first
        pregunta = grupo.get_attribute("name")
        valores = respuestas.get(pregunta)
        if valores is None:
            raise AssertionError(f"{caso['nombre']}: pregunta inesperada «{pregunta}»")
        for v in [valores] if isinstance(valores, str) else valores:
            pagina.locator(f'input[name="{pregunta}"][value="{v}"]').check()
        if capturas is not None and pregunta == "anexo3":
            pagina.locator("#clasificador").screenshot(path=str(capturas / "captura-pregunta.png"))
        pagina.locator("#cl-siguiente").click()
    nivel = pagina.locator(".cl-nivel").text_content().strip()  # sin text-transform
    titulo = pagina.locator(".cl-resultado-cab h2").inner_text().strip()
    bloques = pagina.locator(".cl-bloque").count()
    return nivel, titulo, bloques


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--http", action="store_true", help="servir la carpeta por HTTP en lugar de abrir el fichero")
    ap.add_argument("--capturas", action="store_true", help="guardar las capturas del README")
    args = ap.parse_args()

    servidor = None
    if args.http:
        manejador = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(RAIZ))
        servidor = http.server.ThreadingHTTPServer(("127.0.0.1", 0), manejador)
        threading.Thread(target=servidor.serve_forever, daemon=True).start()
        url = f"http://127.0.0.1:{servidor.server_address[1]}/index.html"
    else:
        url = (RAIZ / "index.html").as_uri()

    carpeta_capturas = None
    if args.capturas:
        carpeta_capturas = RAIZ / "capturas"
        carpeta_capturas.mkdir(exist_ok=True)

    fallos = 0
    with sync_playwright() as p:
        navegador = p.chromium.launch()
        for i, caso in enumerate(CASOS):
            pagina = navegador.new_page(viewport={"width": 1100, "height": 900}, locale="es-ES")
            errores = []
            pagina.on("console", lambda m: errores.append(m.text) if m.type == "error" else None)
            pagina.on("pageerror", lambda e: errores.append(str(e)))
            pagina.goto(url)
            pagina.wait_for_selector(".cl-opciones")
            fotos = carpeta_capturas if (args.capturas and i == 1) else None
            nivel, titulo, bloques = recorrer(pagina, caso, fotos)
            if fotos is not None:
                pagina.locator("#clasificador").screenshot(path=str(fotos / "captura-resultado.png"))
            ok = nivel == caso["nivel"] and bloques > 0 and not errores
            fallos += not ok
            print(f"[{'OK' if ok else 'FALLO'}] {caso['nombre']}: «{nivel}» / «{titulo}» "
                  f"({bloques} bloques, {len(errores)} errores de consola)")
            for e in errores:
                print("    consola:", e)
            pagina.close()
        navegador.close()
    if servidor:
        servidor.shutdown()
    print(f"Modo: {'HTTP' if args.http else 'fichero local'} · {len(CASOS) - fallos}/{len(CASOS)} casos correctos")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
