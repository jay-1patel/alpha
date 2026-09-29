"""
B2C WhatsApp list-menu definitions.

Each ``get_*_menu`` helper returns the exact JSON structure required by the
shared ``send_list_menu(wa_id, header, body, button_text, sections)`` function.

B2C customers share the single unified KB menu from ``services.menu_catalog``
so every persona sees identical options. Menu items are rendered through
``services.menu_service`` which enforces WhatsApp interactive limits.
"""

from services.menu_catalog import get_kb_main_menu
from services.menu_service import build_list_menu, personalize_header


def get_main_menu(wa_id: str = "") -> dict:
    """Main menu (unified KB menu) for B2C customers."""
    items = get_kb_main_menu(wa_id)
    header = personalize_header(wa_id, user_type="b2c")
    menu = build_list_menu(
        header=header,
        body="What would you like to explore today?",
        button_text="Show Options",
        items=items,
    )
    menu.pop("type", None)
    return menu