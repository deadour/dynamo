# Lanzamiento de Dynamo en LinkedIn

Guía para publicar el proyecto sin exponer secretos ni mandar a la gente a una demo rota.

## ¿Conviene publicarlo?

Sí, pero presentándolo como **MVP en desarrollo / beta pública**, no como producto terminado.

Dynamo ya tiene suficientes funcionalidades para mostrar:

- Registro con email y Google.
- Catálogo de ejercicios con nombres en español, fotos e instrucciones.
- Creación de ejercicios personalizados.
- Rutinas tipo playlist para empezar a entrenar siguiendo una lista.
- Compartir rutinas por enlace y guardarlas en otra cuenta.
- Registro de entrenamientos y series.
- Gráficos de progreso y peso corporal.
- Perfil editable.
- Feed de comunidad con publicaciones, fotos, logros, likes y comentarios.
- Cloudinary para almacenar imágenes sin llenar Neon.

La publicación sirve para conseguir feedback, detectar errores reales y mostrar capacidad técnica. Conviene decir claramente que está en beta.

## Antes de publicar

### Producción

- [ ] El frontend abre desde una ventana incógnito.
- [ ] El backend responde `/health/` y `/readiness/`.
- [ ] Se puede crear una cuenta nueva.
- [ ] Funciona el login con Google si está configurado.
- [ ] Se puede crear una rutina.
- [ ] Se puede compartir una rutina.
- [ ] El enlace compartido abre sin estar logueado.
- [ ] Después del login se puede guardar la rutina.
- [ ] Se puede crear un ejercicio personalizado.
- [ ] Se puede subir avatar.
- [ ] Se puede subir una foto de progreso.
- [ ] Se puede publicar una foto en Comunidad.
- [ ] Likes y comentarios funcionan.
- [ ] Render tiene las variables de Cloudinary cargadas.
- [ ] No hay secretos en GitHub.

### Variables que nunca deben aparecer en el post

No publicar capturas ni texto que contenga:

```text
DJANGO_SECRET_KEY
DATABASE_URL
GOOGLE_CLIENT_ID completo si no querés exponerlo
CLOUDINARY_API_SECRET
CLOUDINARY_API_KEY
```

El `CLOUDINARY_API_SECRET` solamente debe existir en Render y en el `.env` local ignorado.

## Qué capturas conviene preparar

Preparar entre 3 y 5 imágenes:

1. Dashboard con progreso.
2. Catálogo de ejercicios.
3. Editor de rutinas.
4. Pantalla de rutina compartida.
5. Feed de Comunidad.

Para la publicación principal conviene usar una sola imagen clara o un carrusel corto. Si la app todavía no tiene suficientes datos reales, crear una cuenta demo con datos ficticios.

No mostrar emails reales, tokens, URLs internas de base de datos ni variables de entorno en las capturas.

## Texto sugerido para la primera publicación

```text
Estoy construyendo Dynamo, una app para registrar entrenamientos y entender el progreso de una forma más simple.

La idea empezó como un tracker personal y fue creciendo hasta convertirse en una experiencia completa:

• Registro de series, repeticiones y pesos
• Gráficos de progreso
• Catálogo de ejercicios en español
• Ejercicios personalizados creados por cada usuario
• Rutinas tipo playlist para entrenar siguiendo una secuencia
• Rutinas compartibles por enlace
• Perfil con login por email o Google
• Comunidad para compartir logros, fotos y entrenamientos

Estoy probando la beta y me interesa especialmente recibir feedback sobre:

1. Qué tan fácil resulta registrar un entrenamiento.
2. Qué información les gustaría ver en el progreso.
3. Qué funciones sociales sumarían.

La app está construida con React, TypeScript, Django, Django REST Framework, PostgreSQL/Neon, Render y Cloudinary.

Si alguien entrena y quiere probarla, dejo el enlace en los comentarios.

#buildinpublic #webdevelopment #react #django #fitnessapp #startup
```

## Versión más corta

```text
Estoy construyendo Dynamo, una app fitness para registrar entrenamientos, crear rutinas y medir progreso.

Ahora también permite crear ejercicios propios, compartir rutinas por enlace y próximamente publicar logros y fotos en una comunidad.

Stack: React + TypeScript + Django + PostgreSQL + Render + Cloudinary.

Estoy buscando personas que entrenen para probar la beta y dar feedback real.

#buildinpublic #react #django #fitnessapp
```

## Cómo publicarlo desde LinkedIn

1. Entrar a LinkedIn.
2. En la pantalla de inicio elegir **Iniciar una publicación**.
3. Seleccionar visibilidad **Cualquiera**.
4. Pegar uno de los textos anteriores.
5. Agregar una captura de la app o un video corto.
6. Agregar el enlace público de Dynamo.
7. Revisar que no aparezcan secretos ni datos personales.
8. Publicar.

LinkedIn permite crear publicaciones desde el cuadro principal, elegir quién puede verlas y agregar imágenes o videos. El límite informado para una publicación de texto es de 3.000 caracteres. [Ayuda oficial de LinkedIn](https://www.linkedin.com/help/linkedin/answer/a527227)

Para compartir un enlace, conviene pegar la URL después del texto y esperar unos segundos a que LinkedIn genere la vista previa. [Compartir enlaces en LinkedIn](https://www.linkedin.com/help/linkedin/answer/a525301/sharing-articles-or-links?lang=en)

## ¿Link en la publicación o en comentarios?

Recomendación práctica:

- Primera publicación: texto + imagen + link en el último párrafo.
- Si la vista previa queda fea: publicar la imagen y dejar el link en el primer comentario.
- Responder los comentarios con el enlace de la demo y explicar cómo probarla.

Ejemplo:

```text
Demo: https://TU-FRONTEND.onrender.com
Si encuentran un error o tienen una sugerencia, déjenla en los comentarios.
```

## Qué responder si preguntan por la tecnología

```text
El frontend está hecho con React, TypeScript, Vite y Recharts. El backend usa Django REST Framework, PostgreSQL y autenticación por sesión/token. Render aloja los servicios y Cloudinary guarda las imágenes para no cargar los archivos directamente en la base de datos.
```

## Qué responder si preguntan si está terminado

```text
Está en beta. La parte central ya funciona, pero todavía estoy validando la experiencia con usuarios reales y ajustando detalles de comunidad, moderación y almacenamiento de imágenes.
```

## Qué no conviene prometer todavía

- Escalabilidad para miles de usuarios.
- Disponibilidad 24/7.
- Backups profesionales si todavía no están configurados.
- Moderación automática.
- Privacidad equivalente a una red social madura.
- Que las fotos nunca serán eliminadas por límites del plan gratuito.

## Después de publicar

Registrar feedback en una lista con estas categorías:

```text
Bug crítico       La app no permite continuar.
Bug visual        Se ve mal, pero se puede usar.
UX                La función existe, pero no se entiende.
Feature           Algo nuevo que falta.
Performance       La pantalla carga lento.
Moderación        Reportes, bloqueo o privacidad.
```

Priorizar primero los errores que impidan:

1. Registrarse.
2. Crear un ejercicio.
3. Crear una rutina.
4. Entrenar.
5. Compartir una rutina.
6. Publicar una foto.

## Checklist final de publicación

- [ ] Demo online verificada.
- [ ] Render redeployado después del último commit.
- [ ] Migraciones aplicadas.
- [ ] Variables Cloudinary verificadas.
- [ ] Cuenta demo preparada.
- [ ] Capturas sin datos sensibles.
- [ ] Texto revisado.
- [ ] Link público probado desde incógnito.
- [ ] Post marcado como beta/MVP.
- [ ] Primer comentario preparado con el link.
