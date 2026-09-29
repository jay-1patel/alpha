import json
from fastapi import APIRouter
from database import get_db
from services.rag import load_faqs_from_db

router = APIRouter()


@router.get("/faqs")
def get_faqs():
    faqs = load_faqs_from_db()
    return {"faqs": faqs}
