// src/services/twitter.js
import natural from 'natural';
import { delay, getRandomTime } from '../utils/helpers.js';
import { launchBrowser, configurePage, loadCookies } from './puppeteer.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { last403Time, COOLDOWN_PERIOD } from './cooldown.js';
import { TWITTER_USERNAME } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  'quantum computing', 'iot', 'vr', '5g', 'edge computing',

  // Security
  'cybersecurity', 'encryption', 'oauth', 'jwt', 'authentication', 'authorization',
  'penetration testing', 'firewall', 'ssl', 'https', 'zero trust', 'security',

  // General Tech Terms
  'programming', 'developer', 'code', 'tech', 'software', 'web', 'stack overflow',
  'coding', 'engineer', 'debugging', 'deployment', 'production', 'backend', 'frontend',
  'fullstack', 'architecture', 'scalability', 'performance', 'optimization'
];

const tokenizer = new natural.WordTokenizer();

async function scrollWithRandomPausesAndCollectTweets(page, maxTimeInSeconds = 60) {
  const startTime = Date.now();
  const endTime = startTime + (maxTimeInSeconds * 1000);

  // Human-like scroll behavior parameters
  const minScrollAmount = 500;  // Minimum pixels to scroll
  const maxScrollAmount = 1200; // Maximum pixels to scroll

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

export async function analyzeTwitter(handle) {
  let browser;
  try {
    // Check for cooldown period
    if (last403Time && (Date.now() - last403Time < COOLDOWN_PERIOD)) {
      const waitTime = Math.ceil((COOLDOWN_PERIOD - (Date.now() - last403Time)) / 1000);
      console.log(`In cooldown period. Need to wait ${waitTime} seconds.`);
      throw new Error(`Rate limited by Twitter. Please try again after ${waitTime} seconds.`);
    }

    // Launch browser with improved stealth settings
    browser = await launchBrowser();

    const page = await browser.newPage();

    // Set more realistic browser behavior
    await configurePage(page);

    // Try to load cookies if they exist
    const cookiesFilePath = path.join(__dirname, 'twitter-cookies.json');
    await loadCookies(page, cookiesFilePath);

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
        const username = TWITTER_USERNAME;
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

        // Wait for login to complete
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 })
          .catch(() => console.log("Navigation timeout after login, continuing anyway"));

        // Save cookies for future use
        const cookies = await page.cookies();
        fs.writeFileSync(path.join(__dirname, 'twitter-cookies.json'), JSON.stringify(cookies, null, 2));
        console.log("Login successful! Cookies saved for future sessions.");

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