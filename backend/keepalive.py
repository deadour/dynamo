"""Mantiene despierto el backend en el plan gratis de Render.

Render duerme el servicio tras ~15 minutos sin tráfico entrante y despertarlo tarda ~1 minuto.
Este proceso le pega a la URL pública del propio servicio cada 10 minutos: el pedido entra por el
proxy de Render y cuenta como tráfico. Solo corre si Render definió RENDER_EXTERNAL_URL.
"""
import os
import time
import urllib.request

INTERVAL = int(os.environ.get("KEEPALIVE_SECONDS", "600"))


def main():
    base = os.environ.get("RENDER_EXTERNAL_URL") or os.environ.get("BACKEND_URL")
    if not base or os.environ.get("KEEPALIVE", "1") != "1":
        return
    url = base.rstrip("/") + "/health/"
    while True:
        time.sleep(INTERVAL)
        try:
            urllib.request.urlopen(url, timeout=60).read()
        except Exception as error:  # nunca tiene que tumbar nada: se reintenta en la próxima vuelta
            print(f"keepalive: {error}", flush=True)


if __name__ == "__main__":
    main()
