# PriceRadar v2 — Full-Stack Price Comparison

## Quick Start

### Backend (required for live prices)
```bash
cd backend
pip install flask requests beautifulsoup4 lxml
python server.py
```
Backend runs at **http://localhost:5000**

### Frontend
Open `frontend/index.html` directly in a browser, or serve it:
```bash
cd frontend
python -m http.server 8080
# Then open http://localhost:8080
```

## What was fixed (v2)

| Issue | Fix |
|---|---|
| `flask-cors` not installed → CORS errors | Replaced with inline `@cors` decorator — no extra package needed |
| Backend health check blocked all searches | Removed health gate; search runs directly with fallback |
| Amazon scraper broken (stale selectors) | Rewritten with multiple fallback CSS selectors |
| Flipkart scraper broken (hashed class names) | Rewritten using structural `/p/` link + price regex approach |
| Myntra wrong API endpoint | Corrected to `gateway/v2/search` |
| Meesho deprecated endpoint | Updated with correct payload/headers |
| No retry on network errors | All HTTP calls retry 3× with backoff |
| No caching → slow & rate-limited | In-memory 60s TTL cache per query |
| Frontend timeout too short (2s) | Increased to 8s health, 25s search |
| Missing Snapdeal scraper | Added |
| Demo mode blocked UI | App works fully in demo mode with realistic mock data |

## Architecture
```
frontend/
  index.html          — Main SPA
  css/                — Modular CSS (variables, layout, components, dashboard)
  js/
    api.js            — HTTP layer + mock fallback
    tracker.js        — Search, results, compare, alerts logic  
    ui.js             — DOM rendering, toasts, modals, progress
    chart.js          — Price history chart
    app.js            — Bootstrap

backend/
  server.py           — Flask API with 7 scrapers (Amazon, Flipkart, Myntra, 
                        Meesho, Croma, Nykaa, Snapdeal)
  requirements.txt    — flask, requests, beautifulsoup4, lxml
```

## Notes
- Scrapers use rotating User-Agents and polite timeouts
- Results are cached for 60 seconds to reduce site load
- If a platform blocks scraping, it returns [] gracefully without crashing
- The frontend always works — live data when backend is up, demo data otherwise
