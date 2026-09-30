from django.urls import path, include
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.db import connection
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter
from users.views import AuthViewSet, avatar_image
from users.admin_views import AdminUserViewSet
from exercises.views import ExerciseViewSet
from workouts.views import RoutineViewSet, WorkoutViewSet, WorkoutExerciseViewSet, WorkoutSetViewSet, shared_routine, import_shared_routine
from bodymetrics.views import BodyWeightViewSet
from progress.views import dashboard, exercise_progress

router = DefaultRouter()
router.register("auth", AuthViewSet, basename="auth")
router.register("exercises", ExerciseViewSet, basename="exercise")
router.register("workouts", WorkoutViewSet, basename="workout")
router.register("workout-exercises", WorkoutExerciseViewSet, basename="workout-exercise")
router.register("workout-sets", WorkoutSetViewSet, basename="workout-set")
router.register("body-weight", BodyWeightViewSet, basename="body-weight")
router.register("routines", RoutineViewSet, basename="routine")
router.register("admin/users", AdminUserViewSet, basename="admin-user")
@require_GET
def health(request):
    return JsonResponse({"status": "ok"})

@require_GET
def readiness(request):
    try:
        connection.ensure_connection()
    except Exception:
        return JsonResponse({"status": "error"}, status=503)
    return JsonResponse({"status": "ok", "database": "ok"})

@ensure_csrf_cookie
@require_GET
def csrf(request):
    return JsonResponse({"status": "ok", "csrfToken": get_token(request)})

urlpatterns = [path("health/", health), path("readiness/", readiness), path("csrf/", csrf), path("api/", include(router.urls)), path("api/avatars/<uuid:user_id>/", avatar_image, name="user-avatar"), path("api/shared-routines/<uuid:token>/", shared_routine, name="shared-routine"), path("api/shared-routines/<uuid:token>/import/", import_shared_routine, name="import-shared-routine"), path("api/dashboard/summary/", dashboard), path("api/progress/exercises/<uuid:exercise_id>/", exercise_progress), path("api/schema/", SpectacularAPIView.as_view()), path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"))]
