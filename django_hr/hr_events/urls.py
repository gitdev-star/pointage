from rest_framework.routers import DefaultRouter
from .views import HREventTypeViewSet, HREventViewSet

router = DefaultRouter()
router.register("types",  HREventTypeViewSet, basename="hr-event-types")
router.register("",       HREventViewSet,     basename="hr-events")

urlpatterns = router.urls
