from django.contrib import admin
from .models import ClockerGroup, Clocker

@admin.register(ClockerGroup)
class ClockerGroupAdmin(admin.ModelAdmin):
    list_display = ("name", "description", "clocker_count", "created_at")
    search_fields = ("name", "description")
    
    def clocker_count(self, obj):
        """Show number of clockers in this group"""
        return obj.clocker_set.count()
    clocker_count.short_description = "Number of Clockers"


@admin.register(Clocker)
class ClockerAdmin(admin.ModelAdmin):
    list_display = ("name", "group", "specific_name", "ip_address", "port", "is_active", "updated_at")
    list_filter = ("is_active", "group")
    search_fields = ("name", "specific_name", "ip_address")
    
    # Organize fields in the form
    fieldsets = (
        ('Identification', {
            'fields': ('group', 'specific_name'),
            'description': 'Select a group and enter a specific name. The full name will be auto-generated as: group_specific_name'
        }),
        ('Network Configuration', {
            'fields': ('ip_address', 'port')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Generated Name (Read-only)', {
            'fields': ('name',),
            'classes': ('collapse',),  # Collapsed by default
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    
    readonly_fields = ('name', 'created_at', 'updated_at')
    
    # Auto-populate group if only one exists
    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        if not obj and ClockerGroup.objects.count() == 0:
            # Create default group if none exists
            ClockerGroup.objects.create(name="Default", description="Default group")
        return form
