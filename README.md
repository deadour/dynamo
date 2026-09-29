# Dynamo

Dynamo es una aplicación full-stack mobile-first para registrar entrenamientos, peso corporal y progreso. El backend Django/DRF es la fuente de verdad de las métricas y del aislamiento multiusuario.

## Desarrollo rápido

```bash
cp .env.example .env
docker compose up --build
```

Abrí `http://localhost:5173`, `http://localhost:8000/api/docs/` y `http://localhost:8000/health/`. En desarrollo el botón de login usa un usuario demo; está deshabilitado cuando `DEBUG=0`. Para uso real, configurar Google Identity Services y completar la validación del credential en el endpoint `/api/auth/google/` antes de producción.

## Stack y comandos

React + TypeScript + Vite, Django REST Framework, PostgreSQL, Docker, pytest, Vitest y GitHub Actions. `make migrate`, `make seed`, `make test`, `make lint`, `make down` y `make clean-data` son los comandos habituales (`clean-data` elimina el volumen local).

El catálogo se importa con `python manage.py import_exercises --file exercises.json`. El importador es idempotente y conserva `external_id`; la fuente prevista es [free-exercise-db](https://github.com/yuhonas/free-exercise-db), cuyos assets se usan mediante URLs remotas en v1. No se hace scraping. `python manage.py seed_dev` crea el usuario y ejercicio demo.

## Configuración y deploy

Copiar todas las variables de `.env.example`. En producción son obligatorias una `DJANGO_SECRET_KEY` aleatoria, `DATABASE_URL` de PostgreSQL administrado, `DEBUG=0`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS`. Render está descrito en `render.yaml`; el frontend puede ser static site y el backend Docker web service. Las migraciones se ejecutan antes de arrancar el backend.

El volumen calculado es `peso × repeticiones` solamente para series completadas; una serie con `weight_kg=0` representa bodyweight sin sumar automáticamente el peso corporal. El 1RM estimado usa Epley. Nunca se guardan secretos en el repositorio.

## Arquitectura

`users`, `exercises`, `workouts`, `bodymetrics` y `progress` son apps Django separadas, pero un único servicio. UUIDs protegen entidades expuestas y cada queryset privado filtra por usuario autenticado. La SPA usa cookies de sesión HttpOnly y TanStack Query-ready API fetch, con navegación mobile-first.

## Limitaciones conocidas de v1

- La pantalla de OAuth Google requiere configurar y terminar el intercambio/validación de Google GIS con credenciales reales; el login de desarrollo no se habilita en producción.
- El recorder inicial prioriza el flujo básico de una serie y necesita una segunda iteración para edición inline, reorder y duplicado completo.
- Los gráficos avanzados y el service worker PWA quedan preparados mínimamente; el historial y métricas ya provienen de API real.
