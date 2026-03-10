SNIP — Link Shortener 🔗
A real, full-stack link shortener built with Netlify Functions and Neon Postgres.
🌐 Live Demo: https://link-shortner-hack.netlify.app

What is SNIP?
SNIP lets you turn any long URL into a short, shareable link. Short links actually work when pasted in a browser — they instantly redirect to the destination.
Example:
https://link-shortner-hack.netlify.app/r/abc123
→ redirects to your original URL

Features

🔐 User Auth — Register and login with email & password (bcrypt + JWT)
✂️ Real Short Links — Links work when pasted anywhere in a browser
🏷️ Custom Aliases — Choose your own short code (e.g. /r/my-link)
📊 Click Analytics — Track how many times each link is clicked
⏱️ Click Limits — Set a max number of clicks before a link expires
⏸️ Enable / Disable — Turn links on or off anytime
✏️ Edit Destination — Change where a link points without changing the code
📷 QR Codes — Generate and download a QR code for any link
📥 CSV Export — Export all your links and stats
☁️ Cloud Storage — Data stored in Neon Postgres, accessible from any device


Tech Stack
LayerTechnologyFrontendHTML, CSS, JavaScriptBackendNetlify Functions (serverless)DatabaseNeon PostgresAuthbcrypt + JWT tokensHostingNetlify

How to Use

Go to https://link-shortner-hack.netlify.app
Register a free account
Paste any long URL and click Shorten
Copy your short link and paste it anywhere
Track clicks from your dashboard


Project Structure
├── netlify.toml                    # Routing config
├── package.json                    # Dependencies
├── public/
│   └── index.html                  # Frontend app
└── netlify/
    └── functions/
        ├── auth.js                 # Register / Login
        ├── links.js                # Create / Edit / Delete links
        ├── redirect.js             # Handles short link redirects
        └── db-init.js              # Database setup (run once)

Local Development
bash# Install Netlify CLI
npm install -g netlify-cli

# Clone the repo
git clone https://github.com/Nikhilsimha31/Link-Shortner.git
cd Link-Shortner

# Link to your Netlify site
netlify login
netlify link

# Start local dev server
netlify dev

Environment Variables
VariableDescriptionNETLIFY_DATABASE_URLNeon Postgres connection string (auto-set by Neon extension)JWT_SECRETSecret key for signing JWT tokensINIT_SECRETPassword to protect the DB init endpointSITE_URLYour Netlify site URL

Database Setup (First Time)
After deploying, visit this URL once to create the database tables:
https://link-shortner-hack.netlify.app/.netlify/functions/db-init?secret=YOUR_INIT_SECRET

Made by
Nikhil Simha — https://github.com/Nikhilsimha31
