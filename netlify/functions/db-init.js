// netlify/functions/db-init.js
// Call this once to set up your Neon database tables.
// GET /.netlify/functions/db-init  (protected by INIT_SECRET env var)

import { neon } from "@neondatabase/serverless";

export const handler = async (event) => {
  // Simple protection — only allow if secret matches
  const secret = event.queryStringParameters?.secret;
  if (secret !== process.env.INIT_SECRET) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const sql = neon(process.env.NETLIFY_DATABASE_URL);

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        email       TEXT UNIQUE NOT NULL,
        name        TEXT NOT NULL,
        password    TEXT NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS links (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
        code          TEXT UNIQUE NOT NULL,
        original_url  TEXT NOT NULL,
        domain        TEXT,
        favicon_url   TEXT,
        custom_alias  BOOLEAN DEFAULT false,
        clicks        INTEGER DEFAULT 0,
        click_limit   INTEGER,
        enabled       BOOLEAN DEFAULT true,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        last_accessed TIMESTAMPTZ
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS click_events (
        id         SERIAL PRIMARY KEY,
        link_id    INTEGER REFERENCES links(id) ON DELETE CASCADE,
        clicked_at TIMESTAMPTZ DEFAULT NOW(),
        referrer   TEXT,
        user_agent TEXT
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_links_code ON links(code)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_links_user ON links(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_clicks_link ON click_events(link_id)`;

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Database tables created successfully!" }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
