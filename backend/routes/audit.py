"""
Audit History API Routes.

Provides endpoints for viewing audit history. Access restricted to superadmin only.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from datetime import datetime, timedelta

from database import (
    list_audit_history, 
    get_audit_statistics, 
    _ensure_audit_tables
)
from routes.auth import require_permission, get_current_admin

logger = logging.getLogger("audit")
router = APIRouter(prefix="/api/audit")

# Ensure audit tables exist on startup
_ensure_audit_tables()


@router.get("/history")
def get_audit_history(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    tenant_id: Optional[str] = Query(None),
    outcome: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("created_at"),
    sort_order: Optional[str] = Query("desc"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_admin: dict = Depends(require_permission("audit_history")),
):
    """
    Get audit history with filtering and pagination.
    
    This endpoint is restricted to superadmin users only.
    
    Query parameters:
    - start_date: YYYY-MM-DD format
    - end_date: YYYY-MM-DD format  
    - actor: Filter by actor username
    - action: Filter by specific action
    - category: Filter by action category
    - tenant_id: Filter by tenant ID (allows viewing all admin/sub-admin activity for specific tenant)
    - outcome: Filter by outcome (success/failure)
    - search: Free text search across multiple fields
    - sort_by: Field to sort by (created_at, action, actor_username, etc.)
    - sort_order: asc or desc
    - limit: Number of results per page (1-500)
    - offset: Pagination offset
    """
    # Map category to actions for backwards compatibility
    action_map = {
        'authentication': ['login', 'first_admin_created', 'admin_password_reset', 'admin_password_reset_via_otp', 'password_changed'],
        'accounts': ['admin_created', 'admin_updated', 'admin_deleted'],
        'tenant_setup': [
            'tenant_created', 'tenant_deleted', 'tenant_profile_draft_saved',
            'tenant_intent_draft_saved', 'tenant_profile_published',
            'tenant_profile_rolled_back', 'tenant_phone_id_bound',
            'tenant_webhook_secret_configured', 'tenant_token_created',
            'tenant_token_revoked', 'config_draft_saved', 'config_draft_built', 'config_published'
        ],
        'api_access': ['api_access_request_submitted', 'api_access_request_reviewed'],
    }
    
    # Convert category filter to action filter
    effective_action = action
    if category and not action:
        effective_action = None
        # If category is specified but no specific action, we'll handle this in the query
        # For now, we'll use the category mapping
        if category in action_map:
            # We can't easily do OR logic with the current database function,
            # so we'll handle this at the application level
            pass
    
    filters = {
        'start_date': start_date,
        'end_date': end_date,
        'actor': actor,
        'action': effective_action,
        'tenant_id': tenant_id,
        'outcome': outcome,
        'search': search,
        'sort_by': sort_by,
        'sort_order': sort_order
    }
    
    try:
        result = list_audit_history(filters, limit, offset)
        
        # Enrich with tenant information for each event
        enriched_events = []
        for event in result['events']:
            enriched_event = dict(event)
            # Add tenant context
            tenant_id = event.get('tenant_id', '') or ''
            if tenant_id:
                try:
                    from database import get_db
                    with get_db() as conn:
                        tenant_row = conn.execute(
                            "SELECT name FROM tenants WHERE id = ?", 
                            (tenant_id,)
                        ).fetchone()
                        if tenant_row:
                            enriched_event['tenant_name'] = tenant_row['name']
                        else:
                            enriched_event['tenant_name'] = tenant_id
                except Exception:
                    enriched_event['tenant_name'] = tenant_id
            else:
                enriched_event['tenant_name'] = 'System'
            
            enriched_events.append(enriched_event)
        
        result['events'] = enriched_events
        
        # Apply category filtering at application level if needed
        if category and category in action_map and not effective_action:
            category_actions = set(action_map[category])
            result['events'] = [
                event for event in result['events'] 
                if event['action'] in category_actions
            ]
            # Recalculate total for filtered results
            result['total'] = len([
                event for event in result['events'] 
                if event['action'] in category_actions
            ])
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to fetch audit history: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit history: {e}")


@router.get("/tenants")
def get_active_tenants(
    current_admin: dict = Depends(require_permission("audit_history")),
):
    """
    Get list of all tenants with audit activity for tenant filter dropdown.
    This endpoint is restricted to superadmin users only.
    """
    try:
        from database import get_all_tenants_with_activity
        tenants = get_all_tenants_with_activity()
        return {"tenants": tenants}
    except Exception as e:
        logger.error(f"Failed to fetch tenants with activity: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch tenants: {e}")


@router.get("/history/by-tenant")
def get_audit_history_by_tenant(
    tenant_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_admin: dict = Depends(require_permission("audit_history")),
):
    """
    Get audit history grouped by tenant with each tenant's admin/sub-admin activity.
    
    This endpoint is restricted to superadmin users only and returns
    all admin and sub-admin activities organized by tenant.
    
    If tenant_id is provided, returns only that tenant's activity.
    If tenant_id is not provided, returns all tenants with their activities.
    """
    try:
        from database import list_audit_history_by_tenant
        
        filters = {
            'tenant_id': tenant_id,
            'start_date': start_date,
            'end_date': end_date,
            'limit': limit,
            'offset': offset
        }
        
        result = list_audit_history_by_tenant(filters, limit, offset)
        
        # Enrich tenant information
        enriched_tenants = {}
        for tenant_key, tenant_data in result['tenants'].items():
            enriched_tenant = dict(tenant_data)
            
            # Get tenant info from tenants table
            if tenant_key and tenant_key != 'system':
                try:
                    from database import get_db
                    with get_db() as conn:
                        tenant_row = conn.execute(
                            "SELECT name, created_at FROM tenants WHERE id = ?", 
                            (tenant_key,)
                        ).fetchone()
                        if tenant_row:
                            enriched_tenant['tenant_name'] = tenant_row['name']
                            enriched_tenant['tenant_created_at'] = tenant_row['created_at']
                        else:
                            enriched_tenant['tenant_name'] = tenant_key
                    
                    # Get admins for this tenant
                    admin_rows = conn.execute(
                        """SELECT username, role, created_at FROM admins 
                           WHERE tenant_id = ? OR tenant_id IS NULL OR tenant_id = ''
                           ORDER BY username""",
                        (tenant_key,)
                    ).fetchall()
                    
                    enriched_tenant['tenant_admins'] = [
                        {
                            'username': row['username'],
                            'role': row['role'],
                            'created_at': row['created_at']
                        }
                        for row in admin_rows
                    ]
                    
                except Exception as e:
                    logger.warning(f"Failed to enrich tenant info for {tenant_key}: {e}")
            else:
                enriched_tenant['tenant_name'] = 'System'
                enriched_tenant['tenant_created_at'] = None
            
            enriched_tenants[tenant_key] = enriched_tenant
        
        result['tenants'] = enriched_tenants
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to fetch audit history by tenant: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit history by tenant: {e}")


@router.get("/statistics")
def get_audit_statistics(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_admin: dict = Depends(require_permission("audit_history")),
):
    """
    Get audit history statistics.
    
    This endpoint is restricted to superadmin users only.
    """
    try:
        # Set default date range if not specified
        if not start_date:
            start_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
        
        filters = {
            'start_date': start_date,
            'end_date': end_date,
        }
        
        statistics = get_audit_statistics(filters)
        return statistics
        
    except Exception as e:
        logger.error(f"Failed to fetch audit statistics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit statistics: {e}")