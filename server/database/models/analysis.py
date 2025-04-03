from typing import List
from pydantic import Field
from database.models.base import BaseMongoModel, PyObjectId

class AnalysisModel(BaseMongoModel):
    user_id: PyObjectId  
    tech_enthusiasm_score: int
    tech_topics_percentage: int
    key_tech_interests: List[str]
    analysis_summary: str
    total_tweets: int

    class Config(BaseMongoModel.Config):
        collection_name = "analyses"