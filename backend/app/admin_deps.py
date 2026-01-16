from fastapi import Depends, HTTPException
from app.auth import get_current_user  

def require_admin(current_user=Depends(get_current_user)):
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Solo admin")
    return current_user
