"use strict";

var _this = this;

var express = require("express");
var bodyParser = require("body-parser");
var puppeteer = require("puppeteer");
var cors = require("cors");

var app = express();
app.use(bodyParser.json());
var PORT = 3000;

app.use(cors());

app.get("/check", function (req, res) {
  res.send("✅ Server is running.");
});

app.post("/generate-llms-txt", function callee$0$0(req, res) {
  var _req$body, url, showFullText, formattedUrl, isProduction, browser, page, title, metaDesc, headings, bodyText, llmstxtRaw, llmsfulltxtRaw, llmstxtFormatted, llmsfulltxtFormatted;

  return regeneratorRuntime.async(function callee$0$0$(context$1$0) {
    while (1) switch (context$1$0.prev = context$1$0.next) {
      case 0:
        _req$body = req.body;
        url = _req$body.url;
        showFullText = _req$body.showFullText;

        if (url) {
          context$1$0.next = 5;
          break;
        }

        return context$1$0.abrupt("return", res.status(400).json({ success: false, message: "URL is required" }));

      case 5:

        // Normalize the URL
        url = url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
        formattedUrl = "https://" + url;
        isProduction = process.env.NODE_ENV === "production";
        context$1$0.prev = 8;
        context$1$0.next = 11;
        return regeneratorRuntime.awrap(puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"]
        }));

      case 11:
        browser = context$1$0.sent;
        context$1$0.next = 14;
        return regeneratorRuntime.awrap(browser.newPage());

      case 14:
        page = context$1$0.sent;
        context$1$0.next = 17;
        return regeneratorRuntime.awrap(page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/115 Safari/537.36"));

      case 17:
        context$1$0.prev = 17;
        context$1$0.next = 20;
        return regeneratorRuntime.awrap(page.goto(formattedUrl, {
          waitUntil: "domcontentloaded",
          timeout: 20000
        }));

      case 20:
        context$1$0.next = 27;
        break;

      case 22:
        context$1$0.prev = 22;
        context$1$0.t0 = context$1$0["catch"](17);
        context$1$0.next = 26;
        return regeneratorRuntime.awrap(browser.close());

      case 26:
        return context$1$0.abrupt("return", res.status(404).json({
          data: {
            success: false,
            message: "Domain not found: " + url
          }
        }));

      case 27:
        context$1$0.next = 29;
        return regeneratorRuntime.awrap(page.title());

      case 29:
        title = context$1$0.sent;
        context$1$0.next = 32;
        return regeneratorRuntime.awrap(page.$eval("meta[name='description']", function (el) {
          return el.content;
        })["catch"](function () {
          return "";
        }));

      case 32:
        metaDesc = context$1$0.sent;
        context$1$0.next = 35;
        return regeneratorRuntime.awrap(page.$$eval("h1, h2", function (els) {
          return els.map(function (el) {
            return el.innerText.trim();
          }).filter(Boolean);
        }));

      case 35:
        headings = context$1$0.sent;
        context$1$0.next = 38;
        return regeneratorRuntime.awrap(page.$eval("body", function (el) {
          return el.innerText;
        })["catch"](function () {
          return "";
        }));

      case 38:
        bodyText = context$1$0.sent;
        context$1$0.next = 41;
        return regeneratorRuntime.awrap(browser.close());

      case 41:
        llmstxtRaw = ["# http://" + url + " llms.txt", "", "- [" + title + "](" + formattedUrl + "): " + (metaDesc || "No description available.")].join("\n");
        llmsfulltxtRaw = "# http://" + url + " llms-full.txt\n\n## " + title + "\n";

        if (metaDesc) llmsfulltxtRaw += metaDesc + "\n\n";
        headings.forEach(function (h) {
          return llmsfulltxtRaw += "### " + h + "\n";
        });
        if (showFullText && bodyText) llmsfulltxtRaw += "\n" + bodyText;

        llmstxtFormatted = llmstxtRaw.replace(/\n/g, "<br>");
        llmsfulltxtFormatted = showFullText ? llmsfulltxtRaw.replace(/\n/g, "<br>") : undefined;

        res.json({
          data: {
            success: true,
            data: {
              llmstxt: llmstxtFormatted,
              llmsfulltxt: llmsfulltxtFormatted
            }
          }
        });
        context$1$0.next = 55;
        break;

      case 51:
        context$1$0.prev = 51;
        context$1$0.t1 = context$1$0["catch"](8);

        console.error(" Error:", context$1$0.t1.message);
        res.status(500).json({
          data: {
            success: false,
            message: "Failed to process website: " + context$1$0.t1.message
          }
        });

      case 55:
      case "end":
        return context$1$0.stop();
    }
  }, null, _this, [[8, 51], [17, 22]]);
});

app.listen(PORT, function () {
  return console.log(" LLMs API running at http://localhost:" + PORT);
});
// executablePath: isProduction ? "/usr/bin/google-chrome" : undefined,