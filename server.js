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

const BRAND_LOGO_SRC =
  "data:image/png;base64,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PGDAAHT27NmFzz333KbY2FhTcXExLb9XYoyxNm3aLP7222/7zJ49+wPGWFKTJk3mIYSU8i4TxhhIkgTvvvvuVoRQZnBZqampmip21XLZs2dPg+oC2sQ53/XII4/8UlRUNIZzPhch5AqKGLo+Y1WpFhcX9/OaNWs2VeRfTE9P58Hv2bJly7qTJk3aN3z48KUZGRkTV61a1TckJCR72rRpYzZv3owGDx78OyGh1VOvXr3vV65cuaki/26XLl3Kv69mkAHO+dODBg3CFy9enDtq1KjGnHNW2XSkNxhTQimlkZGRv7hcrt7vvffenQ6HI81isUgGgyHz119/vfOuu+6KPnv27NdZWVl+7YdGo5E+/PDD4SaT6WifPn2edrlc8V999dU2t9td59FHH5UBAEaPHo3fffddGh8f/+2lS5funjRpUs+lS5du69mzpyE8PFwBAFi/fr1w5swZf05OzhMAIMbHx+/UNIhz585d8Pv9EAgEZADgJpNJYyotLi5mjDEuiuJVMptMJso5j6hfv/6Ohx56aLogCMLQoUMvR0VFFa1Zs6by2fAQIGCMKThcEJqZGu19LXLc/Q8m3p3xB4Ul1hi0jPlNmjRRzGazsG3btkUdOnRYfu7cuQE+n68JIcRdwZ4Sz5s379uQkJDDJ06ceEgQBNfgwYPf0VToiurxeDzXm2BACAHOecTOnTv92qSWJMllMpnkqiTCLh8ocK2E6xX5NEVRVAAAv//++y9GRUUdBIDIbt26PffQQw8VGY1GDtc40KHdYnAty/213k/z/27cuHFwWFjYlhMnToyklIIgCDc9fywWCzDG4K677lqlKAps2bJl5eHDh+va7fbAunXr3D/99NOR1NTUvQaDAVWgrRJFUZyTJ09Onz179p5mzZr93e12txs6dOg8hBArKipCnHN47LHHVgqC4Dt+/PiKbdu2tdu5c6ffbrdTu91Oz5w543///ffvO3Xq1OuCIGRPmDBhnSZVGzdunKEoCj937lxPk8kEO3fu9O/cudMviiJ3uVzPKoqCOnbseCaItBxjTBhjhVOnTj0xceLEX6KioopU+wUSKktYyqkihEtC5/A232zv+d4AhJDbkppK7Lc5LPEaewJGy80qxhinlNI6deqEBElR2qVLF2HlypWTXnjhhdAff/xxuNvtphW4MDBCSB41atRKp9O5MjIycmufPn0u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";

function renderLoginPage({ error } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Sign in — Hoy Billing Tool</title>
<style>
  :root{--ink:#17271d;--muted:#5c6b62;--faint:#8a988f;--paper:#f4f6f3;--card:#fff;--line:#e2e8e3;
  --green:#2da84e;--green-d:#1f7a38;--green-wash:#eef6f0;--red:#c0392b;--red-wash:#fbeae8;}
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: var(--paper);
    color: var(--ink);
  }
  .card {
    width: 100%;
    max-width: 420px;
    margin: 1rem;
    background: var(--card);
    border-radius: 16px;
    border-top: 5px solid var(--green);
    box-shadow: 0 1px 2px rgba(20,40,30,.05), 0 10px 30px rgba(20,40,30,.08);
    padding: 32px 34px 34px;
  }
  .brand { height: 40px; width: auto; display: block; margin-bottom: 14px; }
  .tagline {
    font-size: 12px;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
    margin: 0 0 26px;
  }
  label {
    display: block;
    font-size: 13px;
    font-weight: 700;
    color: var(--ink);
    margin-bottom: 8px;
  }
  input[type="password"] {
    width: 100%;
    padding: 11px 13px;
    font-size: 15px;
    font-family: inherit;
    color: var(--ink);
    background: #fff;
    border: 1.5px solid var(--green);
    border-radius: 9px;
    margin-bottom: 18px;
  }
  input[type="password"]:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(45,168,78,.15);
  }
  button {
    width: 100%;
    padding: 12px;
    font-size: 15px;
    font-weight: 700;
    color: #fff;
    background: var(--green-d);
    border: 1px solid var(--green-d);
    border-radius: 9px;
    cursor: pointer;
  }
  button:hover { background: #17602c; }
  .error {
    margin: 0 0 16px;
    padding: 9px 12px;
    font-size: 13px;
    color: var(--red);
    background: var(--red-wash);
    border-radius: 8px;
  }
</style>
</head>
<body>
  <main class="card">
    <img class="brand" src="${BRAND_LOGO_SRC}" alt="Triangle Investment Group" />
    <p class="tagline">INVESTMENT GROUP · HOY BILLING TOOL</p>
    ${error ? `<p class="error">${error}</p>` : ""}
    <form method="POST" action="/login">
      <label for="passcode">Passcode</label>
      <input id="passcode" type="password" name="passcode" autofocus required autocomplete="current-password" />
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
