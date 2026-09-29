Quiero que construyas desde cero una aplicación web full-stack personal para seguimiento de gimnasio llamada provisionalmente **GymTrack**.

No quiero solamente un scaffold, mockup o proof of concept.

Quiero una **aplicación funcional, usable, testeada, dockerizada y preparada para deploy**, con arquitectura limpia pero sin sobreingeniería.

Trabajá de forma autónoma.

No me preguntes por decisiones menores que puedas resolver razonablemente.

Si existe ambigüedad, elegí la solución más simple, robusta, mantenible y apropiada para un proyecto personal real.

La prioridad es:

1. que funcione;
2. que sea agradable de usar desde el celular;
3. que los datos sean correctos;
4. que sea fácil de desarrollar localmente;
5. que sea fácil de desplegar;
6. que tenga CI/CD;
7. que quede suficientemente bien armado como proyecto de portfolio.

==================================================
0. OBJETIVO DEL PRODUCTO
==================================================

Construir una aplicación personal de seguimiento de entrenamiento de fuerza/gimnasio.

El usuario debe poder:

- iniciar sesión con Google;
- registrar su peso corporal;
- visualizar evolución del peso;
- consultar una biblioteca de ejercicios;
- ver imágenes de cada ejercicio;
- filtrar ejercicios;
- crear entrenamientos;
- registrar ejercicios realizados;
- registrar series;
- indicar peso y repeticiones por serie;
- ver el historial de un ejercicio;
- visualizar el progreso de ese ejercicio en el tiempo;
- consultar volumen de entrenamiento;
- consultar mejores marcas personales;
- estimar 1RM;
- repetir entrenamientos anteriores;
- utilizar cómodamente la aplicación desde un teléfono.

La aplicación inicialmente será personal, pero la arquitectura debe ser multiusuario correctamente aislada desde el comienzo.

Ningún usuario puede consultar o modificar datos privados de otro usuario.

==================================================
1. STACK OBLIGATORIO
==================================================

BACKEND

- Python 3.12+
- Django
- Django REST Framework
- PostgreSQL
- pytest
- pytest-django
- django-filter
- drf-spectacular para OpenAPI
- Gunicorn en producción

FRONTEND

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- React Hook Form
- Zod
- Tailwind CSS
- shadcn/ui cuando aporte valor
- Recharts para gráficos
- Lucide Icons

INFRA

- Docker
- Docker Compose
- GitHub Actions
- PostgreSQL local mediante Docker
- `.env` / `.env.example`
- healthchecks
- Makefile o scripts equivalentes para tareas frecuentes

No utilizar:

- SQLite como DB principal;
- Firebase;
- Supabase como backend de aplicación;
- Next.js;
- microservicios;
- Kubernetes;
- Redux salvo necesidad demostrable.

Django será el backend real.

React será una SPA independiente.

==================================================
2. ESTRUCTURA DEL REPOSITORIO
==================================================

Usar un monorepo aproximadamente así:

gymtrack/
│
├── backend/
│   ├── config/
│   ├── users/
│   ├── exercises/
│   ├── workouts/
│   ├── bodymetrics/
│   ├── progress/
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
│
├── infra/
│   └── nginx/ si realmente es necesario
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── Makefile
└── README.md

No crear repositorios separados.

==================================================
3. AUTENTICACIÓN
==================================================

Implementar autenticación con Google.

Quiero:

- botón "Continuar con Google";
- creación automática del usuario la primera vez;
- login posterior con la misma cuenta;
- logout;
- endpoint `/api/auth/me/`;
- frontend capaz de restaurar sesión al recargar;
- rutas privadas;
- redirects correctos;
- manejo claro de errores.

No almacenar passwords de Google.

Validar siempre en backend la identidad emitida por Google.

Preferir una arquitectura segura basada en:

Google Identity Services
→ frontend obtiene credencial/autorización
→ backend valida Google token/code
→ backend crea o recupera usuario
→ backend genera sesión propia.

Preferir cookies HttpOnly + Secure para autenticación de la aplicación si resulta razonable.

Si se utilizan JWT:

- access token corto;
- refresh token;
- refresh seguro;
- HttpOnly cookies;
- no guardar JWT sensibles en localStorage.

Configurar correctamente:

- CSRF;
- CORS;
- Secure;
- SameSite;
- Trusted Origins;
- variables de entorno;
- frontend URL;
- backend URL.

En desarrollo debe funcionar con localhost.

En producción debe quedar preparado para HTTPS.

Nunca hardcodear client secrets.

==================================================
4. MODELO DE DATOS
==================================================

Diseñar al menos estas entidades.

USER

Usar custom User model desde el principio si corresponde.

Campos mínimos:

- id;
- email;
- name;
- avatar_url;
- google_sub o equivalente;
- created_at;
- updated_at.

EXERCISE

Campos:

- id UUID;
- external_id nullable;
- name;
- slug;
- category;
- primary_muscles;
- secondary_muscles;
- equipment;
- force;
- mechanic;
- difficulty;
- instructions;
- image_1;
- image_2;
- source;
- source_url;
- is_custom;
- created_by nullable;
- active;
- created_at;
- updated_at.

Los ejercicios globales importados son visibles para todos.

Los ejercicios personalizados solamente pertenecen al usuario que los creó.

WORKOUT

- id UUID;
- user;
- name;
- started_at;
- finished_at nullable;
- notes;
- created_at;
- updated_at.

WORKOUT_EXERCISE

- id UUID;
- workout;
- exercise;
- order;
- notes;
- created_at.

WORKOUT_SET

- id UUID;
- workout_exercise;
- set_number;
- reps;
- weight_kg;
- set_type:
  - warmup
  - normal
  - drop
  - failure
- completed;
- created_at;
- updated_at.

BODY_WEIGHT

- id UUID;
- user;
- date;
- weight_kg;
- notes;
- created_at.

Opcional si resulta útil:

WORKOUT_TEMPLATE

WORKOUT_TEMPLATE_EXERCISE

No guardar estadísticas redundantes si pueden calcularse correctamente a partir de las series.

Agregar índices apropiados para:

- user;
- date;
- exercise;
- workout;
- combinación user + exercise + date.

Usar DecimalField para pesos, no float.

==================================================
5. DATASET DE EJERCICIOS
==================================================

Quiero una biblioteca inicial real de ejercicios con imágenes.

Fuente preferida:

https://github.com/yuhonas/free-exercise-db

Este dataset contiene más de 800 ejercicios con:

- nombre;
- músculos principales;
- músculos secundarios;
- equipamiento;
- categoría;
- instrucciones;
- imágenes.

NO quiero que la aplicación dependa de consultar la API/repositorio externo durante cada uso.

Crear un proceso de importación.

Implementar management command:

python manage.py import_exercises

El comando debe:

1. obtener o leer el dataset;
2. validar los campos;
3. normalizarlos;
4. importar/upsert a PostgreSQL;
5. no duplicar ejercicios si se ejecuta otra vez;
6. almacenar external_id;
7. almacenar source;
8. almacenar URLs de imágenes o assets según la estrategia elegida;
9. reportar:
   - creados;
   - actualizados;
   - omitidos;
   - errores.

Preferir que las imágenes no hagan depender el funcionamiento crítico de un API externo.

Evaluar dos estrategias:

A.
Guardar las URLs públicas originales.

B.
Importar/copy/cache de los assets de ejercicios a storage propio.

Para la primera versión puede utilizarse A si simplifica muchísimo el deploy.

Documentar claramente la licencia/origen en:

- README;
- pantalla About/Credits si corresponde.

IMPORTANTE:

No scrapees contenido propietario de sitios de fitness.

Usar únicamente assets cuya licencia permita su utilización.

==================================================
6. BIBLIOTECA DE EJERCICIOS
==================================================

Crear pantalla `/exercises`.

Debe tener:

- buscador;
- imagen;
- nombre;
- músculo principal;
- equipamiento;
- categoría;
- filtros;
- paginación o infinite scroll razonable;
- loading skeleton;
- estado vacío;
- manejo de errores.

Filtros:

- muscle;
- equipment;
- category;
- difficulty.

Al seleccionar ejercicio:

`/exercises/:id`

Mostrar:

- imagen grande;
- segunda imagen si existe;
- nombre;
- músculos principales;
- músculos secundarios;
- equipamiento;
- instrucciones;
- historial personal;
- PR;
- estimated 1RM;
- evolución del peso utilizado;
- evolución del volumen.

==================================================
7. REGISTRAR ENTRENAMIENTO
==================================================

Esta es la parte MÁS IMPORTANTE de UX.

Debe estar optimizada para móvil.

Pantalla:

`/workouts/new`

Flujo:

1. iniciar entrenamiento;
2. agregar ejercicio;
3. buscar ejercicio;
4. seleccionar;
5. cargar series;
6. peso;
7. repeticiones;
8. marcar serie completada;
9. agregar siguiente serie;
10. agregar otro ejercicio;
11. finalizar entrenamiento.

Ejemplo visual:

PRESS BANCA

Serie 1
80 kg | 10 reps | ✓

Serie 2
80 kg | 9 reps | ✓

Serie 3
75 kg | 10 reps | ✓

[ + Agregar serie ]

[ + Agregar ejercicio ]

Debe ser MUY rápido registrar números.

Características UX:

- inputs numéricos grandes;
- teclado numérico en mobile;
- botones cómodos;
- evitar modales innecesarios;
- poder copiar datos de la serie anterior;
- mostrar datos de la última sesión del mismo ejercicio;
- mostrar "última vez: 80 kg × 10";
- poder eliminar serie;
- reorder ejercicios si no complica excesivamente;
- confirmar antes de descartar entrenamiento activo.

Persistir cambios suficientemente seguido para evitar perder un entrenamiento por refresh accidental.

==================================================
8. HISTORIAL DE ENTRENAMIENTOS
==================================================

Pantalla:

`/workouts`

Mostrar:

- fecha;
- nombre;
- duración;
- cantidad de ejercicios;
- cantidad de series;
- volumen total.

Detalle:

`/workouts/:id`

Mostrar:

- ejercicios;
- series;
- peso;
- reps;
- volumen;
- notas.

Permitir:

- editar;
- eliminar con confirmación;
- duplicar/repetir entrenamiento.

==================================================
9. PESO CORPORAL
==================================================

Pantalla:

`/body-weight`

Permitir:

- registrar peso;
- editar;
- eliminar;
- consultar historial.

Dashboard:

gráfico temporal con:

X = fecha
Y = kg.

Mostrar:

- peso actual;
- cambio 7 días;
- cambio 30 días;
- máximo;
- mínimo.

No inventar métricas si no existen suficientes datos.

==================================================
10. MÉTRICAS
==================================================

Implementar cálculos correctos y testeados.

VOLUMEN POR SERIE

volume =
weight_kg × reps

VOLUMEN POR EJERCICIO

sum(weight × reps)

VOLUMEN POR WORKOUT

sum de las series completadas.

ESTIMATED 1RM

Utilizar fórmula Epley:

1RM = weight × (1 + reps / 30)

No calcular estimated 1RM para:

- reps <= 0;
- weight <= 0;
- series no completadas.

Considerar opcionalmente limitar el cálculo a rangos razonables de repeticiones.

PRs:

- mayor peso levantado;
- mayor estimated 1RM;
- mejor volumen de una sesión.

Toda métrica debe considerar solamente datos del usuario autenticado.

==================================================
11. DASHBOARD
==================================================

Ruta `/dashboard`.

Crear dashboard moderno.

Header:

"Buenas, {nombre}"

Cards:

- peso actual;
- entrenamientos este mes;
- volumen últimos 30 días;
- PRs recientes.

Secciones:

1. peso corporal;
2. actividad de entrenamiento;
3. ejercicios con mayor progreso;
4. entrenamientos recientes;
5. PRs.

Agregar heatmap estilo GitHub:

- cada día representa cantidad o volumen de entrenamiento;
- tooltip con fecha y entrenamiento.

No saturar de información.

Diseño limpio tipo:

- Linear;
- Strava;
- Hevy;
- Strong;

sin copiar literalmente ninguna aplicación.

==================================================
12. PROGRESO POR EJERCICIO
==================================================

Página:

`/progress/:exerciseId`

Mostrar:

- nombre;
- imagen;
- última sesión;
- mejor peso;
- estimated 1RM máximo;
- volumen acumulado;
- cantidad de sesiones.

Gráfico 1:

mejor peso por sesión.

Gráfico 2:

estimated 1RM por sesión.

Gráfico 3:

volumen por sesión.

Tabla inferior:

Fecha | Peso | Reps | Sets | Volumen | 1RM

Permitir rangos:

- 30 días;
- 90 días;
- 6 meses;
- 1 año;
- todo.

==================================================
13. DISEÑO
==================================================

Quiero una UI premium pero minimalista.

Mobile-first.

Debe funcionar especialmente bien en:

- 390px;
- 430px;
- tablet;
- desktop.

Usar:

- cards;
- border radius moderado;
- spacing consistente;
- tipografía clara;
- skeleton loaders;
- empty states;
- toast notifications;
- dialogs solamente cuando aporten valor.

Soportar:

- light mode;
- dark mode.

No crear apariencia genérica de template administrativo.

No sidebar gigante en mobile.

Mobile:

bottom navigation con algo similar a:

Dashboard
Entrenar
Historial
Progreso
Perfil

Desktop:

sidebar compacta o navbar razonable.

==================================================
14. PWA
==================================================

Preparar frontend como PWA.

Agregar:

- manifest;
- icons placeholder propios;
- theme-color;
- installability;
- service worker mediante plugin mantenido de Vite.

No hacer offline-first complejo.

Como mínimo:

- la SPA puede instalarse;
- static assets pueden cachearse razonablemente.

No cachear respuestas privadas de API de forma insegura.

==================================================
15. API
==================================================

Diseñar REST API clara.

Ejemplos:

GET    /api/auth/me/
POST   /api/auth/google/
POST   /api/auth/logout/
POST   /api/auth/refresh/

GET    /api/exercises/
GET    /api/exercises/:id/
POST   /api/exercises/custom/

GET    /api/workouts/
POST   /api/workouts/
GET    /api/workouts/:id/
PATCH  /api/workouts/:id/
DELETE /api/workouts/:id/

POST   /api/workouts/:id/exercises/
POST   /api/workout-exercises/:id/sets/
PATCH  /api/workout-sets/:id/
DELETE /api/workout-sets/:id/

GET    /api/body-weight/
POST   /api/body-weight/

GET    /api/dashboard/summary/
GET    /api/progress/exercises/:id/

No respetar estos paths ciegamente si una variante más RESTful simplifica el código.

Generar schema OpenAPI.

Endpoint:

`/api/schema/`

Swagger:

`/api/docs/`

==================================================
16. SEGURIDAD
==================================================

Implementar y probar:

- auth obligatoria para endpoints privados;
- object-level ownership;
- usuario A no puede acceder a workout de usuario B;
- usuario A no puede editar peso de usuario B;
- validaciones backend;
- rate limiting básico en auth si resulta razonable;
- CORS restrictivo;
- CSRF correcto;
- secure cookies en prod;
- HSTS configurable;
- DEBUG=False en producción;
- ALLOWED_HOSTS configurable;
- secrets solamente por environment;
- sanitización/validación de inputs;
- UUID en entidades privadas expuestas.

No loguear:

- tokens;
- cookies;
- secrets.

==================================================
17. TESTS BACKEND
==================================================

Usar pytest.

Agregar tests reales de:

AUTH

- endpoint privado requiere login;
- usuario autenticado puede obtener perfil.

EXERCISES

- listado;
- filtros;
- búsqueda;
- import idempotente.

WORKOUTS

- crear workout;
- agregar ejercicio;
- agregar sets;
- actualizar;
- finalizar;
- cálculo volumen;
- aislamiento entre usuarios.

BODY WEIGHT

- CRUD;
- ownership.

PROGRESS

- cálculo 1RM;
- volumen;
- PR;
- historial.

SECURITY

- IDOR;
- user A cannot read user B;
- user A cannot modify user B.

Usar factories.

No depender de Google real en tests.

Mockear validación OAuth.

==================================================
18. TESTS FRONTEND
==================================================

Configurar:

- Vitest;
- React Testing Library.

Testear al menos:

- login page;
- rutas protegidas;
- ejercicio search;
- agregar serie;
- cálculo/representación de workout;
- error state.

Agregar Playwright para E2E si no vuelve excesivamente frágil el proyecto.

Smoke E2E recomendado:

login mock
→ dashboard
→ nuevo workout
→ agregar bench press
→ agregar 80 kg × 10
→ finalizar
→ abrir historial
→ abrir progreso.

==================================================
19. CALIDAD DE CÓDIGO
==================================================

BACKEND

- Ruff;
- Black si es compatible con la estrategia elegida;
- pytest.

FRONTEND

- ESLint;
- Prettier;
- TypeScript strict;
- npm build.

Todo CI debe fallar si:

- lint falla;
- tests fallan;
- frontend no compila;
- Django tiene migraciones faltantes.

Agregar:

python manage.py makemigrations --check
python manage.py check

==================================================
20. DOCKER LOCAL
==================================================

Crear:

docker-compose.yml

Servicios:

db
backend
frontend

DB:

PostgreSQL.

Configurar healthcheck.

Backend debe esperar correctamente DB sin sleep arbitrario permanente.

Agregar volumen persistente para PostgreSQL.

Comandos esperados:

docker compose up --build

Luego:

frontend:
http://localhost:5173

backend:
http://localhost:8000

docs:
http://localhost:8000/api/docs/

Crear scripts o Makefile:

make up
make down
make logs
make test
make backend-test
make frontend-test
make migrate
make seed
make shell
make lint

`make down` NO debe borrar volúmenes por defecto.

Agregar comando separado explícito si alguien realmente quiere destruir datos.

==================================================
21. DOCKER PRODUCCIÓN
==================================================

Crear Dockerfiles multi-stage cuando tenga sentido.

BACKEND

Imagen final mínima.

Debe:

- instalar dependencias;
- collectstatic cuando corresponda;
- arrancar Gunicorn;
- exponer health endpoint.

FRONTEND

Build de React.

Servir estáticos mediante solución apropiada para plataforma elegida.

No correr Vite dev server en producción.

Agregar:

`/health/`

Backend debe devolver HTTP 200 cuando está sano.

==================================================
22. GITHUB ACTIONS — CI
==================================================

Crear:

`.github/workflows/ci.yml`

Triggers:

push:
- main
- codex

pull_request:
- main

BACKEND JOB

Ubuntu latest.

Service:

PostgreSQL compatible con producción.

Pasos:

- checkout;
- setup Python 3.12;
- cache pip;
- instalar dependencias;
- esperar DB;
- migrations;
- Django checks;
- makemigrations --check;
- Ruff;
- pytest con coverage.

No usar SQL Server.

Esta aplicación usa PostgreSQL.

Ejemplo conceptual:

name: CI

on:
  push:
    branches:
      - main
      - codex
  pull_request:
    branches:
      - main

jobs:
  backend:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_DB: gymtrack_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

    defaults:
      run:
        working-directory: backend

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip

      - run: pip install -r requirements.txt

      - name: Django checks
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/gymtrack_test
        run: |
          python manage.py check
          python manage.py makemigrations --check

      - name: Backend lint
        run: ruff check .

      - name: Backend tests
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/gymtrack_test
        run: pytest -q

  frontend:
    runs-on: ubuntu-latest

    defaults:
      run:
        working-directory: frontend

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - run: npm ci
      - run: npm run lint
      - run: npm run test -- --run
      - run: npm run build

Adaptar correctamente variables necesarias.

No meter secrets reales en workflow.

==================================================
23. GITHUB ACTIONS — IMÁGENES DOCKER
==================================================

Además del CI, quiero workflow para construir imágenes productivas.

Al merge/push a main:

- construir backend;
- construir frontend;
- tagear con SHA;
- tagear latest;
- opcionalmente publicar en GitHub Container Registry.

Usar:

ghcr.io/<owner>/gymtrack-backend:<sha>
ghcr.io/<owner>/gymtrack-frontend:<sha>

y también:

latest.

Añadir OCI labels:

org.opencontainers.image.revision=$GITHUB_SHA
org.opencontainers.image.source=<repository>

Backend y frontend del mismo release deben tener el mismo git SHA.

Nunca desplegar backend y frontend provenientes de commits distintos.

==================================================
24. CI/CD
==================================================

Separar claramente:

CI
→ valida código.

BUILD
→ genera imágenes.

DEPLOY
→ solo después de CI verde.

Preferir GitHub Actions + plataforma con deploy automático o deploy hook seguro.

Si utilizamos Render:

Frontend:

Render Static Site.

Backend:

Render Web Service Docker.

Database:

NO utilizar Render Free Postgres para datos permanentes porque el free Postgres expira.

Usar PostgreSQL externo.

Preferencia para proyecto hobby:

Supabase Postgres Free únicamente como PostgreSQL administrado.

Django sigue siendo dueño del modelo y de las migraciones.

NO utilizar Supabase Auth.

NO utilizar Supabase API.

Solamente usar su conexión PostgreSQL.

Configurar:

DATABASE_URL.

Alternativamente dejar Neon documentado como opción compatible.

==================================================
25. DEPLOY RECOMENDADO
==================================================

Preparar una primera estrategia de deploy barata/gratuita:

FRONTEND

Render Static Site.

BACKEND

Render Free Web Service mediante Docker.

DATABASE

Supabase Free PostgreSQL.

IMPORTANTE:

La aplicación debe tolerar que Render duerma el backend por inactividad.

Mostrar loading adecuado durante cold start.

No almacenar archivos importantes en filesystem efímero del backend.

Las imágenes del dataset pueden seguir remotas en v1.

Crear:

render.yaml

si aporta reproducibilidad.

No hardcodear IDs ni secrets de Render.

Documentar exactamente cómo configurar:

- GOOGLE_CLIENT_ID;
- GOOGLE_CLIENT_SECRET si corresponde;
- DATABASE_URL;
- SECRET_KEY;
- FRONTEND_URL;
- BACKEND_URL;
- ALLOWED_HOSTS;
- CSRF_TRUSTED_ORIGINS;
- CORS_ALLOWED_ORIGINS.

==================================================
26. ENVIRONMENTS
==================================================

Separar:

development
test
production

Preferentemente:

config/settings/base.py
config/settings/dev.py
config/settings/test.py
config/settings/prod.py

O una arquitectura equivalente limpia.

`.env.example` debe incluir TODAS las variables necesarias sin secretos reales.

Ejemplo:

DJANGO_SETTINGS_MODULE=
DJANGO_SECRET_KEY=
DEBUG=
DATABASE_URL=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

FRONTEND_URL=
BACKEND_URL=

CORS_ALLOWED_ORIGINS=
CSRF_TRUSTED_ORIGINS=
ALLOWED_HOSTS=

==================================================
27. MIGRACIONES
==================================================

Las migraciones deben estar versionadas en Git.

Nunca hacer:

makemigrations automático en producción.

Deploy:

python manage.py migrate --noinput

Debe existir un mecanismo claro de ejecución de migraciones antes de iniciar nueva versión.

Evitar migraciones destructivas innecesarias.

==================================================
28. SEED DE DESARROLLO
==================================================

Crear:

python manage.py seed_dev

Debe crear:

- usuario demo local si corresponde;
- body weights;
- workouts;
- series;
- varios meses de historial.

Esto permitirá visualizar gráficos inmediatamente.

NO ejecutar seed_dev automáticamente en producción.

El seed debe ser idempotente o estar claramente marcado como destructivo si no lo es.

==================================================
29. OBSERVABILIDAD
==================================================

Configurar logging estructurado razonable.

Logs en stdout.

Registrar:

- request errors;
- exceptions;
- startup;
- migrations si corresponde.

No registrar:

- authorization headers;
- tokens;
- cookies;
- secrets.

Health endpoint:

GET /health/

respuesta simple:

{
  "status": "ok"
}

Opcionalmente comprobar DB mediante endpoint de readiness separado.

==================================================
30. README
==================================================

README completo.

Debe explicar:

- qué hace GymTrack;
- screenshots placeholders;
- stack;
- arquitectura;
- requisitos;
- instalación;
- configuración;
- Google OAuth;
- Docker;
- migrations;
- import exercises;
- tests;
- CI/CD;
- deploy;
- variables;
- dataset y atribución;
- troubleshooting.

Comandos copy/paste.

Una persona que clone el proyecto debe poder levantarlo sin interpretar código.

==================================================
31. EXPERIENCIA DE DESARROLLO
==================================================

Quiero poder ejecutar idealmente:

git clone ...
cp .env.example .env
docker compose up --build

y tener casi todo andando.

Si Google OAuth requiere credenciales externas, documentarlo claramente.

Crear un mecanismo razonable de login DEV solamente en development/test para poder probar sin OAuth real si resulta útil.

Ese bypass JAMÁS debe estar disponible con producción settings.

==================================================
32. API PERFORMANCE
==================================================

Evitar N+1.

Usar:

select_related
prefetch_related

donde corresponda.

Paginar exercises y workouts.

No enviar todo el historial innecesariamente.

Los gráficos pueden aceptar:

from=
to=

o rangos.

Agregar índices adecuados antes de intentar caches complejos.

No agregar Redis inicialmente.

==================================================
33. UX — CASOS ESPECIALES
==================================================

Manejar:

- usuario nuevo sin entrenamientos;
- sin peso registrado;
- ejercicio sin historial;
- serie con peso 0 para bodyweight;
- errores de red;
- backend despertando desde cold start;
- refresh durante workout activo;
- duplicación accidental de submit;
- borrar workout;
- logout.

No asumir que todos los ejercicios necesariamente usan peso externo.

==================================================
34. BODYWEIGHT
==================================================

Para ejercicios como:

- pull-ups;
- dips;
- push-ups;

permitir weight_kg = 0.

Posteriormente podrá agregarse carga extra.

No mezclar automáticamente peso corporal del usuario con external load en el cálculo de volumen salvo que se defina explícitamente.

Documentar esta decisión.

==================================================
35. FEATURES FUERA DE SCOPE INICIAL
==================================================

NO implementar todavía:

- nutrición;
- conteo de calorías;
- planes de dieta;
- chat IA;
- marketplace;
- pagos;
- entrenador personal;
- social feed;
- seguidores;
- wearables;
- Apple Health;
- Google Fit;
- reconocimiento por cámara;
- ML.

Diseñar para agregar cosas luego, pero NO construir arquitectura especulativa.

==================================================
36. COMMITS
==================================================

Trabajar en commits lógicos y pequeños.

Ejemplo:

chore: bootstrap monorepo
feat: add authentication foundation
feat: add exercise catalog
feat: add workout tracking
feat: add progress analytics
feat: add body weight tracking
feat: add dashboard
test: add backend integration coverage
ci: add github actions
infra: add production docker setup
docs: complete deployment guide

No meter todo en un commit gigante si hay acceso Git.

==================================================
37. METODOLOGÍA DE TRABAJO
==================================================

Primero inspeccionar el repositorio.

Si está vacío:

crear arquitectura.

Si ya existe código:

NO destruirlo sin motivo.

Antes de implementar, generar una lista corta de fases internas.

Después trabajar.

NO detenerte después del scaffold.

NO detenerte después de crear los modelos.

NO detenerte después de crear la UI.

Continuar hasta dejar una versión integrada y ejecutable.

Después de cada bloque importante ejecutar tests correspondientes.

Corregir errores encontrados.

No declarar que algo funciona sin haberlo probado cuando el entorno permita probarlo.

==================================================
38. DEFINITION OF DONE
==================================================

No considerar terminado hasta que como mínimo:

BACKEND

[ ] Django arranca
[ ] PostgreSQL conecta
[ ] migrations aplican
[ ] Google auth implementada
[ ] exercise API funciona
[ ] import_exercises funciona
[ ] workout CRUD funciona
[ ] sets funcionan
[ ] body weight funciona
[ ] analytics funcionan
[ ] ownership seguro
[ ] backend tests verdes

FRONTEND

[ ] React compila
[ ] login existe
[ ] dashboard existe
[ ] exercises existe
[ ] workout recorder usable
[ ] history existe
[ ] progress graphs existen
[ ] body weight existe
[ ] responsive mobile
[ ] frontend tests verdes

INFRA

[ ] docker compose funciona
[ ] Dockerfiles funcionan
[ ] `.env.example`
[ ] healthcheck
[ ] GitHub CI
[ ] Docker build workflow
[ ] deploy config
[ ] README

==================================================
39. VALIDACIÓN FINAL
==================================================

Antes de terminar ejecutar y reportar:

BACKEND

python manage.py check

python manage.py makemigrations --check

pytest

ruff check .

FRONTEND

npm run lint

npm run test -- --run

npm run build

DOCKER

docker compose config

docker compose build

Si el entorno permite:

docker compose up

y comprobar:

backend health = 200
frontend = 200

Comprobar flujo mínimo:

1. usuario autenticado;
2. listar ejercicios;
3. crear workout;
4. agregar ejercicio;
5. agregar serie 80 kg × 10 reps;
6. finalizar workout;
7. workout aparece en historial;
8. progreso del ejercicio refleja ese entrenamiento.

==================================================
40. REPORTE FINAL
==================================================

Cuando termines, darme un reporte conciso con este formato:

GYMTRACK IMPLEMENTATION REPORT

ARCHITECTURE
------------
Backend =
Frontend =
Database =
Authentication =
Exercise dataset =

IMPLEMENTED
-----------
Auth =
Exercises =
Exercise images =
Workouts =
Sets =
Body weight =
Progress =
Dashboard =
PWA =

TESTS
-----
Backend =
Frontend =
E2E =

QUALITY
-------
Django check =
Missing migrations =
Backend lint =
Frontend lint =
Frontend build =

DOCKER
------
Compose =
Backend image =
Frontend image =
Health =

CI/CD
-----
CI workflow =
Docker workflow =
Deploy workflow =

DEPLOY
------
Target =
Database target =
Required secrets =

KNOWN LIMITATIONS
-----------------
Listar únicamente limitaciones reales.

NEXT STEPS
----------
Máximo 5 items realmente útiles.

No inventar resultados de tests que no hayas podido ejecutar.

Si algo quedó pendiente, decir exactamente qué falta.

==================================================
41. PRINCIPIOS FINALES
==================================================

- No sobreingeniería.
- No mocks permanentes en funcionalidades críticas.
- No TODOs silenciosos.
- No secrets hardcodeados.
- No dependencia runtime innecesaria del dataset externo.
- No duplicación de lógica frontend/backend para reglas de negocio críticas.
- Backend es fuente de verdad.
- Mobile UX primero.
- Seguridad multiusuario real.
- PostgreSQL desde development.
- CI desde el principio.
- Docker reproducible.
- Backend y frontend de producción siempre deben corresponder al mismo commit SHA.

Empezá ahora y avanzá hasta obtener una primera versión completa y usable.