from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from twikit import Client
import google.generativeai as genai
import json
import os
from dotenv import load_dotenv
from pymongo import MongoClient
from datetime import datetime, timezone , timedelta

load_dotenv()

USERNAME = os.getenv('X_USERNAME')
EMAIL = os.getenv('X_EMAIL')
PASSWORD = os.getenv('X_PASSWORD')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
MONGO_URI = os.getenv('MONGO_URI')

genai.configure(api_key=GEMINI_API_KEY)


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://techpaglu.vercel.app"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Client(language='en-US')

mongo_client = MongoClient(MONGO_URI)
db = mongo_client["cookies_db"]
collection = db["cookies"]
stored_cookies = collection.find_one({"_id": "cookie_storage"})
users_collection = db["users"]
analyses_collection = db["analyses"]

import json
from pymongo import MongoClient

async def x_login():
    try:
        await client.login(
            auth_info_1=USERNAME,
            auth_info_2=EMAIL,
            password=PASSWORD
        )
        cookies = client.get_cookies()
        collection.update_one(
            {"_id": "cookie_storage"},
            {"$set": {"data": cookies}},
            upsert=True  
        )
        print("✅ Login successful! Cookies updated in MongoDB.")
    except Exception as e:
        print(f"❌ Login failed: {e}")
        raise


def load_cookies():
    try:
        if not stored_cookies or "data" not in stored_cookies:
            return False
        client.set_cookies(stored_cookies["data"])
        return True

    except Exception as e:
        print(f" Error loading cookies from MongoDB: {e}")
        return False

async def get_tweets(username, max_tweets=300):
    try:
        if not load_cookies():
            print("🔄 Cookies not loaded, attempting login...")
            await x_login()
        user = await client.get_user_by_screen_name(username)
        
        tweets = await client.get_user_tweets(
            user_id=user.id, 
            tweet_type='Tweets', 
            count=300  
        )
        
        all_tweets = list(tweets)
        
        try:
            while len(all_tweets) < max_tweets:
    
                more_tweets = await tweets.next()
                
                if not more_tweets:
                    break
                
                all_tweets.extend(more_tweets)
                
                tweets = more_tweets
                
                if len(all_tweets) >= max_tweets:
                    break
        except Exception as e:
            print(f"❌ Pagination error: {e}")
        
        tweet_texts = [tweet.text for tweet in all_tweets]
        
        result = {
            "total_tweets": len(tweet_texts),
            "tweets": tweet_texts,
            "profile_url": user.profile_image_url
        }
        return result
    
    except Exception as e:
        print(f"❌ Error retrieving tweets for {username}: {e}")
        return {"tweets": [], "profile_url": ""}
    

def analyze_tweets_with_gemini(tweets):
    try:
        
        tweets_text = " ".join(tweets)
        print(f"Total tweet text length: {len(tweets_text)} characters")
        
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        prompt = f"""
        Analyze the following tweets and provide a JSON response that evaluates the user's tech enthusiasm:
        all the tweets are in quotes("") seperated with commas(,)
        Tweets: {tweets_text}
        
        Please provide a JSON with these keys:
        - tech_enthusiasm_score: A score out of 100 representing how much of a tech enthusiast the person is
        - tech_topics_percentage: Percentage of tweets related to technology
        - key_tech_interests: Top 3-5 tech areas mentioned
        - analysis_summary: A brief explanation of the scoring
        
        Scoring Criteria:
        - How much the user is tweeting about technology and engineering and anythings related to technology
        - How much is the ratio of tech tweets and also the quality and quality of technology related tweets
        - do not round of the score, scores must be raw between 0 to 100 upto 1 digit decimal point 
        - what is the majoriy of their tweets, are majority of thier tweets are about technology or random 
        """
        
        response = model.generate_content(prompt)
        try:
            json_start = response.text.find('{')
            json_end = response.text.rfind('}') + 1
            json_response = response.text[json_start:json_end]
            
            analysis = json.loads(json_response)
            return analysis
        except Exception as e:
            return {
                "tech_enthusiasm_score": 50,
                "tech_topics_percentage": 50,
                "key_tech_interests": ["Analysis failes due to some reason"],
                "analysis_summary": f"Analysis attempted but faild. Raw response: {response.text}"
            }
    
    except Exception as e:
        return {
            "error": str(e),
            "tech_enthusiasm_score": 0
        }

# FastAPI Routes
@app.get("/analyse/{username}")
async def analyze_user(username: str):
    try:
        user = users_collection.find_one({"username": username})
        
        recent_analysis = analyses_collection.find_one({
            "username": username,
            "created_at": {"$gte": datetime.now(timezone.utc) - timedelta(days=3)}
        })
        
        if recent_analysis:
            return {k: v for k, v in recent_analysis.items() if k != '_id'}
        
        tweets_data = await get_tweets(username)
        
        if not len(tweets_data['tweets']):
            raise HTTPException(status_code=404, detail="No tweets found for this user")
    
        analysis = analyze_tweets_with_gemini(tweets_data['tweets'])
        
        analysis_doc = {
            "username": username,
            "tech_enthusiasm_score": analysis['tech_enthusiasm_score'],
            "tech_topics_percentage": analysis['tech_topics_percentage'],
            "key_tech_interests": analysis['key_tech_interests'],
            "analysis_summary": analysis['analysis_summary'],
            "total_tweets": tweets_data['total_tweets'],
            "tweets": tweets_data['tweets'],
            "profile_url": tweets_data['profile_url'],
            "created_at": datetime.now(timezone.utc)
        }
        
        analysis_result = analyses_collection.insert_one(analysis_doc)
        analysis_doc['_id'] = analysis_result.inserted_id
        
        if not user:
            user_doc = {
                "username": username,
                "recent_score": analysis['tech_enthusiasm_score'],
                "profile_url": tweets_data['profile_url'],
                "analyses": [analysis_result.inserted_id]
            }
            users_collection.insert_one(user_doc)
        else:
            users_collection.update_one(
                {"username": username},
                {
                    "$set": {
                        "recent_score": analysis['tech_enthusiasm_score'],
                        "profile_url": tweets_data['profile_url']
                    },
                    "$push": {"analyses": analysis_result.inserted_id}
                }
            )
        return {k: v for k, v in analysis_doc.items() if k != '_id'}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import HTTPException
from pymongo import DESCENDING

@app.get("/all-user-details")
async def get_all_user_details():
    try:
        pipeline = [
            {
                "$lookup": {
                    "from": "analyses_collection",  
                    "localField": "analyses",
                    "foreignField": "_id",
                    "as": "user_analyses"
                }
            },
            {
                "$addFields": {
                    "recent_analysis": { "$arrayElemAt": ["$user_analyses", -1] },
                    "total_analyses": { "$size": "$analyses" }
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "username": 1,
                    "recent_score": 1,
                    "profile_url": { "$ifNull": ["$profile_url", ""] },
                    "total_analyses": 1
                }
            }
        ]

        users = list(users_collection.aggregate(pipeline))
        return users

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def check_health():
    return "Server is healthy"



# Main entry point
if __name__ == "__main__":
    print("🚀 Starting server...")
    uvicorn.run(app, host="127.0.0.1", port=8000)