
const express = require("express");
const puppeteer = require("puppeteer");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static("public"));

app.post("/resolve", async (req, res) => {
  const { url } = req.body;

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ]
    });

    const page = await browser.newPage();

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    let previous = page.url();
    let stable = 0;

    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 500));

      const current = page.url();

      if (current === previous) {
        stable++;
        if (stable > 4) break;
      } else {
        stable = 0;
        previous = current;
      }
    }

    const finalUrl = page.url();

    const convertedUrl = finalUrl.replace(/(?:dl\.)?flipkart\.com/g, "shopsy.in");

    res.json({
      finalUrl,
      convertedUrl
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }

  if (browser) {
    await browser.close();
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running");
});
