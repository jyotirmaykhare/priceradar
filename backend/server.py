"""
PriceRadar Backend v7
- Uses ScraperAPI (5000 free req/month) to bypass IP blocks
- All platforms return REAL live data
- Parallel scraping, 90s cache, fast response
"""

from flask import Flask, jsonify, request, make_response
from functools import wraps
import requests
from bs4 import BeautifulSoup
import re, time, random, hashlib, os
from urllib.parse import quote_plus
from concurrent.futures import ThreadPoolExecutor, as_completed

app = Flask(__name__)

SCRAPER_API_KEY = os.environ.get("SCRAPER_API_KEY", "05d7109e210bc7a8f84d87dd873f117e")

def scraper_url(url):
    """Wrap any URL through ScraperAPI to bypass blocks"""
    return f"https://api.scraperapi.com?api_key={SCRAPER_API_KEY}&url={quote_plus(url)}&country_code=in"

# ── CORS ──────────────────────────────────────────────────────────────────────
def cors(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == "OPTIONS":
            resp = make_response()
            resp.headers["Access-Control-Allow-Origin"]  = "*"
            resp.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
            resp.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
            return resp, 204
        result = f(*args, **kwargs)
        resp = make_response(result[0], result[1]) if isinstance(result, tuple) else make_response(result)
        resp.headers["Access-Control-Allow-Origin"]  = "*"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
        resp.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
        return resp
    return decorated

# ── Cache (90s) ───────────────────────────────────────────────────────────────
_cache = {}

def cache_get(key):
    e = _cache.get(key)
    if e and time.time() - e["ts"] < 90:
        return e["data"]
    return None

def cache_set(key, data):
    _cache[key] = {"ts": time.time(), "data": data}
    if len(_cache) > 100:
        oldest = sorted(_cache.items(), key=lambda x: x[1]["ts"])[:30]
        for k, _ in oldest: del _cache[k]

def ckey(*parts):
    return hashlib.md5("|".join(str(p) for p in parts).encode()).hexdigest()

# ── Helpers ───────────────────────────────────────────────────────────────────
def clean_price(text):
    if not text: return None
    t = re.sub(r'[₹$£€,\s]', '', str(text))
    m = re.search(r'\d+(?:\.\d+)?', t)
    v = int(float(m.group())) if m else None
    return v if v and v > 10 else None

def fetch(url, timeout=25):
    """Fetch via ScraperAPI — bypasses all IP blocks"""
    resp = requests.get(scraper_url(url), timeout=timeout)
    resp.raise_for_status()
    return resp

# ── AMAZON ────────────────────────────────────────────────────────────────────
def scrape_amazon(query):
    results = []
    try:
        url  = f"https://www.amazon.in/s?k={quote_plus(query)}"
        resp = fetch(url)
        soup = BeautifulSoup(resp.text, "lxml")
        for item in soup.select("div[data-component-type='s-search-result']")[:8]:
            try:
                if item.select_one("span.s-label-popover-default"): continue
                name_el  = item.select_one("h2 a span") or item.select_one("h2 span")
                price_el = item.select_one("span.a-price:not(.a-text-price) span.a-offscreen")
                mrp_el   = item.select_one("span.a-price.a-text-price span.a-offscreen")
                link_el  = item.select_one("h2 a[href]")
                img_el   = item.select_one("img.s-image")
                rat_el   = item.select_one("span.a-icon-alt")
                name  = name_el.get_text(strip=True) if name_el else None
                price = clean_price(price_el.get_text() if price_el else None)
                mrp   = clean_price(mrp_el.get_text() if mrp_el else None)
                link  = "https://www.amazon.in" + link_el["href"] if link_el else None
                img   = img_el.get("src") if img_el else None
                rat_m = re.match(r"([\d.]+)", rat_el.get_text(strip=True)) if rat_el else None
                if name and price and price > 0:
                    results.append({
                        "platform":"Amazon","name":name,"price":price,"mrp":mrp,
                        "discount":round((1-price/mrp)*100) if mrp and mrp>price else None,
                        "rating":rat_m.group(1) if rat_m else None,"url":link,"img":img,
                    })
            except: continue
        print(f"  [Amazon] {len(results)} live results")
    except Exception as e:
        print(f"  [Amazon] ERROR: {e}")
    return results

# ── FLIPKART ──────────────────────────────────────────────────────────────────
def scrape_flipkart(query):
    results = []
    try:
        url  = f"https://www.flipkart.com/search?q={quote_plus(query)}&otracker=search"
        resp = fetch(url)
        soup = BeautifulSoup(resp.text, "lxml")
        seen = set()
        for link_el in soup.select("a[href*='/p/']")[:25]:
            try:
                href = link_el.get("href","")
                if not href or href in seen: continue
                seen.add(href)
                name = link_el.get_text(strip=True)
                if not name or len(name) < 5:
                    img_t = link_el.find("img")
                    name  = img_t.get("alt","") if img_t else ""
                if not name or len(name) < 5: continue
                container = link_el
                for _ in range(6):
                    p = container.find_parent("div")
                    if not p: break
                    container = p
                    if len(container.select("a[href*='/p/']")) == 1: break
                full_text = container.get_text(" ", strip=True)
                prices = [clean_price(p) for p in re.findall(r'₹[\d,]+', full_text)]
                prices = [n for n in prices if n and 50 < n < 10000000]
                if not prices: continue
                price    = min(prices)
                mrp      = max(prices) if len(prices) > 1 and max(prices) != price else None
                full_url = "https://www.flipkart.com" + href if href.startswith("/") else href
                img_el   = link_el.find("img")
                rat_m    = re.search(r'\b([3-5]\.\d)\b', full_text)
                results.append({
                    "platform":"Flipkart","name":name,"price":price,"mrp":mrp,
                    "discount":round((1-price/mrp)*100) if mrp and mrp>price else None,
                    "rating":rat_m.group(1) if rat_m else None,
                    "url":full_url,"img":img_el.get("src") if img_el else None,
                })
                if len(results) >= 8: break
            except: continue
        print(f"  [Flipkart] {len(results)} live results")
    except Exception as e:
        print(f"  [Flipkart] ERROR: {e}")
    return results

# ── MYNTRA ────────────────────────────────────────────────────────────────────
def scrape_myntra(query):
    results = []
    try:
        url  = f"https://www.myntra.com/{quote_plus(query)}?rawQuery={quote_plus(query)}"
        resp = fetch(url)
        soup = BeautifulSoup(resp.text, "lxml")
        for item in soup.select("li.product-base")[:8]:
            try:
                name_el  = item.select_one("h3.product-brand") 
                desc_el  = item.select_one("h4.product-product")
                price_el = item.select_one("span.product-discountedPrice") or item.select_one("div.product-price span")
                mrp_el   = item.select_one("span.product-strike")
                link_el  = item.select_one("a[href]")
                img_el   = item.select_one("img.img-responsive") or item.select_one("picture img")
                name  = f"{name_el.get_text(strip=True) if name_el else ''} {desc_el.get_text(strip=True) if desc_el else ''}".strip()
                price = clean_price(price_el.get_text() if price_el else None)
                mrp   = clean_price(mrp_el.get_text() if mrp_el else None)
                href  = link_el["href"] if link_el else ""
                url_p = f"https://www.myntra.com/{href}" if not href.startswith("http") else href
                img   = img_el.get("src","") if img_el else None
                if name and price and price > 0:
                    results.append({
                        "platform":"Myntra","name":name,"price":price,"mrp":mrp,
                        "discount":round((1-price/mrp)*100) if mrp and mrp>price else None,
                        "rating":None,"url":url_p,"img":img,
                    })
            except: continue
        print(f"  [Myntra] {len(results)} live results")
    except Exception as e:
        print(f"  [Myntra] ERROR: {e}")
    return results

# ── MEESHO ────────────────────────────────────────────────────────────────────
def scrape_meesho(query):
    results = []
    try:
        url  = f"https://www.meesho.com/search?q={quote_plus(query)}"
        resp = fetch(url)
        soup = BeautifulSoup(resp.text, "lxml")
        for item in soup.select("div[class*='ProductCard'], div[class*='product-card']")[:8]:
            try:
                name_el  = item.select_one("p[class*='name'], span[class*='name'], h5")
                price_el = item.select_one("h5[class*='price'], span[class*='price'], p[class*='price']")
                link_el  = item.select_one("a[href]")
                img_el   = item.select_one("img")
                name  = name_el.get_text(strip=True) if name_el else None
                price = clean_price(price_el.get_text() if price_el else None)
                href  = link_el["href"] if link_el else ""
                url_p = f"https://www.meesho.com{href}" if href.startswith("/") else href
                img   = img_el.get("src","") if img_el else None
                if name and price and price > 0:
                    results.append({
                        "platform":"Meesho","name":name,"price":price,"mrp":None,
                        "discount":None,"rating":None,"url":url_p,"img":img,
                    })
            except: continue
        print(f"  [Meesho] {len(results)} live results")
    except Exception as e:
        print(f"  [Meesho] ERROR: {e}")
    return results

# ── CROMA ─────────────────────────────────────────────────────────────────────
def scrape_croma(query):
    results = []
    try:
        url  = f"https://www.croma.com/searchB?q={quote_plus(query)}%3Arelevance&text={quote_plus(query)}"
        resp = fetch(url)
        soup = BeautifulSoup(resp.text, "lxml")
        for item in soup.select("li.product-item, div[class*='product-item']")[:8]:
            try:
                name_el  = item.select_one("h3.product-title, a.product-title, [class*='title']")
                price_el = item.select_one("span.amount, [class*='price'] span, span[class*='discount-price']")
                mrp_el   = item.select_one("span.pdpScratchPrice, [class*='old-price'], s")
                link_el  = item.select_one("a[href]")
                img_el   = item.select_one("img")
                name  = name_el.get_text(strip=True) if name_el else None
                price = clean_price(price_el.get_text() if price_el else None)
                mrp   = clean_price(mrp_el.get_text() if mrp_el else None)
                href  = link_el["href"] if link_el else ""
                url_p = f"https://www.croma.com{href}" if href.startswith("/") else href
                img   = img_el.get("src","") if img_el else None
                if name and price and price > 0:
                    results.append({
                        "platform":"Croma","name":name,"price":price,"mrp":mrp,
                        "discount":round((1-price/mrp)*100) if mrp and mrp>price else None,
                        "rating":None,"url":url_p,"img":img,
                    })
            except: continue
        print(f"  [Croma] {len(results)} live results")
    except Exception as e:
        print(f"  [Croma] ERROR: {e}")
    return results

# ── NYKAA ─────────────────────────────────────────────────────────────────────
def scrape_nykaa(query):
    results = []
    try:
        url  = f"https://www.nykaa.com/search/result/?q={quote_plus(query)}&root=search"
        resp = fetch(url)
        soup = BeautifulSoup(resp.text, "lxml")
        for item in soup.select("div[class*='product-list'] div[class*='product'], div.product-container")[:8]:
            try:
                name_el  = item.select_one("[class*='product-name'], [class*='productName'], h3")
                price_el = item.select_one("[class*='price-offer'], [class*='offer-price'], [class*='discounted']")
                mrp_el   = item.select_one("[class*='price-mrp'], [class*='mrp'], s")
                link_el  = item.select_one("a[href]")
                img_el   = item.select_one("img")
                name  = name_el.get_text(strip=True) if name_el else None
                price = clean_price(price_el.get_text() if price_el else None)
                mrp   = clean_price(mrp_el.get_text() if mrp_el else None)
                href  = link_el["href"] if link_el else ""
                url_p = f"https://www.nykaa.com{href}" if href.startswith("/") else href
                img   = img_el.get("src","") if img_el else None
                if name and price and price > 0:
                    results.append({
                        "platform":"Nykaa","name":name,"price":price,"mrp":mrp,
                        "discount":round((1-price/mrp)*100) if mrp and mrp>price else None,
                        "rating":None,"url":url_p,"img":img,
                    })
            except: continue
        print(f"  [Nykaa] {len(results)} live results")
    except Exception as e:
        print(f"  [Nykaa] ERROR: {e}")
    return results

# ── SNAPDEAL ──────────────────────────────────────────────────────────────────
def scrape_snapdeal(query):
    results = []
    try:
        url  = f"https://www.snapdeal.com/search?keyword={quote_plus(query)}&santizedKeyword={quote_plus(query)}"
        resp = fetch(url)
        soup = BeautifulSoup(resp.text, "lxml")
        for item in soup.select("div.product-tuple-listing, div[class*='product-tuple']")[:8]:
            try:
                name_el  = item.select_one("p.product-title, [class*='product-title']")
                price_el = item.select_one("span.lfloat.product-price, [class*='product-price']")
                mrp_el   = item.select_one("span.product-desc-price, s")
                link_el  = item.select_one("a[href]")
                img_el   = item.select_one("img[src*='http']") or item.select_one("img")
                name  = name_el.get_text(strip=True) if name_el else None
                price = clean_price(price_el.get_text() if price_el else None)
                mrp   = clean_price(mrp_el.get_text() if mrp_el else None)
                href  = link_el["href"] if link_el else ""
                url_p = href if href.startswith("http") else f"https://www.snapdeal.com{href}"
                img   = img_el.get("src","") if img_el else None
                if name and price and price > 0:
                    results.append({
                        "platform":"Snapdeal","name":name,"price":price,"mrp":mrp,
                        "discount":round((1-price/mrp)*100) if mrp and mrp>price else None,
                        "rating":None,"url":url_p,"img":img,
                    })
            except: continue
        print(f"  [Snapdeal] {len(results)} live results")
    except Exception as e:
        print(f"  [Snapdeal] ERROR: {e}")
    return results

# ── PLATFORM MAP ──────────────────────────────────────────────────────────────
SCRAPERS = {
    "amazon":   scrape_amazon,
    "flipkart": scrape_flipkart,
    "myntra":   scrape_myntra,
    "meesho":   scrape_meesho,
    "croma":    scrape_croma,
    "nykaa":    scrape_nykaa,
    "snapdeal": scrape_snapdeal,
}
ALL_PLATFORMS = list(SCRAPERS.keys())

# ── ROUTES ────────────────────────────────────────────────────────────────────
@app.route("/api/search", methods=["GET","OPTIONS"])
@cors
def search():
    query     = request.args.get("q","").strip()
    req_plats = [p.strip() for p in request.args.get("platforms","").split(",") if p.strip() in SCRAPERS]
    platforms = req_plats if req_plats else ALL_PLATFORMS
    if not query: return jsonify({"error":"query required"}), 400

    ck = ckey(query, ",".join(sorted(platforms)))
    cached = cache_get(ck)
    if cached:
        print(f"[CACHE HIT] {query}")
        return jsonify(cached)

    print(f"\n[Search] '{query}' → {platforms}")
    t0      = time.time()
    results = {p: [] for p in platforms}

    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(SCRAPERS[p], query): p for p in platforms}
        for f in as_completed(futures, timeout=30):
            plat = futures[f]
            try:
                results[plat] = f.result() or []
                print(f"  [{plat}] {len(results[plat])} items")
            except Exception as e:
                results[plat] = []
                print(f"  [{plat}] FAILED: {e}")

    all_products = []
    for items in results.values():
        all_products.extend(items)
    all_products.sort(key=lambda x: x.get("price") or 99999)

    elapsed = round(time.time()-t0, 2)
    print(f"[Done] {len(all_products)} products in {elapsed}s")

    payload = {"query":query,"total":len(all_products),"elapsed":elapsed,
               "by_platform":results,"all":all_products}
    if all_products: cache_set(ck, payload)
    return jsonify(payload)


@app.route("/api/compare", methods=["GET","OPTIONS"])
@cors
def compare():
    query = request.args.get("q","").strip()
    if not query: return jsonify({"error":"query required"}), 400
    ck = ckey("cmp", query)
    cached = cache_get(ck)
    if cached: return jsonify(cached)
    results = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(fn, query): name for name,fn in SCRAPERS.items()}
        for f in as_completed(futures, timeout=30):
            try:
                items = f.result()
                if items: results.append(items[0])
            except: pass
    results.sort(key=lambda x: x.get("price") or 99999)
    payload = {"query":query,"results":results,"best":results[0] if results else None}
    if results: cache_set(ck, payload)
    return jsonify(payload)


@app.route("/api/health", methods=["GET","OPTIONS"])
@cors
def health():
    return jsonify({"status":"ok","version":"7.0","platforms":ALL_PLATFORMS})

@app.route("/api/ping", methods=["GET","OPTIONS"])
@cors
def ping():
    return jsonify({"pong":True,"ts":time.time()})

@app.route("/api/platforms", methods=["GET","OPTIONS"])
@cors
def platforms_route():
    return jsonify({"platforms":ALL_PLATFORMS})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"\n◈ PriceRadar v7 — ScraperAPI — port {port}\n")
    app.run(debug=False, port=port, threaded=True, host="0.0.0.0")
