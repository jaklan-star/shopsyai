import express from 'express';
import { createServer as createViteServer } from 'vite';
import puppeteer from 'puppeteer';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  app.post('/api/resolve', async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process', // <- this one doesn't works in Windows
          '--disable-gpu'
        ]
      });
      const page = await browser.newPage();
      
      // Set user agent to mobile or desktop
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      let finalUrl = url;
      
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        
        // Wait for URL to stabilize
        let previousUrl = page.url();
        let stableCount = 0;
        
        for (let i = 0; i < 30; i++) { // Max 15 seconds (30 * 500ms)
          await new Promise(r => setTimeout(r, 500));
          const currentUrl = page.url();
          if (currentUrl === previousUrl) {
            stableCount++;
            if (stableCount >= 4) { // 2 seconds stable
              break;
            }
          } else {
            stableCount = 0;
            previousUrl = currentUrl;
          }
        }
        finalUrl = page.url();
      } catch (e: any) {
        // Timeout or other error, try to grab whatever URL we landed on
        console.warn('Navigation timeout or error, using current URL:', e.message);
        finalUrl = page.url();
      }

      let convertedUrl = finalUrl;
      if (finalUrl.includes('flipkart.com')) {
        // Replace flipkart.com with shopsy.in
        // Also handle dl.flipkart.com -> shopsy.in
        convertedUrl = finalUrl.replace(/(?:dl\.)?flipkart\.com/g, 'shopsy.in');
      }

      res.json({ finalUrl, convertedUrl });
    } catch (error: any) {
      console.error('Puppeteer error:', error);
      res.status(500).json({ error: 'Failed to resolve URL', details: error.message });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
