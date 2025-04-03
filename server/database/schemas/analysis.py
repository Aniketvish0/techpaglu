from pydantic import BaseModel
from typing import List, Optional
from database.schemas.base import BaseSchema

class AnalysisCreate(BaseModel):
    user_id: str
    tech_enthusiasm_score: int
    tech_topics_percentage: int
    key_tech_interests: List[str]
    analysis_summary: str
    total_tweets: int

class AnalysisResponse(BaseSchema):
    user_id: str
    tech_enthusiasm_score: int
    tech_topics_percentage: int
    key_tech_interests: List[str]
    analysis_summary: str
    total_tweets: int

class AnalysisUpdate(BaseModel):
    tech_enthusiasm_score: Optional[int] = None
    tech_topics_percentage: Optional[int] = None
    key_tech_interests: Optional[List[str]] = None
    analysis_summary: Optional[str] = None