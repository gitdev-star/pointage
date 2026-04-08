# =====================================================
# PATH: pointage/django_hr/config/pagination.py
# =====================================================

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class FlexiblePagination(PageNumberPagination):
    page_size = 20                  # default
    page_size_query_param = "page_size"  # ?page_size=50
    max_page_size = 5000             # hard cap — prevents ?page_size=99999

    def get_paginated_response(self, data):
        return Response({
            "count":     self.page.paginator.count,
            "total_pages": self.page.paginator.num_pages,
            "next":      self.get_next_link(),
            "previous":  self.get_previous_link(),
            "page_size": self.get_page_size(self.request),
            "results":   data,
        })
