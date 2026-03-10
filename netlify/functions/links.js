// netlify/functions/links.js
// GET    /.netlify/functions/links          — list user's links
// POST   /.netlify/functions/links          — create link
// PUT    /.netlify/functions/links?code=XX  — update link
// DELETE /.netlify/functions/links?code=XX  — delete link
// PATCH  /.netlify/functions/links?code=XX&action=toggle|enable|disable

import { neon } from "@neondatabase/serverless";
import jwt from "jsonwebtoken";

const sql = () => neon(process.env.NETLIFY_DATABASE_URL);
const JWT_SECRET = process.env.JWT_SECRET || "snip-super-secret-key-change-me";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

function verifyToken(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) throw new Error("No token provided");
  return jwt.verify(token, JWT_SECRET);
}

function genCode(len = 6) {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/, "");
}

function getDomain(url) {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
}

function getFavicon(url) {
  try { return `https://www.google.com/s2/favicons?sz=32&domain=${new URL(url).hostname}`; } catch { return ""; }
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };

  let user;
  try {
    user = verifyToken(event);
  } catch {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Unauthorized. Please log in." }) };
  }

  const db = sql();
  const { code, action } = event.queryStringParameters || {};

  try {
    // ── GET: list all links for user ──────────────────────────────────────
    if (event.httpMethod === "GET") {
      const rows = await db`
        SELECT
          l.id, l.code, l.original_url, l.domain, l.favicon_url,
          l.custom_alias, l.clicks, l.click_limit, l.enabled,
          l.created_at, l.last_accessed,
          COALESCE(
            json_agg(ce.clicked_at ORDER BY ce.clicked_at) FILTER (WHERE ce.id IS NOT NULL),
            '[]'
          ) AS click_history
        FROM links l
        LEFT JOIN click_events ce ON ce.link_id = l.id
        WHERE l.user_id = ${user.userId}
        GROUP BY l.id
        ORDER BY l.created_at DESC
      `;

      const baseUrl = process.env.SITE_URL || `https://${event.headers?.host}`;
      const links = rows.map(r => ({
        code: r.code,
        original: r.original_url,
        short: `${baseUrl}/r/${r.code}`,
        domain: r.domain,
        favicon: r.favicon_url,
        custom: r.custom_alias,
        clicks: r.clicks,
        clickLimit: r.click_limit,
        enabled: r.enabled,
        created: r.created_at,
        lastAccessed: r.last_accessed,
        clickHistory: r.click_history || [],
      }));

      return { statusCode: 200, headers: cors, body: JSON.stringify({ links }) };
    }

    // ── POST: create new link ─────────────────────────────────────────────
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { originalUrl, alias, clickLimit } = body;

      if (!originalUrl) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "originalUrl is required" }) };

      let linkCode;
      const baseUrl = process.env.SITE_URL || `https://${event.headers?.host}`;

      if (alias) {
        linkCode = slugify(alias);
        // Check uniqueness
        const existing = await db`SELECT id FROM links WHERE code = ${linkCode} LIMIT 1`;
        if (existing.length > 0) {
          return { statusCode: 409, headers: cors, body: JSON.stringify({ error: "This alias is already taken. Choose another." }) };
        }
      } else {
        // Generate unique code
        let attempts = 0;
        do {
          linkCode = genCode();
          const check = await db`SELECT id FROM links WHERE code = ${linkCode} LIMIT 1`;
          if (check.length === 0) break;
          attempts++;
        } while (attempts < 10);
      }

      const domain = getDomain(originalUrl);
      const favicon = getFavicon(originalUrl);
      const limit = clickLimit && parseInt(clickLimit) > 0 ? parseInt(clickLimit) : null;

      const [link] = await db`
        INSERT INTO links (user_id, code, original_url, domain, favicon_url, custom_alias, click_limit)
        VALUES (${user.userId}, ${linkCode}, ${originalUrl}, ${domain}, ${favicon}, ${!!alias}, ${limit})
        RETURNING *
      `;

      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({
          link: {
            code: link.code,
            original: link.original_url,
            short: `${baseUrl}/r/${link.code}`,
            domain: link.domain,
            favicon: link.favicon_url,
            custom: link.custom_alias,
            clicks: link.clicks,
            clickLimit: link.click_limit,
            enabled: link.enabled,
            created: link.created_at,
            lastAccessed: link.last_accessed,
            clickHistory: [],
          },
        }),
      };
    }

    // ── DELETE ────────────────────────────────────────────────────────────
    if (event.httpMethod === "DELETE") {
      if (!code) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "code param required" }) };
      await db`DELETE FROM links WHERE code = ${code} AND user_id = ${user.userId}`;
      return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true }) };
    }

    // ── PATCH: toggle / enable / disable ──────────────────────────────────
    if (event.httpMethod === "PATCH") {
      if (!code) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "code param required" }) };
      const [current] = await db`SELECT enabled FROM links WHERE code = ${code} AND user_id = ${user.userId}`;
      if (!current) return { statusCode: 404, headers: cors, body: JSON.stringify({ error: "Link not found" }) };

      let newEnabled;
      if (action === "enable") newEnabled = true;
      else if (action === "disable") newEnabled = false;
      else newEnabled = !current.enabled; // toggle

      await db`UPDATE links SET enabled = ${newEnabled} WHERE code = ${code} AND user_id = ${user.userId}`;
      return { statusCode: 200, headers: cors, body: JSON.stringify({ enabled: newEnabled }) };
    }

    // ── PUT: edit destination URL ─────────────────────────────────────────
    if (event.httpMethod === "PUT") {
      if (!code) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "code param required" }) };
      const body = JSON.parse(event.body || "{}");
      const { originalUrl } = body;
      if (!originalUrl) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "originalUrl required" }) };

      const domain = getDomain(originalUrl);
      const favicon = getFavicon(originalUrl);

      await db`
        UPDATE links
        SET original_url = ${originalUrl}, domain = ${domain}, favicon_url = ${favicon}
        WHERE code = ${code} AND user_id = ${user.userId}
      `;
      return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    console.error("Links error:", err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Server error: " + err.message }) };
  }
};
