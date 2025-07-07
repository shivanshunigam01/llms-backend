const express = require("express");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 3000;

// ✅ CORS setup
const allowedOrigins = [
  "http://localhost:8080", // Local dev
  "https://llms-ai-scribe-ashen.vercel.app", // Deployed frontend (remove trailing slash!)
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow server-to-server or Postman calls (no origin)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("CORS not allowed for this origin"));
      }
    },
  })
);

app.use(bodyParser.json());

// ✅ Chrome path for Render deployment
const chromePath = path.join(
  __dirname,
  ".cache/puppeteer/chrome/linux-138.0.7204.92/chrome-linux64/chrome"
);

// ✅ Main route
app.post("/generate-llms-txt", async (req, res) => {
  let { url, showFullText } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, message: "URL is required" });
  }

  // Normalize the URL
  url = url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const formattedUrl = `https://${url}`;

  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: chromePath,
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/115 Safari/537.36"
    );

    try {
      await page.goto(formattedUrl, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
    } catch (navErr) {
      await browser.close();
      return res.status(404).json({
        data: {
          success: false,
          message: `Domain not found: ${url}`,
        },
      });
    }

    const title = await page.title();
    const metaDesc = await page
      .$eval("meta[name='description']", (el) => el.content)
      .catch(() => "");

    const headings = await page.$$eval("h1, h2", (els) =>
      els.map((el) => el.innerText.trim()).filter(Boolean)
    );

    const bodyText = await page
      .$eval("body", (el) => el.innerText)
      .catch(() => "");

    await browser.close();

    const llmstxtRaw = [
      `# http://${url} llms.txt`,
      ``,
      `- [${title}](${formattedUrl}): ${
        metaDesc || "No description available."
      }`,
    ].join("\n");

    let llmsfulltxtRaw = `# http://${url} llms-full.txt\n\n## ${title}\n`;
    if (metaDesc) llmsfulltxtRaw += `${metaDesc}\n\n`;
    headings.forEach((h) => (llmsfulltxtRaw += `### ${h}\n`));
    if (showFullText && bodyText) llmsfulltxtRaw += `\n${bodyText}`;

    const llmstxtFormatted = llmstxtRaw.replace(/\n/g, "<br>");
    const llmsfulltxtFormatted = showFullText
      ? llmsfulltxtRaw.replace(/\n/g, "<br>")
      : undefined;

    res.json({
      data: {
        success: true,
        data: {
          llmstxt: llmstxtFormatted,
          llmsfulltxt: llmsfulltxtFormatted,
        },
      },
    });
  } catch (err) {
    console.error(" Error:", err.message);
    res.status(500).json({
      data: {
        success: false,
        message: `Failed to process website: ${err.message}`,
      },
    });
  }
});

// ✅ Optional health check route
app.get("/", (req, res) => {
  res.send("✅ LLMs backend is running!");
});

app.listen(PORT, () =>
  console.log(` LLMs API running at http://localhost:${PORT}`)
);
