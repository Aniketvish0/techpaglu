import express from 'express';
import natural from 'natural';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

puppeteer.use(StealthPlugin());

// Simple in-memory cache
const cache = {};
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting and cooldown
let last403Time = null;
const COOLDOWN_PERIOD = 15 * 60 * 1000; // 15 minutes
try {
  if (fs.existsSync(path.join(__dirname, 'cooldown.json'))) {
    const cooldownData = JSON.parse(fs.readFileSync(path.join(__dirname, 'cooldown.json'), 'utf8'));
    last403Time = cooldownData.time;
  }
} catch (e) {
  console.log("No cooldown data found");
}

const techKeywords = [
  // Programming Languages
  'javascript', 'python', 'java', 'typescript', 'rust', 'go', 'golang', 'ruby', 'php', 'swift',
  'kotlin', 'scala', 'perl', 'haskell', 'lua', 'dart', 'cpp', 'csharp', 'julia',
  
  // Web Technologies
  'html', 'css', 'react', 'vue', 'angular', 'svelte', 'nextjs', 'nodejs', 'deno', 'express',
  'graphql', 'rest', 'api', 'websocket', 'pwa', 'webpack', 'vite', 'rollup', 'sass', 'tailwind',
  
  // Databases
  'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'cassandra', 'dynamodb',
  'firebase', 'supabase', 'oracle', 'mariadb', 'neo4j', 'cockroachdb', 'planetscale',
  
  // Cloud & DevOps
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ansible', 'jenkins', 'gitlab',
  'github', 'bitbucket', 'circleci', 'nginx', 'apache', 'lambda', 'serverless', 'microservices',
  
  // AI & ML
  'chatgpt', 'gpt4', 'gpt3', 'llama', 'claude', 'gemini', 'bert', 'tensorflow', 'pytorch',
  'keras', 'huggingface', 'openai', 'anthropic', 'stable diffusion', 'midjourney', 'dall-e',
  'machine learning', 'deep learning', 'neural network', 'nlp', 'computer vision',
  
  // Software Engineering
  'algorithm', 'data structure', 'design pattern', 'clean code', 'refactoring', 'agile',
  'scrum', 'kanban', 'ci/cd', 'unit test', 'integration test', 'e2e test', 'tdd', 'dry',
  'solid principles', 'mvc', 'orm', 'rest', 'soap', 'middleware',
  
  // Tools & Platforms
  'vscode', 'intellij', 'eclipse', 'vim', 'emacs', 'git', 'npm', 'yarn', 'pnpm', 'gradle',
  'maven', 'docker', 'postman', 'insomnia', 'jira', 'confluence', 'slack', 'discord',
  
  // Emerging Tech
  'blockchain', 'web3', 'ethereum', 'solidity', 'nft', 'defi', 'dao', 'metaverse',
  'quantum computing', 'iot','vr', '5g', 'edge computing',
  
  // Security
  'cybersecurity', 'encryption', 'oauth', 'jwt', 'authentication', 'authorization',
  'penetration testing', 'firewall', 'ssl', 'https', 'zero trust', 'security',
  
  // General Tech Terms
  'programming', 'developer', 'code', 'tech', 'software', 'web', 'stack overflow',
  'coding', 'engineer', 'debugging', 'deployment', 'production', 'backend', 'frontend',
  'fullstack', 'architecture', 'scalability', 'performance', 'optimization'
];

const tokenizer = new natural.WordTokenizer();

// Helper functions
function getRandomTime(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// Create a delay function compatible with older Puppeteer versions
async function delay(page, ms) {
  return page.evaluate(ms => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }, ms);
}

async function scrollWithRandomPausesAndCollectTweets(page, maxTimeInSeconds = 60) {
  const startTime = Date.now();
  const endTime = startTime + (maxTimeInSeconds * 1000);
  
  // Human-like scroll behavior parameters
  const minScrollAmount = 500;  // Minimum pixels to scroll
  const maxScrollAmount = 1200;  // Maximum pixels to scroll
  
  // Faster but still human-like delays
  const minDelay = 200;  // Minimum delay between scrolls in ms
  const maxDelay = 500; // Maximum delay between scrolls in ms
  
  // Occasionally do rapid scrolls to simulate user finding something interesting
  const rapidScrollChance = 0.15;  // 15% chance for rapid scrolling
  
  // Set to track unique tweets to avoid duplicates
  const allTweets = new Set();
  let seenElements = new Set();
  
  // Function to collect tweets during scrolling
  async function collectTweets() {
    const newTweets = await page.evaluate(() => {
      // Try different selectors that might contain tweet text
      const tweets = [];
      const processedElements = new Set();
      
      // Process elements and add to tweets array if not already processed
      function processElements(elements) {
        return Array.from(elements).filter(el => {
          // Create a unique identifier for the element (could use attributes or position)
          const identifier = el.innerText + "_" + el.offsetTop;
          if (!processedElements.has(identifier)) {
            processedElements.add(identifier);
            return true;
          }
          return false;
        }).map(el => el.textContent);
      }
      
      // Try tweetText elements first (most specific)
      const tweetTextElements = document.querySelectorAll('[data-testid="tweetText"]');
      if (tweetTextElements.length > 0) {
        tweets.push(...processElements(tweetTextElements));
      }
      
      // If we didn't find tweet text elements, try tweet articles
      if (tweets.length === 0) {
        const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
        if (tweetElements.length > 0) {
          tweets.push(...processElements(tweetElements));
        }
      }
      
      // If still no tweets, try cell divs
      if (tweets.length === 0) {
        const cellDivs = document.querySelectorAll('[data-testid="cellInnerDiv"]');
        if (cellDivs.length > 0) {
          tweets.push(...processElements(cellDivs));
        }
      }
      
      // Last resort fallback
      if (tweets.length === 0) {
        const paragraphs = document.querySelectorAll('p');
        if (paragraphs.length > 0) {
          tweets.push(...processElements(paragraphs));
        }
      }
      
      return tweets;
    });
    
    // Add new tweets to our collection
    newTweets.forEach(tweet => allTweets.add(tweet));
    console.log(`Found ${newTweets.length} new tweets. Total unique tweets: ${allTweets.size}`);
  }
  
  while (Date.now() < endTime) {
    // Collect tweets before scrolling
    await collectTweets();
    
    // Decide if we do a rapid scroll or normal scroll
    const isRapidScroll = Math.random() < rapidScrollChance;
    
    if (isRapidScroll) {
      // Rapid scroll simulation (2-4 quick scrolls)
      const quickScrolls = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < quickScrolls; i++) {
        const scrollAmount = Math.floor(Math.random() * 
          (maxScrollAmount - minScrollAmount + 1)) + minScrollAmount;
        await page.evaluate(scrollY => window.scrollBy(0, scrollY), scrollAmount);
        await delay(page, getRandomTime(150, 350)); // Quicker delays for rapid scrolling
      }
      // Pause a bit longer after rapid scrolling as a human would
      await delay(page, getRandomTime(600, 1500));
    } else {
      // Normal scroll behavior
      const scrollAmount = Math.floor(Math.random() * 
        (maxScrollAmount - minScrollAmount + 1)) + minScrollAmount;
      await page.evaluate(scrollY => window.scrollBy(0, scrollY), scrollAmount);
      
      // Occasionally pause a bit longer as if reading content
      const longPauseChance = 0.2; // 20% chance for longer pause
      if (Math.random() < longPauseChance) {
        await delay(page, getRandomTime(1000, 2500));
      } else {
        await delay(page, getRandomTime(minDelay, maxDelay));
      }
    }
    
    // Check if we've reached the bottom of the page
    const isAtBottom = await page.evaluate(() => {
      return window.innerHeight + window.scrollY >= document.body.scrollHeight;
    });
    
    if (isAtBottom) {
      // One final collection of tweets
      await collectTweets();
      // Wait a moment as a human would when reaching the bottom
      await delay(page, getRandomTime(1000, 2000));
      break;
    }
  }
  
  // Final collection of tweets before returning
  await collectTweets();
  
  // Convert Set to Array before returning
  return Array.from(allTweets).slice(0, 500);
}
 

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Main analyze endpoint with retry mechanism
async function analyzeWithRetry(handle, retryCount = 0) {
  let browser;

  try {
    console.log(`Starting analysis for handle: @${handle} (Attempt ${retryCount + 1})`);
    
    // Check for cooldown period
    if (last403Time && (Date.now() - last403Time < COOLDOWN_PERIOD)) {
      const waitTime = Math.ceil((COOLDOWN_PERIOD - (Date.now() - last403Time)) / 1000);
      console.log(`In cooldown period. Need to wait ${waitTime} seconds.`);
      throw new Error(`Rate limited by Twitter. Please try again after ${waitTime} seconds.`);
    }
    
    // Launch browser with improved stealth settings
    browser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--window-size=1280,800',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      ignoreHTTPSErrors: true
    });
    
    const page = await browser.newPage();
    
    // Set more realistic browser behavior
    const userAgent = getRandomUserAgent();
    await page.setUserAgent(userAgent);
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache'
    });
    
    await page.setViewport({ 
      width: 1280 + Math.floor(Math.random() * 100),
      height: 800 + Math.floor(Math.random() * 100),
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false
    });
    
    // Randomize the browser fingerprint
    await page.evaluateOnNewDocument(() => {
      // Override fingerprint methods
      const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        // Add some randomization to WebGL fingerprinting
        if (parameter === 37445) {
          return 'Intel Inc.' + (Math.random() < 0.5 ? ' Random' : '');
        }
        if (parameter === 37446) {
          return 'Intel Iris' + (Math.random() < 0.5 ? ' Pro Graphics' : ' Graphics');
        }
        return originalGetParameter.apply(this, arguments);
      };
      
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => Math.floor(Math.random() * 10) });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 + Math.floor(Math.random() * 8) });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 + Math.floor(Math.random() * 16) });
      
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const plugins = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
            { name: 'Native Client', filename: 'internal-nacl-plugin' }
          ];
          return plugins;
        }
      });
    });
    
    // Try to load cookies if they exist
    try {
      const cookiesFilePath = path.join(__dirname, 'twitter-cookies.json');
      if (fs.existsSync(cookiesFilePath)) {
        const cookiesString = fs.readFileSync(cookiesFilePath, 'utf8');
        const cookies = JSON.parse(cookiesString);
        await page.setCookie(...cookies);
        console.log("Loaded existing Twitter cookies");
      }
    } catch (cookieError) {
      console.log("No existing cookies found or error loading cookies:", cookieError.message);
    }
    
    // Add a random delay before navigating
    await delay(page, getRandomTime(500, 3000));
    
    // Navigate to Twitter
    console.log(`Navigating to Twitter profile...`);
    try {
      await page.goto(`https://twitter.com/${handle}`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
    } catch (e) {
      console.log('Twitter URL failed, trying X.com...');
      await page.goto(`https://x.com/${handle}`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
    }
    
    // Take a screenshot for debugging
    await page.screenshot({ path: `debug-${handle}-initial.png` });
    
    // Random wait
    await delay(page, getRandomTime(1000, 3000));
    
    // Check if we got a 403 page
    const is403Page = await page.evaluate(() => {
      return document.body.innerText.includes('403 Forbidden') || 
             document.title.includes('403 Forbidden');
    });
    
    if (is403Page) {
      console.log("403 Forbidden page detected");
      
      // Update cooldown time
      last403Time = Date.now();
      fs.writeFileSync(path.join(__dirname, 'cooldown.json'), JSON.stringify({ time: last403Time }));
      
      if (retryCount < 2) {
        const delayTime = Math.pow(2, retryCount + 1) * 5000; // Exponential backoff
        console.log(`403 error detected. Retrying in ${delayTime/1000} seconds...`);
        await browser.close();
        await new Promise(resolve => setTimeout(resolve, delayTime));
        return analyzeWithRetry(handle, retryCount + 1);
      }
      throw new Error('403 Forbidden: Twitter is blocking access. Please try again later.');
    }
    
    // Check if login is required
    const isLoginPage = await page.evaluate(() => {
      return document.body.innerText.includes('Sign in to X') || 
             document.body.innerText.includes('Log in to Twitter') ||
             document.body.innerText.includes('Sign in');
    });
    
    if (isLoginPage) {
      console.log("Login page detected, attempting to log in...");
      
      try {
        // Take screenshot of login page
        await page.screenshot({ path: `login-page-${handle}.png` });
        
        // Wait for username input field and click it
        await page.waitForSelector('input[autocomplete="username"]', { timeout: 5000 });
        await page.click('input[autocomplete="username"]');
        
        // Type with random delays between keystrokes
        const username = process.env.TWITTER_USERNAME;
        for (let i = 0; i < username.length; i++) {
          await page.keyboard.type(username[i]);
          await delay(page, getRandomTime(50, 150));
        }
        
        await delay(page, getRandomTime(500, 1500));
        
        // Find and click the Next button
        const nextButtons = await page.$$('div[role="button"]');
        for (const button of nextButtons) {
          const buttonText = await page.evaluate(el => el.textContent, button);
          if (buttonText.includes('Next')) {
            await button.click();
            break;
          }
        }
        
        // Random wait
        await delay(page, getRandomTime(1000, 2000));
        
        // Wait for password field
        await page.waitForSelector('input[name="password"]', { timeout: 10000 });
        
        
        await delay(page, getRandomTime(500, 1500));
        
        // // Find and click the Login button
        // const loginButton = await page.$('div[data-testid="LoginForm_Login_Button"]');
        // if (loginButton) {
        //   await loginButton.click();
        // } else {
        //   // Try alternate selector if the first one fails
        //   const allButtons = await page.$$('div[role="button"]');
        //   for (const button of allButtons) {
        //     const buttonText = await page.evaluate(el => el.textContent, button);
        //     if (buttonText.includes('Log in')) {
        //       await button.click();
        //       break;
        //     }
        //   }
        // }
        
        // Wait for login to complete
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 })
          .catch(() => console.log("Navigation timeout after login, continuing anyway"));
        
        // Save cookies for future use
        const cookies = await page.cookies();
        fs.writeFileSync(path.join(__dirname, 'twitter-cookies.json'), JSON.stringify(cookies, null, 2));
        console.log("Login successful! Cookies saved for future sessions.");
        
        // // Navigate to the profile page again after login
        // await page.goto(`https://twitter.com/${handle}`, {
        //   waitUntil: 'networkidle2',
        //   timeout: 30000
        // });
      } catch (loginError) {
        console.error("Error during login process:", loginError);
        await page.screenshot({ path: 'login-error.png' });
        throw new Error('Unable to log in to Twitter. Please check your credentials or try again later.');
      }
    } else {
      console.log("No login page detected, proceeding with scraping...");
    }
    
    // Wait for tweets to load with multiple possible selectors
    console.log('Waiting for tweets to load...');
    try {
      await Promise.race([
        page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 }),
        page.waitForSelector('[data-testid="tweetText"]', { timeout: 10000 }),
        page.waitForSelector('[data-testid="cellInnerDiv"]', { timeout: 10000 })
      ]);
    } catch (e) {
      console.log('Failed to find tweets with standard selectors, continuing anyway...');
    }
    
    // Scroll a few times to load more tweets with human-like behavior
    console.log('Scrolling and extracting tweets simultaneously...');
    const tweets = await scrollWithRandomPausesAndCollectTweets(page);
    console.log(`Total tweets collected: ${tweets.length}`);
    fs.writeFileSync(path.join(__dirname, 'twitter.json'), JSON.stringify(tweets));
    console.log("Tweets saved in json");
    console.log(`Found ${tweets.length} tweets/text elements`);
    
    if (tweets.length === 0) {
      throw new Error('No tweets found. Please check the handle and try again.');
    }

    // Analyze tweets
    let techScore = 0;
    let totalKeywordsFound = 0;
    let keywordsFoundMap = {};
    
    tweets.forEach(tweet => {
      if (!tweet) return;
      const tweetLower = tweet.toLowerCase();
      techKeywords.forEach(keyword => {
        if (tweetLower.includes(keyword.toLowerCase())) {
          techScore += 1;
          totalKeywordsFound += 1;
          keywordsFoundMap[keyword] = (keywordsFoundMap[keyword] || 0) + 1;
        }
      });
    });

    // Calculate final score (0-100)
    const normalizedScore = Math.min(100, (totalKeywordsFound / (tweets.length * 0.3)) * 100);
    
    // Determine category
    let category;
    if (normalizedScore > 80) category = 'techpaglu';
    else if (normalizedScore < 50) category = 'shitpaglu';
    else category = 'reachpaglu';

    console.log(`Analysis complete: Score=${Math.round(normalizedScore)}, Category=${category}`);
    
    const resultData = {
      score: Math.round(normalizedScore),
      category,
      tweetCount: tweets.length,
      keywordsFound: totalKeywordsFound,
      topKeywords: Object.entries(keywordsFoundMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([keyword, count]) => ({ keyword, count }))
    };
    
    return resultData;

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

app.post('/analyze', async (req, res) => {
  const { handle } = req.body;
  
  if (!handle) {
    return res.status(400).json({ error: 'Twitter handle is required' });
  }
  
  // Check cache
  if (cache[handle] && (Date.now() - cache[handle].timestamp < CACHE_TTL)) {
    console.log(`Returning cached result for ${handle}`);
    return res.json(cache[handle].data);
  }
  
  try {
    const resultData = await analyzeWithRetry(handle);
    
    // Cache the result
    cache[handle] = {
      timestamp: Date.now(),
      data: resultData
    };
    
    res.json(resultData);
  } catch (error) {
    console.error('Error in analyze endpoint:', error);
    
    if (error.message.includes('403 Forbidden')) {
      return res.status(403).json({ 
        error: 'Twitter is temporarily blocking our requests. Please try again later.',
        retryAfter: last403Time ? Math.ceil((COOLDOWN_PERIOD - (Date.now() - last403Time)) / 1000) : 900
      });
    }
    
    if (error.message.includes('No tweets found')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to analyze tweets. Please try again.',
      details: error.message
    });
  }
});

// Clear cache endpoint (for admin use)
app.post('/clear-cache', (req, res) => {
  const { secret } = req.body;
  
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  Object.keys(cache).forEach(key => delete cache[key]);
  res.json({ success: true, message: 'Cache cleared successfully' });
});

// Clear cooldown endpoint (for admin use)
app.post('/clear-cooldown', (req, res) => {
  const { secret } = req.body;
  
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  last403Time = null;
  try {
    fs.unlinkSync(path.join(__dirname, 'cooldown.json'));
  } catch (e) {
    console.log('No cooldown file to delete');
  }
  
  res.json({ success: true, message: 'Cooldown reset successfully' });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'UP', 
    timestamp: new Date().toISOString(),
    cooldown: last403Time ? {
      active: Date.now() - last403Time < COOLDOWN_PERIOD,
      remainingSeconds: Math.max(0, Math.ceil((COOLDOWN_PERIOD - (Date.now() - last403Time)) / 1000))
    } : null,
    cacheSize: Object.keys(cache).length
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});