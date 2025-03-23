import React, { useState, useEffect } from 'react';
import { Twitter, Brain, Loader2, AlertTriangle } from 'lucide-react';
import axios from 'axios';

type AnalysisResult = {
  score: number;
  category: 'techpaglu' | 'reachpaglu' | 'shitpaglu';
  tweetCount: number;
  keywordsFound: number;
  topKeywords?: { keyword: string; count: number }[];
};

function App() {
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState<'up'|'down'|'checking'>('checking');

  // Check if the backend server is running
  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        await axios.get('http://localhost:3000/health');
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
      // Remove @ if user included it
      const cleanHandle = handle.startsWith('@') ? handle.substring(1) : handle;
      
      const response = await axios.post('http://localhost:3000/analyze', { 
        handle: cleanHandle 
      }, {
        timeout: 60000 // Increase timeout to 60 seconds as scraping can take time
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
      case 'techpaglu': return 'text-green-600';
      case 'reachpaglu': return 'text-yellow-600';
      case 'shitpaglu': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getCategoryDescription = (category: string) => {
    switch (category) {
      case 'techpaglu': return 'Youre a true tech enthusiast! Your timeline is filled with tech discussions.';
      case 'reachpaglu': return 'You have a balanced interest in tech topics.';
      case 'shitpaglu': return 'Your Twitter presence shows limited tech-related content.';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="flex items-center justify-center mb-8">
          <Twitter className="w-12 h-12 text-blue-500 mr-4" />
          <Brain className="w-12 h-12 text-indigo-500" />
        </div>
        
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
          Tech Enthusiasm Analyzer
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Discover how much of a tech enthusiast you are based on your tweets!
        </p>

        {serverStatus === 'down' && (
          <div className="mb-4 p-4 bg-red-50 rounded-lg flex items-center">
            <AlertTriangle className="text-red-500 mr-2" />
            <p className="text-red-600 text-sm">
              Backend server appears to be offline. Please make sure the server is running on port 3000.
            </p>
          </div>
        )}

        <form onSubmit={analyzeHandle} className="space-y-4">
          <div>
            <label htmlFor="handle" className="block text-sm font-medium text-gray-700 mb-2">
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
                className="block w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="username"
                disabled={loading || serverStatus === 'down'}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !handle || serverStatus === 'down'}
            className={`w-full py-3 px-4 rounded-lg text-white font-medium transition
              ${loading || !handle || serverStatus === 'down'
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <Loader2 className="animate-spin mr-2" />
                Analyzing... (this may take up to 30 seconds)
              </span>
            ) : (
              'Analyze Tweets'
            )}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-50 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-8 text-center">
            <div className="mb-4">
              <div className="text-6xl font-bold mb-2">
                {result.score}/100
              </div>
              <div className={`text-2xl font-bold ${getResultColor(result.category)}`}>
                {result.category.charAt(0).toUpperCase() + result.category.slice(1)}
              </div>
              <p className="mt-2 text-gray-700">
                {getCategoryDescription(result.category)}
              </p>
              <div className="mt-4 text-sm text-gray-600">
                <p>Analyzed {result.tweetCount} tweets</p>
                <p>Found {result.keywordsFound} tech-related keywords</p>
              </div>
              
              {result.topKeywords && result.topKeywords.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-md font-medium text-gray-700 mb-2">Top tech topics in your tweets:</h3>
                  <div className="flex flex-wrap justify-center gap-2">
                    {result.topKeywords.map(({ keyword, count }) => (
                      <span key={keyword} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {keyword} ({count})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;