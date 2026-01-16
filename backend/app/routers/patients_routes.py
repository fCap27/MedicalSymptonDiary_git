from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=schemas.UserOut)
def Il_mio_account(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Restituisce le info dell'utente loggato"""
    return current_user
