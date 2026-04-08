from django.contrib import admin
from .models import HRProfile


@admin.register(HRProfile)
class HRProfileAdmin(admin.ModelAdmin):
    list_display  = ["username", "job_title", "is_director", "factory", "department", "is_active", "created_at"]
    list_filter   = ["is_director", "is_active"]
    search_fields = ["username", "email", "job_title"]
    list_editable = ["is_director", "is_active"]
