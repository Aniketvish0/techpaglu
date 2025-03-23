import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getRandomUserAgent, delay } from '../utils/helpers.js';

puppeteer.use(StealthPlugin());

export async function launchBrowser() {
  return puppeteer.launch({
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
}

export async function configurePage(page) {
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
  await page.evaluateOnNewDocument(() => {
    const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
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
}

export async function loadCookies(page, cookiesFilePath) {
  try {
    const fs = await import('fs');
    const path = await import('path');
    if (fs.existsSync(cookiesFilePath)) {
      const cookiesString = fs.readFileSync(cookiesFilePath, 'utf8');
      const cookies = JSON.parse(cookiesString);
      await page.setCookie(...cookies);
      console.log("Loaded existing Twitter cookies");
    }
  } catch (cookieError) {
    console.log("No existing cookies found or error loading cookies:", cookieError.message);
  }
}