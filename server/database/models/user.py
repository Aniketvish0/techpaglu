from typing import List
from pydantic import Field
from database.models.base import BaseMongoModel, PyObjectId

class UserModel(BaseMongoModel):
    username: str
    analyses: List[PyObjectId] = []

    class Config(BaseMongoModel.Config):
        collection_name = "users"