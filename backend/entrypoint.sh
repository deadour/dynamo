#!/bin/sh
set -e

python manage.py migrate --noinput
if [ "${IMPORT_EXERCISES_ON_START:-1}" = "1" ]; then
    python manage.py import_exercises || echo "Exercise import failed; continuing with existing catalog"
fi
# Ping propio cada 10 min para que Render no duerma el servicio (ver keepalive.py).
python keepalive.py &

exec gunicorn config.wsgi:application --bind 0.0.0.0:8000
