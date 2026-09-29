from django.urls import path, include
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter
from users.views import AuthViewSet
from exercises.views import ExerciseViewSet
from workouts.views import WorkoutViewSet, WorkoutExerciseViewSet
from bodymetrics.views import BodyWeightViewSet
from progress.views import dashboard, exercise_progress

router = DefaultRouter()
router.register("auth", AuthViewSet, basename="auth")
router.register("exercises", ExerciseViewSet, basename="exercise")
router.register("workouts", WorkoutViewSet, basename="workout")
router.register("workout-exercises", WorkoutExerciseViewSet, basename="workout-exercise")
router.register("body-weight", BodyWeightViewSet, basename="body-weight")
@require_GET
def health(request):
    return JsonResponse({"status": "ok"})

urlpatterns = [path("health/", health), path("csrf/", ensure_csrf_cookie(lambda request: JsonResponse({"status": "ok"}))), path("api/", include(router.urls)), path("api/dashboard/summary/", dashboard), path("api/progress/exercises/<uuid:exercise_id>/", exercise_progress), path("api/schema/", SpectacularAPIView.as_view()), path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"))]
