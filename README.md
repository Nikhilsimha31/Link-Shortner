# SNIP v4.0 — Real Link Shortener
### Netlify + Neon Postgres · Full-stack · Auth · Real short URLs

Short links actually work when pasted in a browser:  
`yoursite.netlify.app/r/abc123` → redirects instantly to the destination.

---

## 🚀 Deploy in 5 Steps

### 1. Upload to GitHub
Create a new GitHub repo and push all these files.

```
snip-netlify/
├── netlify.toml
├── package.json
├── public/
│   └── index.html          ← the app UI
└── netlify/
    └── functions/
        ├── auth.js          ← register / login
        ├── links.js         ← CRUD for links
        ├── redirect.js      ← handles /r/:code
        └── db-init.js       ← one-time DB setup
```

### 2. Connect to Netlify
1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import from Git**
2. Select your GitHub repo
3. Build settings are auto-detected from `netlify.toml`
4. Click **Deploy site**

### 3. Add Neon Database
1. In Netlify dashboard → **Extensions** → **Neon** → **Add new database**
2. Click **Create new database** (takes ~30 seconds)
3. This automatically sets the `NETLIFY_DATABASE_URL` environment variable

### 4. Set Environment Variables
In Netlify dashboard → **Site settings** → **Environment variables**, add:

| Variable | Value |
|----------|-------|
| `JWT_SECRET` | Any long random string (e.g. `my-super-secret-jwt-key-2024`) |
| `INIT_SECRET` | Any password to protect the DB init endpoint |
| `SITE_URL` | Your Netlify URL, e.g. `https://your-site.netlify.app` |

### 5. Initialize the Database
After deploy, visit this URL **once** in your browser:

```
https://your-site.netlify.app/.netlify/functions/db-init?secret=YOUR_INIT_SECRET
```

You should see: `{"success":true,"message":"Database tables created successfully!"}`

**That's it! Your link shortener is live. 🎉**

---

## ✅ What Works Now

| Feature | Before (v3) | Now (v4) |
|---------|------------|---------|
| Short link format | `site.com/#abc123` (hash) | `site.com/r/abc123` (real URL) |
| Paste in browser | ❌ Redirects to app, not destination | ✅ Instant redirect |
| Data storage | localStorage (browser only) | Neon Postgres (cloud, all devices) |
| Auth | Fake (passwords in localStorage) | Real (bcrypt + JWT tokens) |
| Multi-device | ❌ Links lost if you clear browser | ✅ Login from any device |
| Click tracking | localStorage | Postgres click_events table |

---

## 🔧 Local Development

Install [Netlify CLI](https://docs.netlify.com/cli/get-started/):
```bash
npm install -g netlify-cli
netlify login
netlify link  # link to your Netlify site
netlify dev   # starts local server on http://localhost:8888
```

This gives you hot reload + real function execution locally.

---

## 📁 File Structure Explained

- **`netlify.toml`** — Routing rules: `/r/:code` → redirect function, `/api/*` → functions
- **`netlify/functions/auth.js`** — Register/login with bcrypt password hashing + JWT
- **`netlify/functions/links.js`** — GET/POST/PUT/DELETE/PATCH for links, JWT-protected
- **`netlify/functions/redirect.js`** — The magic: looks up code in DB, increments click count, HTTP 302 redirects
- **`netlify/functions/db-init.js`** — Creates `users`, `links`, `click_events` tables
- **`public/index.html`** — Full single-page app UI

---

## 🗄 Database Schema

```sql
users (id, email, name, password_hash, created_at)
links (id, user_id, code, original_url, domain, favicon_url, 
       custom_alias, clicks, click_limit, enabled, created_at, last_accessed)
click_events (id, link_id, clicked_at, referrer, user_agent)
```
