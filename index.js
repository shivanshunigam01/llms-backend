const express = require("express");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const xml2js = require("xml2js");
const zlib = require("zlib");

const app = express();
const PORT = 3000;

//  CORS setup
const allowedOrigins = [
  "http://localhost:8081", // Local dev
  "https://llms-ai-scribe-ashen.vercel.app", // Deployed frontend (remove trailing slash!)
  "http://localhost:3000", // Local dev
  "https://site-map-extractor-seo.vercel.app", // Deployed frontend (remove trailing slash!)
];

app.use(
  cors({
    origin: function (origin, callback) {
      console.log(origin);

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

//  Chrome path for Render deployment
const chromePath = path.join(
  __dirname,
  ".cache/puppeteer/chrome/linux-138.0.7204.92/chrome-linux64/chrome"
);

//  Main route
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

//  Sitemap URL extraction route
app.post("/extract-sitemap-urls", async (req, res) => {
  const { url } = req.body;

  if (!url || !url.startsWith("http")) {
    return res
      .status(400)
      .json({ success: false, message: "Valid sitemap URL is required" });
  }

  const parser = new xml2js.Parser({
    explicitArray: true,
    ignoreAttrs: true,
    tagNameProcessors: [xml2js.processors.stripPrefix],
  });

  const fetchAndParseSitemap = async (sitemapUrl) => {
    try {
      const isGz = sitemapUrl.endsWith(".gz");
      const axiosOptions = {
        responseType: isGz ? "arraybuffer" : "text",
      };

      const response = await axios.get(sitemapUrl, axiosOptions);
      let xmlContent = "";

      if (isGz) {
        const buffer = Buffer.from(response.data);
        xmlContent = zlib.gunzipSync(buffer).toString("utf-8");
      } else {
        xmlContent = response.data;
      }

      if (!xmlContent.trim().startsWith("<")) {
        throw new Error("Response is not valid XML");
      }

      const result = await parser.parseStringPromise(xmlContent);
      return result;
    } catch (err) {
      console.warn(`⚠️ Failed to fetch/parse: ${sitemapUrl} — ${err.message}`);
      return null;
    }
  };

  try {
    const rootData = await fetchAndParseSitemap(url);
    if (!rootData) {
      return res.status(500).json({
        success: false,
        message: "Unable to parse the root sitemap.",
      });
    }

    let urls = [];

    // Case 1: Direct sitemap with <urlset>
    if (rootData.urlset && rootData.urlset.url) {
      const directUrls = rootData.urlset.url
        .map((entry) => (entry.loc && entry.loc[0] ? entry.loc[0] : null))
        .filter(Boolean);
      urls.push(...directUrls);
    }

    // Case 2: Sitemap index with <sitemapindex>
    else if (rootData.sitemapindex && rootData.sitemapindex.sitemap) {
      const sitemapUrls = rootData.sitemapindex.sitemap
        .map((entry) => (entry.loc && entry.loc[0] ? entry.loc[0] : null))
        .filter(Boolean);

      for (const smUrl of sitemapUrls) {
        const childData = await fetchAndParseSitemap(smUrl);
        if (childData?.urlset?.url) {
          const childUrls = childData.urlset.url
            .map((entry) => (entry.loc && entry.loc[0] ? entry.loc[0] : null))
            .filter(Boolean);
          urls.push(...childUrls);
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "This sitemap does not contain <urlset> or <sitemapindex>",
      });
    }

    res.json({
      success: true,
      count: urls.length,
      urls,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Unexpected error: ${error.message}`,
    });
  }
});

//Robot.txt route
app.post("/validate-robots", async (req, res) => {
  const {
    url,
    user_agent_token,
    user_agent_string,
    live_test,
    check_resources,
    robots_txt,
  } = req.body;

  try {
    const parsedUrl = new URL(url);
    const origin = parsedUrl.origin;

    let robotsContent = robots_txt;
    if (live_test) {
      try {
        const response = await fetch(`${origin}/robots.txt`);
        if (response.ok) robotsContent = await response.text();
      } catch (e) {
        return res.status(400).json({ error: "Failed to fetch robots.txt" });
      }
    }

    const lines = robotsContent.split("\n");
    const ruleMap = {};
    let currentUA = "";

    lines.forEach((line, i) => {
      const [keyRaw, valueRaw] = line.split(":");
      if (!valueRaw) return;
      const key = keyRaw.trim().toLowerCase();
      const value = valueRaw.trim();

      if (key === "user-agent") {
        currentUA = value.toLowerCase();
        if (!ruleMap[currentUA]) ruleMap[currentUA] = [];
      } else if (key === "disallow" || key === "allow") {
        ruleMap[currentUA]?.push({
          rule: line.trim(),
          key,
          value,
          line: i + 1,
        });
      }
    });

    const applyRules = (targetPath, agent) => {
      const ua = agent.toLowerCase();
      const candidates = ruleMap[ua] || ruleMap["*"] || [];

      let bestMatch = {
        type: "allow",
        rule: "Allow: /",
        line: 0,
        specificity: -1,
      };

      candidates.forEach((r) => {
        if (targetPath.startsWith(r.value)) {
          const spec = r.value.length;
          if (spec > bestMatch.specificity) {
            bestMatch = {
              type: r.key,
              rule: r.rule,
              line: r.line,
              specificity: spec,
            };
          }
        }
      });

      return {
        status: bestMatch.type === "allow" ? "Allowed" : "Blocked",
        applied_rule: { rule: bestMatch.rule, line: bestMatch.line },
      };
    };

    const resources = [
      url,
      `${origin}/css/styles.css`,
      `${origin}/js/main.js`,
      `${origin}/images/logo.png`,
      `${origin}/favicon.ico`,
      `${origin}/robots.txt`,
      `${origin}/sitemap.xml`,
    ];

    const resourceResults = check_resources
      ? resources.map((r) => {
          const path = new URL(r).pathname;
          const crawl = applyRules(path, user_agent_token);
          return {
            url: r,
            method: "GET",
            crawl,
            status_code: 200,
            status_text: "OK",
            type: path.includes(".css")
              ? "Stylesheet"
              : path.includes(".js")
              ? "Script"
              : path.includes(".png") || path.includes(".jpg")
              ? "Image"
              : "Document",
          };
        })
      : [];

    const rootResult = applyRules(parsedUrl.pathname || "/", user_agent_token);

    res.json({
      url: {
        path: parsedUrl.pathname,
        url,
        result: rootResult.status,
        applied_rule: rootResult.applied_rule,
        resources: resourceResults,
      },
      robotstxt: {
        url: live_test ? `${origin}/robots.txt` : "Editor",
        host: parsedUrl.hostname,
        valid: true,
        content: robotsContent,
        error: "",
        errors: [],
        sitemaps: "",
      },
      robotstxt_parsed: {
        user_agents: Object.keys(ruleMap),
        content_fixed: ruleMap,
        errors: [],
        sitemap_urls: [],
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

// Optional health check route
app.get("/", (req, res) => {
  res.send(" LLMs backend is running!");
});

app.listen(PORT, () =>
  console.log(` LLMs API running at http://localhost:${PORT}`)
);
