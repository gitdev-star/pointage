from rest_framework.routers import DefaultRouter
from .views import SanctionTypeViewSet, SanctionViewSet

router = DefaultRouter()
router.register("types", SanctionTypeViewSet, basename="sanction-types")
router.register("",      SanctionViewSet,     basename="sanctions")

urlpatterns = router.urls
