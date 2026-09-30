# Dynamo — roadmap para una app linda, cómoda y completa

## Objetivo

Convertir la base actual en una aplicación de entrenamiento personal agradable para usar todos los días desde el celular, con datos confiables, feedback visual y una experiencia rápida durante el entrenamiento.

## Estado actual

La aplicación ya cuenta con:

- Login con Google Identity Services.
- Sesiones Django con cookies HttpOnly.
- Protección CSRF para frontend y backend en dominios distintos.
- Usuarios aislados correctamente.
- Catálogo de ejercicios e importador compatible con free-exercise-db.
- Registro de workouts, ejercicios y series.
- Historial de workouts.
- Peso corporal.
- Dashboard básico.
- Cálculo de volumen y 1RM Epley.
- Deploy preparado para Render y PostgreSQL administrado.
- CI, tests y Docker.

## Prioridad 1 — experiencia básica de producto

### Perfil y cuenta

- [x] Mostrar nombre, email y avatar del usuario de Google.
- [x] Editar nombre y avatar.
- [ ] Página de preferencias.
- [ ] Elegir unidades: kg/lb.
- [ ] Elegir tema claro/oscuro.
- [ ] Cerrar sesión desde el perfil.
- [ ] Solicitar eliminación de cuenta.
- [ ] Exportar datos personales.

### Registro de entrenamiento

- [ ] Buscar ejercicios por nombre mientras se escribe.
- [ ] Seleccionar ejercicio visualmente, sin pegar UUIDs.
- [ ] Mostrar imagen y músculos involucrados.
- [ ] Mostrar última sesión del mismo ejercicio.
- [ ] Copiar la serie anterior.
- [ ] Agregar varias series al mismo ejercicio.
- [ ] Agregar varios ejercicios al mismo workout.
- [ ] Editar y eliminar series.
- [ ] Reordenar ejercicios.
- [ ] Confirmar antes de descartar un entrenamiento.
- [ ] Recuperar el workout activo después de cerrar y abrir el navegador.
- [ ] Mostrar tiempo transcurrido del workout.

### Catálogo de ejercicios

El backend ya soporta importar free-exercise-db sin duplicar registros:

```bash
cd backend
python manage.py import_exercises --file exercises.json
```

Flujo recomendado:

1. Descargar el dataset desde su repositorio oficial.
2. Revisar licencia y atribución.
3. Ejecutar el importador en staging.
4. Verificar cantidad de ejercicios, imágenes y categorías.
5. No descargar el dataset en cada request.

Mejoras pendientes:

- [ ] Filtros de músculo, equipo, categoría y dificultad.
- [ ] Paginación visual.
- [ ] Skeleton loaders.
- [ ] Estado vacío y error de red.
- [ ] Detalle completo del ejercicio.
- [ ] Crear ejercicios personalizados.
- [ ] Mostrar créditos y fuente del dataset.

## Prioridad 2 — progreso que motive

### Gráficos

- [x] Gráfico de progreso por ejercicio.
- [ ] Mejor peso por sesión.
- [ ] 1RM estimado por sesión.
- [ ] Volumen por sesión.
- [ ] Peso corporal en el tiempo.
- [ ] Volumen semanal y mensual.
- [ ] Selector de rango: 30 días, 90 días, 6 meses, 1 año y todo.
- [ ] Tooltips claros en mobile.
- [ ] Estados sin datos suficientes.

### Métricas

- [ ] PR de mayor peso.
- [ ] PR de 1RM estimado.
- [ ] PR de volumen.
- [ ] Mejor sesión.
- [ ] Frecuencia semanal.
- [ ] Racha de entrenamiento.
- [ ] Comparación contra período anterior.

No guardar estadísticas redundantes: calcularlas desde las series o crear servicios de agregación testeados si el volumen crece.

## Prioridad 3 — dashboard premium

- [ ] Saludo personalizado con nombre del usuario.
- [ ] Card de peso actual.
- [ ] Card de workouts del mes.
- [ ] Card de volumen reciente.
- [ ] PRs recientes.
- [ ] Gráfico de peso corporal.
- [ ] Heatmap de actividad estilo GitHub.
- [ ] Lista de workouts recientes.
- [ ] Ejercicios con mayor progreso.
- [ ] Empty states amigables para usuarios nuevos.

## Prioridad 4 — autenticación y cuenta

### Login manual opcional

Agregar registro por email/password solamente si realmente se necesita. Requisitos mínimos:

- [ ] Endpoint de registro.
- [ ] Validación de email.
- [ ] Password hasheada por Django.
- [ ] Confirmación por email.
- [ ] Recuperación de contraseña.
- [ ] Rate limiting.
- [ ] Protección contra enumeración de usuarios.
- [ ] Tests de sesión, logout y expiración.

No conviene agregar login manual incompleto: Google ya resuelve el caso principal y reduce superficie de seguridad.

## Prioridad 5 — calidad de uso

- [ ] Toasts para acciones exitosas y errores.
- [ ] Skeletons de carga.
- [ ] Retry de requests recuperables.
- [ ] Mensaje claro cuando Render está despertando.
- [ ] Confirmaciones para acciones destructivas.
- [ ] Accesibilidad de inputs y botones.
- [ ] Navegación por teclado.
- [ ] Responsive validado a 390px, 430px, tablet y desktop.
- [ ] Modo claro y oscuro.
- [ ] PWA instalable con íconos reales.
- [ ] Service worker para assets públicos sin cachear datos privados.

## Prioridad 6 — backend y datos

- [ ] Serializers de salida para OpenAPI.
- [ ] Filtros de ejercicios completos.
- [ ] Paginación consistente.
- [ ] Validar fechas y pesos inválidos.
- [ ] Evitar workouts duplicados por doble submit.
- [ ] Índices adicionales si crece el historial.
- [ ] Endpoint de readiness que verifique base de datos.
- [ ] Logging estructurado sin tokens ni cookies.
- [ ] Rate limiting para autenticación.
- [ ] Exportación y eliminación de datos.

## Prioridad 7 — operación y deploy

- [ ] Importar ejercicios en staging.
- [ ] Configurar PostgreSQL persistente.
- [ ] Backups automáticos.
- [ ] Prueba de restauración.
- [ ] Monitoreo de `/health/`.
- [ ] Alertas de errores 5xx.
- [ ] Rollback documentado.
- [ ] Dominio propio.
- [ ] Google OAuth actualizado con el dominio final.
- [ ] Smoke test post-deploy.

## Tests necesarios

### Backend

- [ ] Perfil GET/PATCH.
- [ ] Ownership de perfil.
- [ ] Login Google válido e inválido.
- [ ] CSRF.
- [ ] CRUD de peso.
- [ ] CRUD de workouts.
- [ ] Cálculo de volumen y 1RM.
- [ ] IDOR entre usuarios.
- [ ] Importador idempotente.

### Frontend

- [ ] Login Google renderiza.
- [ ] Perfil carga y guarda.
- [ ] Buscador de ejercicios.
- [ ] Agregar serie.
- [ ] Gráfico con datos y sin datos.
- [ ] Errores de red.

### E2E

```text
Login demo/Google
→ Dashboard
→ Buscar ejercicio
→ Crear workout
→ Agregar 80 kg × 10
→ Finalizar
→ Ver historial
→ Ver progreso
→ Editar perfil
```

## Definition of Done del producto

- [ ] Un usuario nuevo entiende qué hacer sin instrucciones externas.
- [ ] Registrar una serie toma pocos segundos.
- [ ] El usuario ve progreso real después del primer workout.
- [ ] El perfil muestra correctamente la cuenta Google.
- [ ] Los gráficos tienen datos correctos y estados vacíos.
- [ ] No hay UUIDs visibles en el flujo normal.
- [ ] Los errores no rompen la sesión.
- [ ] La app funciona bien en móvil.
- [ ] Los datos privados están aislados.
- [ ] Deploy reproducible y monitoreado.
