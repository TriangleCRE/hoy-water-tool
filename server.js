// Single Express app that fronts the entire site — static assets, pages, and
// (any future) API routes all pass through the passcode gate below. Deployed
// as one Vercel serverless function (see vercel.json) so there is no
// zero-config static route that could bypass it.

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COOKIE_NAME,
  MAX_AGE_MS,
  checkPasscode,
  makeSessionCookieValue,
  isValidSessionCookie,
} from "./lib/auth.js";
import dataRoutes from "./lib/data-routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");

const app = express();
app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false }));

function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return undefined;
}

function setSessionCookie(res) {
  res.cookie(COOKIE_NAME, makeSessionCookieValue(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: MAX_AGE_MS,
    path: "/",
  });
}

function renderLoginPage({ error } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Sign in — Hoy Center</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #f4f5f7;
  }
  .card {
    width: 100%;
    max-width: 320px;
    padding: 2rem;
    margin: 1rem;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
  }
  h1 {
    margin: 0 0 1.25rem;
    font-size: 1.15rem;
    font-weight: 600;
    color: #1a1a1a;
    text-align: center;
  }
  input[type="password"] {
    width: 100%;
    padding: 0.65rem 0.75rem;
    font-size: 1rem;
    border: 1px solid #ccc;
    border-radius: 8px;
    margin-bottom: 0.85rem;
  }
  button {
    width: 100%;
    padding: 0.65rem 0.75rem;
    font-size: 1rem;
    font-weight: 600;
    color: #fff;
    background: #2563eb;
    border: none;
    border-radius: 8px;
    cursor: pointer;
  }
  button:hover { background: #1d4ed8; }
  .error {
    margin: 0 0 0.85rem;
    padding: 0.6rem 0.75rem;
    font-size: 0.9rem;
    color: #991b1b;
    background: #fee2e2;
    border-radius: 8px;
  }
</style>
</head>
<body>
  <main class="card">
    <h1>Enter passcode to continue</h1>
    ${error ? `<p class="error">${error}</p>` : ""}
    <form method="POST" action="/login">
      <input type="password" name="passcode" placeholder="Passcode" autofocus required autocomplete="current-password" />
      <button type="submit">Enter</button>
    </form>
  </main>
</body>
</html>`;
}

// ---- Public routes (must stay reachable without a session) ----------------

app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send("User-agent: *\nDisallow: /\n");
});

app.get("/login", (req, res) => {
  res.type("html").send(renderLoginPage());
});

app.post("/login", (req, res) => {
  const passcode = req.body && req.body.passcode;
  if (checkPasscode(passcode)) {
    setSessionCookie(res);
    return res.redirect(302, "/");
  }
  res.status(401).type("html").send(renderLoginPage({ error: "Incorrect passcode. Please try again." }));
});

// ---- Passcode gate — everything below requires a valid session cookie -----

app.use((req, res, next) => {
  const cookieValue = getCookie(req, COOKIE_NAME);
  if (isValidSessionCookie(cookieValue)) {
    setSessionCookie(res); // slide the expiry forward on every authenticated request
    return next();
  }
  if (req.method === "GET" && req.accepts(["html", "json"]) === "html") {
    return res.redirect(302, "/login");
  }
  return res.status(401).type("text").send("Unauthorized");
});

// ---- Protected app (data API + static site) --------------------------------

app.use("/api", dataRoutes);

app.use(express.static(PUBLIC_DIR));

app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Fail closed: surface a plain 500 instead of leaking a stack trace, e.g.
// when PASSCODE is not configured in the environment.
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).type("text").send("Server misconfigured");
});

if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });
}

export default app;
