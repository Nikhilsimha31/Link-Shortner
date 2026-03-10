// netlify/functions/auth.js
// POST /.netlify/functions/auth
// Body: { action: "register"|"login", email, password, name? }

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const sql = () => neon(process.env.NETLIFY_DATABASE_URL);
const JWT_SECRET = process.env.JWT_SECRET || "snip-super-secret-key-change-me";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { action, email, password, name } = body;

  if (!email || !password) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Email and password are required" }) };
  }

  const db = sql();

  try {
    if (action === "register") {
      if (!name) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Name is required" }) };
      if (password.length < 6) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Password must be at least 6 characters" }) };

      // Check existing
      const existing = await db`SELECT id FROM users WHERE email = ${email.toLowerCase()} LIMIT 1`;
      if (existing.length > 0) {
        return { statusCode: 409, headers: corsHeaders, body: JSON.stringify({ error: "An account with this email already exists" }) };
      }

      const hash = await bcrypt.hash(password, 10);
      const [user] = await db`
        INSERT INTO users (email, name, password)
        VALUES (${email.toLowerCase()}, ${name}, ${hash})
        RETURNING id, email, name, created_at
      `;

      const token = jwt.sign({ userId: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "30d" });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ token, user: { id: user.id, email: user.email, name: user.name } }),
      };
    }

    if (action === "login") {
      const [user] = await db`SELECT id, email, name, password FROM users WHERE email = ${email.toLowerCase()} LIMIT 1`;
      if (!user) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "No account found with this email" }) };

      const match = await bcrypt.compare(password, user.password);
      if (!match) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "Incorrect password" }) };

      const token = jwt.sign({ userId: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "30d" });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ token, user: { id: user.id, email: user.email, name: user.name } }),
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid action. Use 'login' or 'register'" }) };
  } catch (err) {
    console.error("Auth error:", err);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Server error. Please try again." }) };
  }
};
