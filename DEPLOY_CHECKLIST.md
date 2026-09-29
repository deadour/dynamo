# Checklist para deploy de Dynamo

## Estado actual

**No está listo para producción todavía.** La base funciona y los checks locales pasan, pero faltan cerrar autenticación, configuración de dominios y una estrategia de despliegue reproducible.

Checks ejecutados el 25/09/2026:

- Backend: `python manage.py check` OK.
- Backend: tests OK (`2 passed`).
- Frontend: lint OK, con warning porque `eslint.config.js` está vacío.
- Frontend: tests OK (`2 passed`).
- Frontend: build OK.
- `makemigrations --check` no terminó en la ejecución local; repetirlo con PostgreSQL levantado y revisar que CI lo complete.

## Bloqueantes antes de abrirlo al público

### 1. Autenticación de producción

- [ ] Configurar un OAuth Client de Google para la URL real del frontend.
- [ ] Cargar `GOOGLE_CLIENT_ID` en el backend.
- [ ] Implementar en el frontend el botón/flujo de Google Identity Services.
- [ ] Reemplazar o esconder el botón `Continuar en modo desarrollo` cuando `DEBUG=0`.
- [ ] Probar login, refresh, logout y sesión vencida en un navegador real.
- [ ] Verificar que el email de Google sea único y que no se creen usuarios duplicados al cambiar el método de login.

### 2. Variables y dominios

Definir en el proveedor de hosting, sin subir secretos al repositorio:

| Variable | Valor de producción |
|---|---|
| `DJANGO_SECRET_KEY` | Secreto aleatorio largo y exclusivo de producción |
| `DEBUG` | `0` |
| `DATABASE_URL` | URL de PostgreSQL administrado con SSL si el proveedor lo requiere |
| `ALLOWED_HOSTS` | Host del backend, sin `http://` ni rutas |
| `CORS_ALLOWED_ORIGINS` | URL exacta del frontend, con `https://` |
| `CSRF_TRUSTED_ORIGINS` | URL exacta del frontend, con `https://` |
| `FRONTEND_URL` | URL pública del frontend |
| `BACKEND_URL` | URL pública del backend |
| `GOOGLE_CLIENT_ID` | Client ID de Google |

- [ ] Agregar `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `BACKEND_URL` y `GOOGLE_CLIENT_ID` a la configuración del servicio en `render.yaml` o cargarlas manualmente.
- [ ] Configurar `VITE_API_URL` en el build del frontend con la URL pública del backend. Hoy el static site de Render no la define y el código cae en `http://localhost:8000`.
- [ ] Confirmar que `.env` nunca se trackee (`git ls-files .env` debe no devolver nada).
- [ ] Rotar cualquier secreto que haya sido compartido fuera del gestor de secretos.

### 3. Migraciones y arranque del backend

- [ ] Ejecutar `python manage.py migrate --noinput` como pre-deploy o release command, no depender solamente del `CMD` del contenedor.
- [ ] Confirmar que el servicio tenga una base PostgreSQL persistente y backups automáticos.
- [ ] Ejecutar `python manage.py check --deploy` con `DEBUG=0` y corregir todos los warnings.
- [ ] Definir cantidad de workers/timeouts de Gunicorn según el plan del proveedor.
- [ ] Decidir si se necesita un comando de carga inicial (`import_exercises`); ejecutarlo una sola vez y de forma idempotente.
- [ ] Crear un usuario administrador de forma segura si se va a exponer Django Admin; hoy no hay ruta de admin configurada.

### 4. Conectar frontend y backend

- [ ] Deployar primero el backend y comprobar `/health/`.
- [ ] Configurar el frontend con `VITE_API_URL=https://<backend>...` y volver a compilar.
- [ ] Actualizar CORS y CSRF con la URL definitiva del frontend.
- [ ] Probar desde la URL pública: `GET /csrf/`, `GET /api/auth/me/`, login Google, una escritura autenticada y logout.
- [ ] Verificar cookies de sesión/CSRF en HTTPS y en el navegador objetivo.
- [ ] Configurar el dominio final antes de registrar los orígenes permitidos de Google.

## Recomendaciones importantes antes de producción

- [ ] Agregar tests de API para permisos, aislamiento entre usuarios, login Google, CSRF y endpoints de escritura; la cobertura actual es mínima.
- [ ] Agregar un smoke test automatizado post-deploy contra `/health/` y al menos un endpoint autenticado.
- [ ] Reemplazar el `lambda` de `/health/` por una vista explícita y hacer que verifique dependencias críticas si el proveedor lo necesita.
- [ ] Configurar logging estructurado, retención y alertas para errores 5xx, reinicios y fallos de migración.
- [ ] Configurar monitoreo de uptime y un procedimiento de rollback.
- [ ] Confirmar política de backups y probar una restauración de PostgreSQL.
- [ ] Revisar límites de paginación, rate limiting y protección contra abuso del endpoint de login.
- [ ] Definir política de privacidad, tratamiento de datos personales y eliminación/exportación de cuenta.
- [ ] Revisar las URLs remotas del catálogo de ejercicios y su disponibilidad/licencia para producción.
- [ ] Completar el ESLint config; actualmente lint termina OK porque la configuración está vacía.
- [ ] Agregar `npm ci` en CI/deploy para usar exactamente `package-lock.json` en lugar de `npm install`.

## Ruta sugerida con Render

1. Crear PostgreSQL administrado.
2. Crear el web service del backend desde `backend/Dockerfile`.
3. Configurar todas las variables de la tabla anterior.
4. Configurar un pre-deploy command de migraciones: `python manage.py migrate --noinput`.
5. Deployar y validar `https://<backend>/health/`.
6. Crear el static site del frontend con `npm ci && npm run build` y `frontend/dist` como publish directory.
7. Definir `VITE_API_URL=https://<backend>` en las variables de build del static site.
8. Cargar la URL final del frontend en CORS, CSRF y Google OAuth.
9. Ejecutar el smoke test de la sección siguiente.

## Smoke test de aceptación

- [ ] Frontend carga directamente y también al refrescar `/dashboard`.
- [ ] `/health/` responde `200` y `{"status":"ok"}`.
- [ ] Usuario no autenticado no puede acceder a datos privados.
- [ ] Login Google crea o recupera el usuario correcto.
- [ ] Se puede crear un entrenamiento y una serie.
- [ ] Se puede registrar peso corporal.
- [ ] Un usuario no puede leer ni modificar datos de otro usuario.
- [ ] Logout invalida la sesión.
- [ ] No quedan requests a `localhost` en DevTools.
- [ ] No aparecen secretos en logs, artefactos ni respuestas de error.

## Decisión de salida

Se puede hacer un deploy de staging cuando estén resueltos los bloques 1 a 4. Para producción, además deben estar cerrados backups, monitoreo, rollback, política de privacidad y pruebas de aislamiento multiusuario.
