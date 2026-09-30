# Integración de Cloudinary en Dynamo

Guía para dejar de guardar imágenes binarias dentro de Neon y pasar a Cloudinary.

## Objetivo

Neon debe guardar únicamente información y URLs:

```text
Neon:
  usuario
  publicación
  foto_url
  fecha

Cloudinary:
  archivo real de imagen
  versiones optimizadas
  miniaturas
```

Esto evita que los avatares, fotos de progreso y fotos del feed consuman rápidamente el límite de la base de datos.

## 1. Crear la cuenta

1. Entrar a [Cloudinary](https://cloudinary.com/).
2. Crear una cuenta gratuita.
3. Desde el Dashboard copiar:
   - `Cloud name`
   - `API Key`
   - `API Secret`
4. Nunca subir `API Secret` al repositorio ni escribirlo en el frontend.

El plan gratuito usa créditos para combinar almacenamiento, transformaciones y ancho de banda. No es almacenamiento ilimitado: hay que revisar el consumo desde el panel de Cloudinary.

## 2. Variables de entorno

Agregar localmente al `.env` del backend:

```env
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

En Render, agregar las mismas variables en el servicio `dynamo-backend` desde:

```text
Dashboard → dynamo-backend → Environment → Add Environment Variable
```

No poner estas variables en:

- `frontend/.env.local`
- `render.yaml` con valores reales
- `datos.txt`
- commits de Git

## 3. Dependencias del backend

Agregar en `backend/requirements.txt`:

```text
cloudinary>=1.44
```

Después instalar localmente:

```powershell
cd backend
pip install -r requirements.txt
```

Render instalará la dependencia automáticamente durante el próximo deploy porque el Dockerfile ya instala `requirements.txt`.

## 4. Configuración de Django

En `backend/config/settings.py` agregar:

```python
CLOUDINARY_STORAGE = {
    "CLOUD_NAME": os.getenv("CLOUDINARY_CLOUD_NAME", ""),
    "API_KEY": os.getenv("CLOUDINARY_API_KEY", ""),
    "API_SECRET": os.getenv("CLOUDINARY_API_SECRET", ""),
}
```

No hace falta reemplazar todo el almacenamiento estático de Django. Cloudinary se usará explícitamente desde los endpoints de imágenes.

## 5. Estrategia recomendada

Para Dynamo conviene usar **uploads firmidos desde el backend**:

```text
Frontend → Django solicita firma
Frontend → Cloudinary sube la imagen con la firma
Frontend → Django guarda la URL recibida
```

Ventajas:

- El `API Secret` nunca llega al navegador.
- Django controla quién puede subir.
- Se pueden limitar tipo, tamaño y carpeta.
- El backend puede validar que la URL pertenece a Cloudinary.

No usar uploads unsigned para fotos privadas de usuarios salvo que se configure un upload preset muy limitado.

## 6. Endpoint para obtener una firma

Crear en `backend/media/views.py` una vista similar a esta:

```python
import time

import cloudinary
import cloudinary.utils
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_signature(request):
    folder = request.data.get("folder", "dynamo/uploads")
    allowed = {"dynamo/avatars", "dynamo/progress", "dynamo/exercises", "dynamo/posts"}
    if folder not in allowed:
        return Response({"detail": "Carpeta no válida."}, status=400)

    timestamp = int(time.time())
    params = {"folder": folder, "timestamp": timestamp}
    signature = cloudinary.utils.api_sign_request(
        params,
        settings.CLOUDINARY_STORAGE["API_SECRET"],
    )
    return Response({
        "timestamp": timestamp,
        "signature": signature,
        "api_key": settings.CLOUDINARY_STORAGE["API_KEY"],
        "cloud_name": settings.CLOUDINARY_STORAGE["CLOUD_NAME"],
        "folder": folder,
    })
```

Registrar la ruta en `backend/config/urls.py`:

```python
from media.views import upload_signature

urlpatterns = [
    # ...rutas existentes...
    path("api/media/signature/", upload_signature),
]
```

El endpoint solamente firma la subida. La imagen todavía debe validarse en el backend antes de guardar su URL.

## 7. Subida desde el frontend

Crear una función reutilizable en `frontend/src/main.tsx` o, preferentemente, en un archivo `frontend/src/lib/cloudinary.ts`:

```ts
export async function uploadImage(file: File, folder: string) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Elegí una imagen válida.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("La imagen no puede superar los 5 MB.");
  }

  const signed = await api("/api/media/signature/", {
    method: "POST",
    body: JSON.stringify({ folder }),
  });

  const body = new FormData();
  body.append("file", file);
  body.append("api_key", signed.api_key);
  body.append("timestamp", String(signed.timestamp));
  body.append("signature", signed.signature);
  body.append("folder", signed.folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signed.cloud_name}/image/upload`,
    { method: "POST", body },
  );

  if (!response.ok) {
    throw new Error("Cloudinary no pudo guardar la imagen.");
  }

  return response.json();
}
```

La respuesta incluye normalmente:

```json
{
  "secure_url": "https://res.cloudinary.com/...",
  "public_id": "dynamo/posts/...",
  "width": 1200,
  "height": 900,
  "bytes": 183421
}
```

Guardar `secure_url` en Dynamo. También conviene guardar `public_id` para poder borrar la imagen después.

## 8. Qué modelos cambiar

### Avatar

El modelo actual `User` tiene:

```python
avatar = models.BinaryField(...)
avatar_type = models.CharField(...)
avatar_url = models.URLField(...)
```

Agregar:

```python
avatar_public_id = models.CharField(max_length=255, blank=True)
```

Durante la migración:

- Las imágenes nuevas usan Cloudinary.
- `avatar_url` guarda `secure_url`.
- `avatar_public_id` permite borrar el archivo.
- `avatar` queda temporalmente para no perder fotos existentes.

### Fotos de progreso

El modelo actual `BodyWeight` también guarda la foto como `BinaryField`. Agregar:

```python
photo_url = models.URLField(blank=True)
photo_public_id = models.CharField(max_length=255, blank=True)
```

La vista debe priorizar `photo_url` y usar el binario solamente como fallback durante la transición.

### Ejercicios personalizados

Agregar al modelo `Exercise`:

```python
custom_image_url = models.URLField(blank=True)
custom_image_public_id = models.CharField(max_length=255, blank=True)
```

Las imágenes del dataset externo pueden continuar usando `image_1` e `image_2`. Para ejercicios creados por usuarios se pueden usar los nuevos campos.

### Publicaciones del feed

Cuando se implemente el feed, usar un modelo parecido a:

```python
class Post(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    text = models.TextField(blank=True, max_length=1000)
    image_url = models.URLField(blank=True)
    image_public_id = models.CharField(max_length=255, blank=True)
    post_type = models.CharField(max_length=30, default="text")
    workout = models.ForeignKey("workouts.Workout", null=True, blank=True, on_delete=models.SET_NULL)
    routine = models.ForeignKey("workouts.Routine", null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
```

## 9. Transformaciones recomendadas

No mostrar la imagen original directamente en el feed. Usar transformaciones de Cloudinary:

```text
Feed:
  width 900
  height 900
  crop fill
  quality auto
  format auto

Avatar:
  width 256
  height 256
  crop fill
  gravity face
  quality auto
  format auto
```

Esto reduce el peso de la app y mejora la velocidad en celulares.

## 10. Migración de fotos existentes

No borrar los campos binarios de entrada.

Orden recomendado:

1. Crear campos `avatar_url`, `avatar_public_id`, `photo_url` y `photo_public_id`.
2. Deployar la migración.
3. Hacer que la app lea primero las URLs Cloudinary.
4. Crear un comando Django para convertir los binarios actuales a Cloudinary.
5. Verificar que todas las fotos migraron.
6. Dejar de escribir nuevos binarios.
7. Recién después eliminar `BinaryField` en otra migración.

Nunca ejecutar el paso 7 sin tener una copia o verificación de las imágenes.

## 11. Seguridad

- Nunca exponer `CLOUDINARY_API_SECRET` en React.
- Validar MIME real, no solamente la extensión.
- Limitar tamaño a 5 MB para fotos del feed.
- Limitar avatares a 500 KB o 1 MB.
- Permitir JPG, PNG, WebP y HEIC solamente si se agrega conversión.
- No aceptar SVG de usuarios sin sanitización.
- Usar carpetas separadas por tipo de contenido.
- Guardar `public_id` para poder eliminar archivos.
- Agregar reportar/bloquear antes de abrir el feed públicamente.
- No publicar fotos de progreso automáticamente: debe ser una decisión explícita del usuario.

## 12. Render

Agregar en Render:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

Después:

1. Guardar las variables.
2. Hacer un deploy manual o esperar el deploy del próximo commit.
3. Revisar los logs del backend.
4. Probar subir un avatar.
5. Probar subir una foto de progreso.
6. Revisar en Cloudinary que aparezca en la carpeta correcta.

No hace falta agregar Cloudinary al `render.yaml` con secretos reales. Si se agrega la estructura al Blueprint, debe ser:

```yaml
- key: CLOUDINARY_CLOUD_NAME
  sync: false
- key: CLOUDINARY_API_KEY
  sync: false
- key: CLOUDINARY_API_SECRET
  sync: false
```

## 13. Checklist de implementación

- [ ] Crear cuenta Cloudinary.
- [ ] Copiar credenciales sin subirlas al repositorio.
- [ ] Agregar dependencia Python.
- [ ] Agregar variables locales y de Render.
- [ ] Crear endpoint de firma.
- [ ] Crear helper de upload en frontend.
- [ ] Migrar avatar.
- [ ] Migrar fotos de progreso.
- [ ] Agregar fotos a ejercicios personalizados.
- [ ] Crear modelo de publicaciones.
- [ ] Agregar feed paginado.
- [ ] Agregar borrado de imágenes al borrar publicaciones.
- [ ] Agregar límites y reportes.
- [ ] Probar con una cuenta normal y otra cuenta diferente.

## Fuentes oficiales

- [Cloudinary: billing y planes](https://cloudinary.com/documentation/billing_and_plans)
- [Cloudinary: cómo funcionan los créditos](https://cloudinary.com/documentation/developer_onboarding_faq_credits)
- [Cloudinary: comparación de planes](https://cloudinary.com/pricing/compare-plans)
