import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import AlertTriangle from './icons/AlertTriangle';
import Loader2 from './icons/Loader2';
import Twitter from './icons/Twitter';
import Share2 from './icons/Share2';

type AnalysisResult = {
  score: number;
  category: 'techpaglu' | 'reachpaglu' | 'shitpaglu';
  tweetCount: number;
  keywordsFound: number;
  topKeywords?: { keyword: string; count: number }[];
};

const VITE_API_URI = import.meta.env.VITE_API_URI;

function App() {
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState<'up'|'down'|'checking'>('checking');
  const [isSharingLoading, setIsSharingLoading] = useState(false);
  const resultCardRef = useRef(null);

  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        await axios.get(`${VITE_API_URI}/health`);
        setServerStatus('up');
      } catch (err) {
        console.error('Server appears to be down:', err);
        setServerStatus('down');
      }
    };

    checkServerStatus();
  }, []);

  const analyzeHandle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const cleanHandle = handle.startsWith('@') ? handle.substring(1) : handle;
      const response = await axios.post(`${VITE_API_URI}/analyze`, { 
        handle: cleanHandle 
      }, {
        timeout: 900000 
      });
      setResult(response.data);
    } catch (err: any) {
      console.error('API Error:', err);
      setError(
        err.response?.data?.error || 
        'Failed to analyze Twitter handle. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getResultColor = (category: string) => {
    switch (category) {
      case 'techpaglu': return 'text-green-400';
      case 'reachpaglu': return 'text-yellow-400';
      case 'shitpaglu': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getCategoryDescription = (category: string) => {
    switch (category) {
      case 'techpaglu': return 'You\'re a true tech enthusiast! Your timeline is filled with tech discussions.';
      case 'reachpaglu': return 'You have a balanced interest in tech topics.';
      case 'shitpaglu': return 'Your Twitter presence shows limited tech-related content.';
      default: return '';
    }
  };
  
  const shareToTwitter = () => {
    if (!result) return;
    
    setIsSharingLoading(true);
    
    
    const shareText = `I scored ${result.score}/100 as a ${result.category} on the Real TechPaglu! Check your score:`;
    
  
    const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&hashtags=TechPaglu,TwitterAnalyzer`;
    
    
    window.open(twitterIntentUrl, '_blank');
    
    setIsSharingLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white flex relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-0 left-0 w-2/3 h-2/3 bg-green-500 rounded-full opacity-20 blur-3xl transform -translate-x-1/4 -translate-y-1/4"></div>
        <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-green-400 rounded-full opacity-10 blur-2xl transform -translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute top-0 left-0 w-96 h-96 bg-green-300 rounded-full opacity-5 blur-xl"></div>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-4 z-10">
        <div className="max-w-md w-full bg-gray-900/90 border border-green-500/30 rounded-xl shadow-xl p-8 backdrop-blur-sm">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-green-500 p-3 rounded-full shadow-lg shadow-green-500/30">
              <Twitter />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-center text-green-400 mb-2">
            Real TechPaglu ?
          </h1>
          <p className="text-center text-gray-400 mb-8">
           Lets see what your tweets says about how much techpaglu you are 
          </p>

          {serverStatus === 'down' && (
            <div className="mb-4 p-4 bg-red-900/30 rounded-lg border border-red-500/50 flex items-center">
              <div className="text-red-400 mr-2">
                <AlertTriangle />
              </div>
              <p className="text-red-400 text-sm">
                Backend server appears to be offline. Please make sure the server is running on port 3000.
              </p>
            </div>
          )}

          <form onSubmit={analyzeHandle} className="space-y-4">
            <div>
              <label htmlFor="handle" className="block text-sm font-medium text-green-400 mb-2">
                Twitter/X Handle
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                  @
                </span>
                <input
                  type="text"
                  id="handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.trim())}
                  className="block w-full pl-8 pr-3 py-3 bg-gray-800 border rounded-lg outline-none focus-visible:border-green-400 text-white"
                  placeholder="username"
                  disabled={loading || serverStatus === 'down'}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !handle || serverStatus === 'down'}
              className={`w-full py-3 px-4 rounded-lg text-black font-medium transition
                ${loading || !handle || serverStatus === 'down'
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : 'bg-green-500 hover:bg-green-400 shadow-md shadow-green-500/30'}`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin mr-2">
                    <Loader2/>
                  </div>
                  Analyzing... (this may take up to 30 seconds)
                </span>
              ) : (
                'Analyze Tweets'
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-8 text-center" ref={resultCardRef}>
              <div className="mb-4 relative p-6 border border-green-500/30 rounded-xl bg-gray-800/70 backdrop-blur-sm">
                <div className="text-6xl font-bold mb-2 text-green-400">
                  {result.score}/100
                </div>
                <div className={`text-2xl font-bold ${getResultColor(result.category)}`}>
                You are&nbsp;
                <span className={
                  result.category.toLocaleLowerCase() === "techpaglu" ? "text-blue-500" :
                  result.category.toLocaleLowerCase() === "reachpaglu" ? "text-purple-500" :
                  "text-red-500"
                }>
                  {result.category.charAt(0).toUpperCase() + result.category.slice(1)}
                </span>
                </div>
                <p className="mt-2 text-gray-300">
                  {getCategoryDescription(result.category)}
                </p>
                <div className="mt-4 text-sm text-gray-400">
                  <p>Analyzed {result.tweetCount} tweets</p>
                  <p>Found {result.keywordsFound} tech-related keywords</p>
                </div>
                
                {result.topKeywords && result.topKeywords.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-md font-medium text-green-400 mb-3">Top tech topics in your tweets:</h3>
                    <div className="flex flex-wrap justify-center gap-2">
                      {result.topKeywords.map(({ keyword, count }) => (
                        <span key={keyword} className="px-3 py-1 bg-green-900/50 border border-green-500/30 text-green-400 text-xs rounded-full">
                          {keyword} ({count})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <button
                  onClick={shareToTwitter}
                  disabled={isSharingLoading}
                  className="mt-6 flex items-center justify-center gap-2 mx-auto py-2 px-4 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium transition disabled:bg-blue-800 disabled:opacity-70"
                >
                  {isSharingLoading ? (
                    <>
                      <div className="animate-spin">
                        <Loader2/>
                      </div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Share2/>
                      <span>Share on Twitter</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-green-500/20 text-center text-xs text-gray-500">
            Rate your tech enthusiasm level and share with friends!
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;