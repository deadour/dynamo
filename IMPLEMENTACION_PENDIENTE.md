# Dynamo — implementación pendiente

Este documento resume únicamente lo que falta para cerrar el proyecto.

## Estado actual

Ya está implementado:

- Backend Django + DRF.
- PostgreSQL mediante Docker Compose.
- Usuario custom y sesiones HttpOnly.
- Endpoint de login Google en backend.
- Catálogo y búsqueda de ejercicios.
- Entrenamientos, ejercicios y series.
- Peso corporal.
- Dashboard y progreso básico.
- Aislamiento entre usuarios.
- Historial de entrenamientos.
- Tests backend y frontend básicos.
- CI, Docker Compose y configuración inicial de Render.

## 1. Integrar Google Identity Services

### Crear credenciales

En Google Cloud Console:

1. Crear o seleccionar un proyecto.
2. Configurar OAuth consent screen.
3. Crear credencial **OAuth Client ID**.
4. Elegir tipo **Web application**.
5. Agregar estos orígenes locales:

```text
http://localhost
http://localhost:5173
```

6. Guardar el Client ID.

No subir el client secret al repositorio.

### Variables locales

Agregar en `.env`:

```env
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
```

### Frontend

Agregar la librería GIS en `frontend/index.html`:

```html
<script src="https://accounts.google.com/gsi/client" async></script>
```

Modificar `frontend/src/main.tsx`:

1. Mostrar botón “Continuar con Google”.
2. Leer `VITE_GOOGLE_CLIENT_ID`.
3. Inicializar `google.accounts.id.initialize`.
4. Renderizar el botón con `google.accounts.id.renderButton`.
5. Enviar el `credential` a:

```text
POST /api/auth/google/
```

Body:

```json
{
  "credential": "TOKEN_DE_GOOGLE"
}
```

6. Redirigir a `/dashboard` si la respuesta es correcta.
7. Mostrar errores de login.
8. Mantener el login de desarrollo únicamente cuando `DEBUG=1`.

El backend ya valida el token y usa `google_sub` como identificador del usuario.

## 2. Mejorar el registro de entrenamientos

Actualmente el recorder funciona, pero pide pegar el UUID del ejercicio.

Modificar `frontend/src/main.tsx` para:

- Buscar ejercicios mientras se escribe.
- Mostrar nombre, equipamiento e imagen.
- Permitir seleccionar un ejercicio desde una lista.
- Guardar el ID seleccionado internamente.
- Mostrar la última sesión del ejercicio.
- Agregar varias series al mismo ejercicio sin crear el ejercicio nuevamente.
- Permitir eliminar una serie.
- Permitir agregar otro ejercicio.
- Confirmar antes de descartar una sesión activa.

El flujo esperado:

```text
Iniciar entrenamiento
  → Buscar ejercicio
  → Seleccionar ejercicio
  → Agregar series
  → Agregar otro ejercicio
  → Finalizar entrenamiento
```

## 3. Completar interfaz de progreso

En la pantalla de progreso agregar:

- Gráfico de mejor peso por sesión.
- Gráfico de 1RM estimado.
- Gráfico de volumen.
- Filtros de 30 días, 90 días, 6 meses, 1 año y todo.
- Tabla con fecha, peso, repeticiones, series, volumen y 1RM.

Usar Recharts, ya incluido en el frontend.

## 4. Completar peso corporal

Agregar en `/body-weight`:

- Gráfico temporal.
- Peso actual.
- Cambio en 7 días.
- Cambio en 30 días.
- Máximo y mínimo.
- Editar registro.
- Eliminar registro con confirmación.

No mostrar cambios si no existen datos suficientes.

## 5. Deploy de staging

### Backend

Crear un servicio backend en Render usando `backend/Dockerfile`.

Configurar:

```env
DJANGO_SECRET_KEY=secreto_largo_y_aleatorio
DATABASE_URL=postgresql://...
DEBUG=0
ALLOWED_HOSTS=backend.onrender.com
CORS_ALLOWED_ORIGINS=https://frontend.onrender.com
CSRF_TRUSTED_ORIGINS=https://frontend.onrender.com
FRONTEND_URL=https://frontend.onrender.com
BACKEND_URL=https://backend.onrender.com
GOOGLE_CLIENT_ID=...
```

Ejecutar antes del arranque:

```bash
python manage.py migrate --noinput
```

Comprobar:

```text
https://backend.onrender.com/health/
```

### Frontend

Configurar la variable de build:

```env
VITE_API_URL=https://backend.onrender.com
VITE_GOOGLE_CLIENT_ID=...
```

Build:

```bash
npm ci
npm run build
```

Actualizar en Google Cloud el origen autorizado:

```text
https://frontend.onrender.com
```

## 6. Tests E2E

Agregar Playwright o una alternativa equivalente.

Smoke test mínimo:

1. Login de desarrollo.
2. Abrir dashboard.
3. Abrir nuevo entrenamiento.
4. Buscar y seleccionar un ejercicio.
5. Agregar `80 kg × 10 reps`.
6. Finalizar entrenamiento.
7. Abrir historial.
8. Abrir detalle.
9. Abrir progreso.
10. Confirmar que el volumen y el 1RM aparecen.

## 7. Seguridad y producción

Antes de producción:

- Ejecutar `python manage.py check --deploy`.
- Usar una clave secreta real de más de 50 caracteres.
- Confirmar HTTPS.
- Confirmar cookies Secure.
- Confirmar CORS y CSRF con dominios exactos.
- No permitir login de desarrollo con `DEBUG=0`.
- No subir `.env`.
- Configurar backups de PostgreSQL.
- Configurar monitoreo de `/health/`.
- Configurar rollback.
- Revisar logs para no exponer tokens ni cookies.
- Configurar política de privacidad.

## 8. Validación final

Ejecutar:

```bash
cd backend
python manage.py check
python manage.py check --deploy
python manage.py makemigrations --check
pytest -q

cd ../frontend
npm ci
npm run lint
npm run test -- --run
npm run build

cd ..
docker compose config
docker compose build
```

## Definition of Done

- [ ] Login Google funciona localmente.
- [ ] Login Google funciona en staging.
- [ ] El recorder no requiere UUID manual.
- [ ] Se pueden cargar varios ejercicios y series.
- [ ] Historial y progreso reflejan los datos reales.
- [ ] Peso corporal tiene gráfico y CRUD completo.
- [ ] Tests backend verdes.
- [ ] Tests frontend verdes.
- [ ] Smoke E2E verde.
- [ ] Docker build correcto.
- [ ] Deploy staging correcto.
- [ ] `check --deploy` sin errores críticos.
- [ ] Backups y monitoreo configurados.
