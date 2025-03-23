// src/services/twitter.js
import natural from 'natural';
import { delay, getRandomTime } from '../utils/helpers.js';
import { launchBrowser, configurePage } from './puppeteer.js';
import { fileURLToPath } from 'url';
import { last403Time, COOLDOWN_PERIOD } from './cooldown.js';
import { GoogleGenerativeAI } from "@google/generative-ai"
import { GEMINI_API_KEY } from '../config/env.js';



const tokenizer = new natural.WordTokenizer();

async function scrollWithRandomPausesAndCollectTweets(page, maxTimeInSeconds = 60) {
  const startTime = Date.now();
  const endTime = startTime + (maxTimeInSeconds * 1000);
  
  const minScrollAmount = 500;  
  const maxScrollAmount = 1200; 

  const minDelay = 200;  
  const maxDelay = 500; 

  // sometimes rapid scroll
  const rapidScrollChance = 0.25;  

  // set for avoiding duplicates
  const allTweets = new Set();
  let seenElements = new Set();

  async function collectTweets() {
    const newTweets = await page.evaluate(() => {
      const tweets = [];
      const processedElements = new Set();

      function processElements(elements) {
        return Array.from(elements).filter(el => {
          const identifier = el.innerText + "_" + el.offsetTop;
          if (!processedElements.has(identifier)) {
            processedElements.add(identifier);
            return true;
          }
          return false;
        }).map(el => el.textContent);
      }

      // find tweet text elements
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

      // Last fallback
      if (tweets.length === 0) {
        const paragraphs = document.querySelectorAll('p');
        if (paragraphs.length > 0) {
          tweets.push(...processElements(paragraphs));
        }
      }

      return tweets;
    });

    newTweets.forEach(tweet => allTweets.add(tweet));
    console.log(`Found ${newTweets.length} new tweets. Total unique tweets: ${allTweets.size}`);
  }

  while (Date.now() < endTime) {
    await collectTweets();

    const isRapidScroll = Math.random() < rapidScrollChance;
    // rapid scroll
    if (isRapidScroll) {
      const quickScrolls = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < quickScrolls; i++) {
        const scrollAmount = Math.floor(Math.random() *
          (maxScrollAmount - minScrollAmount + 1)) + minScrollAmount;
        await page.evaluate(scrollY => window.scrollBy(0, scrollY), scrollAmount);
        await delay(page, getRandomTime(150, 350)); 
      }
      await delay(page, getRandomTime(600, 1500));
    } else {
      // Normal scroll 
      const scrollAmount = Math.floor(Math.random() *
        (maxScrollAmount - minScrollAmount + 1)) + minScrollAmount;
      await page.evaluate(scrollY => window.scrollBy(0, scrollY), scrollAmount);

      // Occasionally pause a bit longer 
      const longPauseChance = 0.2; 
      if (Math.random() < longPauseChance) {
        await delay(page, getRandomTime(500, 1000));
      } else {
        await delay(page, getRandomTime(minDelay, maxDelay));
      }
    }
    const isAtBottom = await page.evaluate(() => {
      return window.innerHeight + window.scrollY >= document.body.scrollHeight;
    });

    if (isAtBottom) {
      await collectTweets();
      await delay(page, getRandomTime(500, 1000));
      break;
    }
  }
  await collectTweets();
  return Array.from(allTweets).slice(0, 500);
}

export async function analyzeTwitter(handle) {
  let browser;
  try {
    // cooldown period check
    if (last403Time && (Date.now() - last403Time < COOLDOWN_PERIOD)) {
      const waitTime = Math.ceil((COOLDOWN_PERIOD - (Date.now() - last403Time)) / 1000);
      console.log(`In cooldown period. Need to wait ${waitTime} seconds.`);
      throw new Error(`Rate limited by Twitter. Please try again after ${waitTime} seconds.`);
    }
    // launch browser
    browser = await launchBrowser();

    const page = await browser.newPage();
    // configure browser
    await configurePage(page);

    // load cookies if they exist
    // const cookiesFilePath = path.join(__dirname, 'twitter-cookies.json');
    // await loadCookies(page, cookiesFilePath);

    // Add a random delay before navigating
    await delay(page, getRandomTime(500, 1500));

    try {
      await page.goto(`https://twitter.com/${handle}`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
    } catch (e) {
      await page.goto(`https://x.com/${handle}`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
    }

    // wait
    await delay(page, getRandomTime(500, 1500));

    // Check if we got a 403 page
    const is403Page = await page.evaluate(() => {
      return document.body.innerText.includes('403 Forbidden') ||
        document.title.includes('403 Forbidden');
    });

    if (is403Page) {
    // Update cooldown time
    //   last403Time = Date.now();
    //   fs.writeFileSync(path.join(__dirname, 'cooldown.json'), JSON.stringify({ time: last403Time }));
    throw new Error('403 Forbidden: Twitter is blocking access. Please try again later.');
    }
    // login page
    const isLoginPage = await page.evaluate(() => {
      return document.body.innerText.includes('Sign in to X') ||
        document.body.innerText.includes('Log in to Twitter') ||
        document.body.innerText.includes('Sign in');
    });

    if (isLoginPage) {
      console.log("Login page detected, attempting to log in...");
      try {
        await page.waitForSelector('input[autocomplete="username"]', { timeout: 5000 });
        await page.click('input[autocomplete="username"]');
        // Type username
        const username = handle;
        for (let i = 0; i < username.length; i++) {
          await page.keyboard.type(username[i]);
          await delay(page, getRandomTime(50, 100));
        }
        await delay(page, getRandomTime(500, 1000));
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
        // const cookies = await page.cookies();
        // fs.writeFileSync(path.join(__dirname, 'twitter-cookies.json'), JSON.stringify(cookies, null, 2));
        console.log("Login successful! Cookies saved for future sessions.");

      } catch (loginError) {
        console.error("Error during login process:", loginError);
        throw new Error('Unable to log in to Twitter. Please check your credentials or try again later.');
      }
    }
    try {
      await Promise.race([
        page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 }),
        page.waitForSelector('[data-testid="tweetText"]', { timeout: 10000 }),
        page.waitForSelector('[data-testid="cellInnerDiv"]', { timeout: 10000 })
      ]);
    } catch (e) {
      console.log('Failed to find tweets with standard selectors, continuing anyway...');
    }
    const tweets = await scrollWithRandomPausesAndCollectTweets(page);
    console.log(`Found ${tweets.length} tweets/text elements`);

    if (tweets.length === 0) {
      throw new Error('No tweets found. Please check the handle and try again.');
    }
    
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Analyze the following tweets and determine how much of a tech enthusiast this person is.
    Provide a score out of 100, where 100 indicates an extreme tech enthusiast.
    category = "TechPaglu" if score > 80 | "ReachPaglu" is score >50 but <80 | else "ShitPaglu"
    ### Tweets:
    ${JSON.stringify(tweets)}

    ### Response Format:
    Your response must be a valid JSON object with the following structure (without any extra formatting or markdown syntax like \`\`\`json):
    {
      "score": <number>, 
      "category": "<string>", 
      "tweetCount": <number>
    }`;

    try {
      const result = await model.generateContent(prompt);
      let jsonText = await result.response.text();
      console.log("Raw AI Response:", jsonText);
      jsonText = jsonText.replace(/```json|```/g, "").trim();

      try {
        const jsonData = JSON.parse(jsonText);

        if (!("score" in jsonData) || !("category" in jsonData) || !("tweetCount" in jsonData)) {
          throw new Error("Incomplete AI response");
        }

        return jsonData; 
      } catch (error) {
        console.error("Failed to parse JSON:", error);
        return { error: "Invalid response format from AI" };
      }
    } catch (error) {
      console.error("AI API Error:", error);
      return { error: "AI request failed" };
    }

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}