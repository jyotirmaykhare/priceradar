[README (1).md](https://github.com/user-attachments/files/25622319/README.1.md)
<div align="center">

# 🛒 SmartPrice AI — PriceRadar

**Track prices. Predict drops. Always buy at the right time.**

[![Python](https://img.shields.io/badge/Python-3.x-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-2.x-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Railway](https://img.shields.io/badge/Backend-Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)](https://railway.app)
[![Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

SmartPrice AI is a full-stack price comparison web app that tracks product prices across Amazon, Flipkart, and more — analyzes yearly price trends, compares discounts, predicts future price drops using AI, and redirects you straight to the best deal.

[Features](#-features) · [Tech Stack](#-tech-stack) · [Project Structure](#-project-structure) · [Quick Start](#-quick-start) · [Deployment](#-deployment) · [How It Works](#-how-it-works)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔍 **Multi-platform Search** | Live scraping from Amazon, Flipkart, Myntra, Meesho, Croma, Nykaa, Snapdeal via ScraperAPI |
| 📈 **Yearly Price Trend Analysis** | Visualizes 12-month historical price data per product |
| 🤖 **AI Price Drop Prediction** | Predicts likelihood and timing of future price drops |
| 💰 **Discount Comparison** | Compares MRP vs. current price across all platforms side-by-side |
| 🏆 **Best Deal Recommendation** | Highlights the best value-for-money listing automatically |
| 🔗 **Direct Redirect** | One click takes you to the lowest-price product page |
| 🔔 **Price Alerts** | Set a target price; get notified when a product hits it |
| 🌐 **Offline Fallback** | `api.js` serves realistic mock data automatically if the backend is unreachable |

---

## 🛠 Tech Stack

### Frontend
| Technology | Role |
|---|---|
| HTML5 / CSS3 / Vanilla JavaScript (ES6+) | Core SPA — no framework, no bundler |
| CSS Custom Properties (`variables.css`) | Design tokens — colors, spacing, typography |
| CSS Reset (`reset.css`) | Cross-browser baseline normalization |
| CSS Grid & Flexbox (`layout.css`) | Responsive page structure and breakpoints |
| Component CSS (`components.css`) | Cards, buttons, modals, badges, toasts |
| Dashboard CSS (`dashboard.css`) | Dashboard panel and widget styles |
| Canvas API (`chart.js`) | Price history line chart — no external chart library |
| Fetch API (`api.js`) | HTTP client with timeout, 3× retry, and automatic mock fallback if backend is down |
| localStorage | Persistent price alerts and compare list across sessions |

### Backend
| Technology | Role |
|---|---|
| Python 3.x (`runtime.txt`) | Runtime |
| Flask (`server.py`) | REST API server — search endpoint + scraper orchestration |
| ScraperAPI | Proxy service for reliable, unblocked scraping across all platforms |
| BeautifulSoup4 + lxml | HTML parsing for 7 platform scrapers |
| Requests | HTTP client with rotating User-Agents and retry logic |
| In-memory Cache | 60-second TTL per query to reduce API calls and rate limits |
| Gunicorn (`Procfile`) | WSGI production server for Railway deployment |

### Infrastructure & Deployment
| Service | Role |
|---|---|
| [Railway](https://railway.app) | Backend hosting (`backend/railway.json` + `Procfile`) |
| [Vercel](https://vercel.com) | Frontend hosting (`frontend/vercel.json`) |

---

## 📁 Project Structure

```
priceradar/
│
├── backend/
│   ├── server.py              # Flask REST API — search route + 7 platform scrapers
│   ├── requirements.txt       # Python dependencies (flask, requests, bs4, lxml, gunicorn)
│   ├── runtime.txt            # Python version pin for Railway
│   ├── Procfile               # Gunicorn start command for Railway
│   └── railway.json           # Railway deployment configuration
│
└── frontend/
    ├── index.html             # Single-page app entry point
    ├── vercel.json            # Vercel routing + deployment config
    ├── css/
    │   ├── variables.css      # Design tokens (colors, spacing, fonts)
    │   ├── reset.css          # Cross-browser CSS reset
    │   ├── layout.css         # Page grid, structure, responsive breakpoints
    │   ├── components.css     # UI components — cards, buttons, modals, badges
    │   └── dashboard.css      # Dashboard panel styles
    └── js/
        ├── app.js             # Bootstrap — wires all modules on DOMContentLoaded
        ├── api.js             # HTTP layer — fetch wrapper, timeouts, mock fallback
        ├── tracker.js         # Core logic — search, compare, alerts, best deal
        ├── ui.js              # DOM rendering — results, toasts, modals, progress bar
        └── chart.js           # Price history chart using Canvas 2D API
```

### Key Files Explained

**`backend/server.py`**
Central Flask application. Each of the 7 platforms has its own scraper function that uses ScraperAPI for reliable proxy-based scraping. Results are normalised to `{name, price, url, image}`, cached per query for 60 seconds, and ranked before being returned. CORS is handled inline — no `flask-cors` package needed.

**`frontend/js/api.js`**
All `fetch()` calls go through here with configurable timeouts (8s health, 25s search). If the backend is unreachable, it transparently falls back to realistic mock data so the UI always works.

**`frontend/js/tracker.js`**
Orchestrates the full search flow — deduplicates results across platforms, powers side-by-side comparison, manages price alert storage in localStorage, and identifies the best deal.

**`frontend/js/chart.js`**
Renders price history as a line chart directly on a `<canvas>` element via the native Canvas 2D API — zero external dependencies.

**`frontend/js/ui.js`**
Pure DOM layer, fully decoupled from business logic. Handles rendering result cards, showing toasts, opening/closing modals, and animating the loading progress bar.

---

## 🚀 Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
python server.py
```
> Runs at **http://localhost:5000**

### Frontend
```bash
cd frontend
python -m http.server 8080
# Open http://localhost:8080
```
> Or open `frontend/index.html` directly — `api.js` automatically serves mock data if the backend is unreachable.

---

## ☁️ Deployment

This project is pre-configured for one-command deployment on both platforms.

### Backend → Railway
```bash
# Connect repo in Railway dashboard, it auto-detects Procfile
# Set environment variables:
SCRAPERAPI_KEY=your_key_here
```
Railway uses `Procfile` to start Gunicorn and `runtime.txt` to pin the Python version.

### Frontend → Vercel
```bash
vercel --prod
# or connect the repo in the Vercel dashboard
```
`vercel.json` handles all routing rules so the SPA works correctly on refresh.

---

## ⚙️ How It Works

```
User searches for a product
        │
        ▼
   api.js (Frontend)
        │
        ├──► GET /search?q=<query>  ──►  Flask (server.py)
        │                                      │
        │                              ScraperAPI proxy
        │                                      │
        │               ┌──────────────────────┼──────────────────────┐
        │               ▼          ▼           ▼          ▼           ▼
        │           Amazon     Flipkart     Myntra     Meesho      Croma ...
        │               └──────────────────────┼──────────────────────┘
        │                                      │
        │                         Normalised + cached results
        │                         [{name, price, url, image}]
        │                                      │
        │                              Ranked by best deal
        │                                      │
        ◄──────────────────────────────────────┘
        │
        ▼
   ui.js renders result cards
   chart.js draws price history
   tracker.js highlights best deal
   → Redirects user to lowest-price URL
```

---

## 🔧 Scraper Design

Every platform scraper follows the same resilient interface:

```python
def scrape_<platform>(query: str) -> list[dict]:
    # Always returns [] on failure — never crashes the server
    # Output: [{"name": str, "price": float, "url": str, "image": str}]
```

Resilience strategies used across all scrapers:
- **ScraperAPI** for proxy rotation and unblocking
- Rotating User-Agent headers on every request
- 3× retry with exponential backoff on network errors
- Multiple CSS selector fallbacks per platform
- Structural scraping (URL patterns + regex) where class names are hashed
- 60-second in-memory cache per query to reduce API usage and rate limits
- Graceful `[]` return on any error — one broken scraper never takes down the API

---

## 📡 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/search?q=<query>` | GET | Search all platforms, returns ranked results |
| `/health` | GET | Backend health check |

**Example — `GET /search?q=iphone+15`**
```json
{
  "results": [
    {
      "platform": "Flipkart",
      "name": "Apple iPhone 15 (128GB) - Black",
      "price": 69999,
      "original_price": 79900,
      "discount": "12%",
      "url": "https://flipkart.com/...",
      "image": "https://..."
    }
  ],
  "best_deal": {
    "platform": "Flipkart",
    "price": 69999
  }
}
```

---

## 🗺 Roadmap

- [ ] AI price drop prediction with seasonal trend analysis
- [ ] Email / SMS price alert notifications
- [ ] Persistent price history with a database (PostgreSQL / SQLite)
- [ ] Browser extension for Chrome / Firefox
- [ ] Product wishlist with bulk price tracking
- [ ] User accounts and cross-device alert sync

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

```bash
git clone https://github.com/jyotirmaykhare/priceradar.git
cd priceradar
pip install -r backend/requirements.txt
# Frontend needs no install — open index.html directly
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

Built with ❤️ by [Jyotirmay Khare](https://github.com/jyotirmaykhare)

⭐ Star this repo if it saved you money!

</div>
