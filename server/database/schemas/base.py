from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional
from database.models.base import PyObjectId

class BaseSchema(BaseModel):
    """
    Base schema for data transfer objects
    """
    id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True