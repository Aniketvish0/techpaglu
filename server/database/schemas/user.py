from pydantic import BaseModel
from typing import List, Optional
from database.schemas.base import BaseSchema

class UserCreate(BaseModel):
    username: str

class UserResponse(BaseSchema):
    username: str
    analyses: List[str] = []

class UserUpdate(BaseModel):
    username: Optional[str] = None