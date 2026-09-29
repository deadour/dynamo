# Deploy de staging — Dynamo

Este documento describe cómo publicar Dynamo en staging usando Render y una base PostgreSQL administrada.

## 1. Crear PostgreSQL

Crear una base PostgreSQL persistente en Render, Supabase, Neon u otro proveedor compatible.

Guardar la URL de conexión:

```env
DATABASE_URL=postgresql://usuario:password@host:5432/base
```

La base debe tener backups y no debe ser una base temporal para producción.

## 2. Crear el backend en Render

Crear un Web Service conectado al repositorio.

Configuración:

```text
Runtime: Docker
Dockerfile: backend/Dockerfile
Health check path: /health/
```

Variables de entorno del backend:

```env
DJANGO_SECRET_KEY=generar-una-clave-larga-y-aleatoria
DATABASE_URL=postgresql://...
DEBUG=0
ALLOWED_HOSTS=tu-backend.onrender.com
FRONTEND_URL=https://tu-frontend.onrender.com
BACKEND_URL=https://tu-backend.onrender.com
CORS_ALLOWED_ORIGINS=https://tu-frontend.onrender.com
CSRF_TRUSTED_ORIGINS=https://tu-frontend.onrender.com
GOOGLE_CLIENT_ID=351391750469-l1lmbldkvo070o0e09u26en9qm353n80.apps.googleusercontent.com
```

El contenedor ejecuta las migraciones antes de iniciar Gunicorn.

Comprobar el backend:

```text
https://tu-backend.onrender.com/health/
```

Respuesta esperada:

```json
{"status":"ok"}
```

## 3. Crear el frontend en Render

Crear un Static Site conectado al mismo repositorio y commit que el backend.

Configuración:

```text
Build command: cd frontend && npm ci && npm run build
Publish directory: frontend/dist
```

Variables de build:

```env
VITE_API_URL=https://tu-backend.onrender.com
VITE_GOOGLE_CLIENT_ID=351391750469-l1lmbldkvo070o0e09u26en9qm353n80.apps.googleusercontent.com
```

El backend y frontend deben salir del mismo commit para evitar incompatibilidades de API.

## 4. Configurar Google OAuth

En Google Cloud Console, abrir el OAuth Client ID usado por Dynamo.

Agregar como origen autorizado la URL final del frontend:

```text
https://tu-frontend.onrender.com
```

No agregar `/login` ni otras rutas. Solo el origen completo.

Para desarrollo local también deben estar configurados:

```text
http://localhost
http://localhost:5173
```

El Client ID es público. No subir client secrets ni secretos de servidor al repositorio.

## 5. Orden recomendado de publicación

1. Crear PostgreSQL.
2. Crear y configurar el backend.
3. Esperar que `/health/` responda correctamente.
4. Crear y configurar el frontend.
5. Copiar la URL final del frontend a Google OAuth.
6. Volver a desplegar el frontend si fue necesario.
7. Actualizar CORS y CSRF del backend con las URLs definitivas.
8. Ejecutar el smoke test.

## 6. Smoke test de staging

Desde la URL pública del frontend:

- [ ] La pantalla de login carga.
- [ ] El botón de Google aparece.
- [ ] El login Google crea o recupera el usuario.
- [ ] Recargar la página conserva la sesión.
- [ ] El dashboard carga sin requests a `localhost`.
- [ ] Se puede crear un entrenamiento.
- [ ] Se puede seleccionar un ejercicio.
- [ ] Se puede agregar una serie.
- [ ] Se puede finalizar el entrenamiento.
- [ ] El entrenamiento aparece en el historial.
- [ ] El progreso refleja volumen y 1RM.
- [ ] Se puede registrar peso corporal.
- [ ] Logout invalida la sesión.
- [ ] Un usuario sin sesión no puede acceder a datos privados.
- [ ] `/health/` responde HTTP 200.

## 7. Validaciones antes de producción

Ejecutar localmente:

```bash
cd backend
python manage.py check --deploy
python manage.py makemigrations --check
pytest -q

cd ../frontend
npm ci
npm run lint
npm run test -- --run
npm run build
```

También verificar:

- [ ] Backups de PostgreSQL configurados.
- [ ] Dominio HTTPS definitivo configurado.
- [ ] Monitoreo de `/health/` configurado.
- [ ] Procedimiento de rollback definido.
- [ ] Política de privacidad publicada.
- [ ] No existen secretos en Git.
- [ ] `DEBUG=0` en producción.
- [ ] El login de desarrollo está deshabilitado en producción.
