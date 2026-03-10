// netlify/functions/redirect.js
// Handles /r/:code → looks up link in DB, increments clicks, redirects

import { neon } from "@neondatabase/serverless";

export const handler = async (event) => {
  // Extract code from path: /.netlify/functions/redirect/CODE
  // or from query param as fallback
  const pathParts = event.path?.split("/") || [];
  const code = pathParts[pathParts.length - 1] || event.queryStringParameters?.code;

  if (!code) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/html" },
      body: errorPage("Missing Code", "No short code provided in the URL."),
    };
  }

  const db = neon(process.env.NETLIFY_DATABASE_URL);

  try {
    const [link] = await db`
      SELECT id, original_url, enabled, clicks, click_limit
      FROM links
      WHERE code = ${code}
      LIMIT 1
    `;

    const baseUrl = process.env.SITE_URL || `https://${event.headers?.host}`;

    if (!link) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "text/html" },
        body: errorPage(
          "Link Not Found",
          `The short link <b style="color:#eeeef5">snip/${code}</b> does not exist or has been deleted.`,
          baseUrl
        ),
      };
    }

    if (!link.enabled) {
      return {
        statusCode: 410,
        headers: { "Content-Type": "text/html" },
        body: errorPage(
          "Link Disabled",
          `<b style="color:#fbbf24">snip/${code}</b> has been disabled by its owner and is not accepting visitors.`,
          baseUrl
        ),
      };
    }

    if (link.click_limit !== null && link.clicks >= link.click_limit) {
      return {
        statusCode: 410,
        headers: { "Content-Type": "text/html" },
        body: errorPage(
          "Click Limit Reached",
          `<b style="color:#ff2d6b">snip/${code}</b> has reached its maximum of <b style="color:#eeeef5">${link.click_limit}</b> clicks.`,
          baseUrl
        ),
      };
    }

    // Record click (non-blocking — don't await to keep redirect fast)
    const referrer = event.headers?.referer || null;
    const userAgent = event.headers?.["user-agent"] || null;

    db`
      UPDATE links SET clicks = clicks + 1, last_accessed = NOW() WHERE id = ${link.id}
    `.catch(console.error);

    db`
      INSERT INTO click_events (link_id, referrer, user_agent)
      VALUES (${link.id}, ${referrer}, ${userAgent})
    `.catch(console.error);

    // Instant redirect
    return {
      statusCode: 302,
      headers: {
        Location: link.original_url,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
      body: "",
    };
  } catch (err) {
    console.error("Redirect error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/html" },
      body: errorPage("Server Error", "Something went wrong. Please try again."),
    };
  }
};

function errorPage(title, message, baseUrl = "/") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SNIP — ${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#08080e;color:#eeeef5;font-family:'Space Mono',monospace;min-height:100vh;display:flex;align-items:center;justify-content:center}
  body::before{content:'';position:fixed;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,.04) 1px,transparent 1px);background-size:28px 28px;pointer-events:none}
  .card{text-align:center;max-width:480px;padding:48px 32px;position:relative}
  .icon{font-size:56px;margin-bottom:20px}
  .brand{font-family:'Syne',sans-serif;font-size:14px;font-weight:800;letter-spacing:.2em;color:#9999b3;margin-bottom:32px}
  .brand em{color:#00e87a;font-style:normal}
  h1{font-family:'Syne',sans-serif;font-size:24px;font-weight:800;color:#ff2d6b;margin-bottom:12px}
  p{font-size:11px;color:#9999b3;line-height:1.8;margin-bottom:32px}
  a{display:inline-block;color:#08080e;background:#8b7fff;padding:11px 24px;border-radius:3px;font-family:'Syne',sans-serif;font-weight:800;font-size:12px;letter-spacing:.1em;text-decoration:none;transition:opacity .15s}
  a:hover{opacity:.85}
</style>
</head>
<body>
  <div class="card">
    <div class="brand">SN<em>I</em>P</div>
    <div class="icon">🚫</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="${baseUrl}">← Back to SNIP</a>
  </div>
</body>
</html>`;
}
