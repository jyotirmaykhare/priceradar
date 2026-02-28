/* tracker.js — Core search, display and alert logic */

const Tracker = {

  _allResults: [],
  _currentQuery: "",
  _currentProduct: null,
  _alerts: JSON.parse(localStorage.getItem("pr_alerts") || "[]"),
  _chartInstance: null,

  /* ── Search ─────────────────────────────── */
  async runSearch() {
    const q = document.getElementById("searchInput").value.trim();
    if (!q) { document.getElementById("searchInput").focus(); return; }

    this._currentQuery = q;
    const platforms    = UI.getActivePlatforms();

    UI.showProgress(platforms);
    document.getElementById("results-section").style.display = "none";
    document.getElementById("compare-section").style.display = "none";

    try {
      const data = await API.search(q, platforms);
      UI.hideProgress();

      this._allResults = data.all || [];

      if (!this._allResults.length) {
        UI.showNoResults(q);
        return;
      }

      // Show subtle demo-mode notice if backend is unavailable
      if (API.isDemo()) {
        UI.showDemoNotice();
      } else {
        UI.hideDemoNotice();
      }

      this.renderResults(data);
      document.getElementById("results-section").style.display = "block";
      document.getElementById("results-section").scrollIntoView({ behavior: "smooth", block: "start" });

    } catch (err) {
      UI.hideProgress();
      UI.toast("Search failed. Please try again.", "✕", 4000);
      console.error(err);
    }
  },

  renderResults(data) {
    const total = this._allResults.length;
    document.getElementById("resultsTitle").textContent = `Results for "${this._currentQuery}"`;
    document.getElementById("resultsMeta").textContent  = `${total} products across ${Object.keys(data.by_platform).length} platforms`;

    // Platform tabs
    UI.buildPlatformTabs(data.by_platform, (platform) => {
      this.filterByPlatform(platform, data.by_platform);
    });

    this.renderProductGrid(this._allResults);
  },

  renderProductGrid(items) {
    const grid = document.getElementById("productGrid");
    if (!items.length) { grid.innerHTML = `<div class="no-results">No products found with current filters.</div>`; return; }

    grid.innerHTML = items.map((p, i) => {
      const discount = p.discount ? `<span class="product-discount">−${p.discount}%</span>` : "";
      const mrp      = p.mrp && p.mrp > p.price ? `<span class="product-mrp">₹${p.mrp.toLocaleString("en-IN")}</span>` : "";
      const rating   = p.rating ? `<span class="product-rating">★ ${p.rating}</span>` : "";
      const img      = p.img
        ? `<img src="${p.img}" alt="${p.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : "";
      const fallback = `<div class="product-img-fallback" ${p.img ? 'style="display:none"' : ""}>📦</div>`;

      return `
        <div class="product-card" data-idx="${i}">
          <div class="product-card-img">
            ${img}${fallback}
            <span class="platform-badge platform-badge--${p.platform.toLowerCase()}">${p.platform}</span>
            ${discount}
          </div>
          <div class="product-card-body">
            <div class="product-card-name">${p.name}</div>
            <div class="product-card-pricing">
              <span class="product-card-price">₹${p.price.toLocaleString("en-IN")}</span>
              ${mrp}
              ${rating}
            </div>
            <div class="product-card-actions">
              <a class="btn btn--outline btn--sm" href="${p.url || "#"}" target="_blank" rel="noopener noreferrer">View ↗</a>
              <button class="btn btn--primary btn--sm" onclick="Tracker.compareProduct(${i})">Compare</button>
            </div>
          </div>
        </div>`;
    }).join("");
  },

  filterByPlatform(platform, byPlatform) {
    if (platform === "all") {
      this.applySort(this._allResults);
      return;
    }
    const key = platform.toLowerCase();
    const items = byPlatform[key] ||
      this._allResults.filter(p => p.platform.toLowerCase() === key);
    this.applySort(items);
  },

  applySort(items) {
    const sort   = document.getElementById("sortSelect").value;
    const sorted = [...items];
    if (sort === "price_asc")  sorted.sort((a, b) => (a.price||0) - (b.price||0));
    if (sort === "price_desc") sorted.sort((a, b) => (b.price||0) - (a.price||0));
    if (sort === "discount")   sorted.sort((a, b) => (b.discount||0) - (a.discount||0));
    if (sort === "rating")     sorted.sort((a, b) => parseFloat(b.rating||0) - parseFloat(a.rating||0));
    this.renderProductGrid(sorted);
  },

  applyFilters() {
    const minP = parseInt(document.getElementById("filterMinPrice").value) || 0;
    const maxP = parseInt(document.getElementById("filterMaxPrice").value) || Infinity;
    const minD = parseInt(document.getElementById("filterDiscount").value) || 0;
    const filtered = this._allResults.filter(p =>
      (p.price || 0) >= minP &&
      (p.price || 0) <= maxP &&
      (p.discount || 0) >= minD
    );
    this.renderProductGrid(filtered);
  },

  /* ── Compare product ─────────────────────── */
  async compareProduct(idx) {
    const product = this._allResults[idx];
    if (!product) return;
    this._currentProduct = product;

    document.getElementById("compareTitle").textContent = product.name;
    document.getElementById("compareMeta").textContent  = `Comparing "${product.name}" across all platforms`;
    document.getElementById("compareThumb").textContent = "📦";

    document.getElementById("compare-section").style.display = "block";
    document.getElementById("compare-section").scrollIntoView({ behavior: "smooth", block: "start" });

    // Best deal card
    document.getElementById("bestDealCard").innerHTML = `
      <div class="best-deal-inner">
        <div class="best-deal-badge">✓ Best Price Found</div>
        <div class="best-deal-price">₹${product.price.toLocaleString("en-IN")}</div>
        <div class="best-deal-meta">${product.platform} · ${product.discount ? `${product.discount}% off` : "Current price"}</div>
        <a class="btn btn--primary" href="${product.url || "#"}" target="_blank" rel="noopener noreferrer">Buy on ${product.platform} ↗</a>
      </div>`;

    // Fetch comparison from all platforms (falls back to mock if backend unavailable)
    UI.toast("Fetching prices from all platforms…", "🔍");
    try {
      const data = await API.compare(product.name);
      this.renderCompareGrid(data.results);
    } catch (e) {
      console.error(e);
    }

    // Chart + forecast
    PriceChart.render(product.price);
    this.renderForecast(product);
  },

  renderCompareGrid(results) {
    const grid = document.getElementById("compareGrid");
    if (!results || !results.length) { grid.innerHTML = ""; return; }

    const best = results[0].price;
    grid.innerHTML = results.map((p, i) => {
      const diff     = p.price - best;
      const isBest   = i === 0;
      const diffHtml = isBest
        ? `<span class="compare-best-label">Best price →</span>`
        : `<span class="compare-diff">+₹${diff.toLocaleString("en-IN")}</span>`;

      return `
        <a class="compare-row ${isBest ? "compare-row--best" : ""}" href="${p.url || "#"}" target="_blank" rel="noopener noreferrer">
          <span class="compare-plat-badge compare-plat-badge--${p.platform.toLowerCase()}">${p.platform.charAt(0)}</span>
          <span class="compare-info">
            <span class="compare-plat-name">${p.platform}</span>
            <span class="compare-plat-meta">${p.rating ? `★ ${p.rating}` : ""} · Tap to open ↗</span>
            <span class="compare-track"><span class="compare-fill" style="width:${Math.round((best/p.price)*100)}%;background:${isBest ? "var(--green)" : "var(--amber)"}"></span></span>
          </span>
          <span class="compare-price-col">
            <span class="compare-price ${isBest ? "compare-price--best" : ""}">₹${p.price.toLocaleString("en-IN")}</span>
            ${diffHtml}
          </span>
        </a>`;
    }).join("");
  },

  renderForecast(product) {
    const price = product.price;
    document.getElementById("forecastRow").innerHTML = `
      <div class="forecast-card">
        <div class="forecast-icon">📉</div>
        <div class="forecast-body">
          <h4>Short-term prediction</h4>
          <p>Based on recent trend, price may drop <strong>₹${Math.round(price*0.03).toLocaleString("en-IN")}–₹${Math.round(price*0.06).toLocaleString("en-IN")}</strong> in the next 7 days.</p>
        </div>
        <span class="forecast-tag forecast-tag--down">↓ ~${Math.round(price*0.04).toLocaleString("en-IN")}</span>
      </div>
      <div class="forecast-card">
        <div class="forecast-icon">🗓️</div>
        <div class="forecast-body">
          <h4>Sale event forecast</h4>
          <p>Sale events (Diwali, Big Billion Day, Republic Day) historically reduce this category by 15–30%. Predicted: <strong>₹${Math.round(price*0.75).toLocaleString("en-IN")}–₹${Math.round(price*0.85).toLocaleString("en-IN")}</strong></p>
        </div>
        <span class="forecast-tag forecast-tag--sale">⚡ Sale</span>
      </div>
      <div class="forecast-card">
        <div class="forecast-icon">✅</div>
        <div class="forecast-body">
          <h4>Buy recommendation</h4>
          <p>Current price is ${product.discount ? "already discounted. Good time to buy." : "near average. Consider waiting for a sale event."}</p>
        </div>
        <span class="forecast-tag forecast-tag--buy">${product.discount ? "Buy now" : "Wait"}</span>
      </div>`;
  },

  /* ── Alerts ─────────────────────────────── */
  openAlertModal(productName) {
    if (productName) document.getElementById("alertProductName").value = productName;
    UI.openModal("alertModal");
    document.getElementById("alertEmail").focus();
  },

  saveAlert() {
    const email   = document.getElementById("alertEmail").value.trim();
    const product = document.getElementById("alertProductName").value.trim();
    const price   = document.getElementById("alertPrice").value.trim();
    const errEl   = document.getElementById("alertError");

    if (!email || !email.includes("@")) {
      errEl.textContent = "Enter a valid email."; errEl.style.display = "block"; return;
    }
    if (!product) {
      errEl.textContent = "Enter a product name."; errEl.style.display = "block"; return;
    }
    if (!price || isNaN(price) || Number(price) <= 0) {
      errEl.textContent = "Enter a valid target price."; errEl.style.display = "block"; return;
    }
    errEl.style.display = "none";

    const alert = { id: Date.now(), email, product, targetPrice: Number(price), createdAt: new Date().toLocaleDateString("en-IN") };
    this._alerts.push(alert);
    localStorage.setItem("pr_alerts", JSON.stringify(this._alerts));

    UI.showModalConfirm("alertModal",
      `<div class="alert-set-confirm">
        <div class="check">✅</div>
        <h3>Alert saved!</h3>
        <p>We'll notify <strong>${email}</strong> when <strong>${product}</strong> drops below <strong>₹${Number(price).toLocaleString("en-IN")}</strong>.</p>
        <button class="btn btn--primary" style="width:100%;margin-top:16px" id="alertDoneBtn">Done</button>
      </div>`
    );
    document.getElementById("alertDoneBtn").addEventListener("click", () => {
      UI.closeModal("alertModal");
      this.renderAlertsList();
    });
    UI.toast(`Alert saved for ₹${Number(price).toLocaleString("en-IN")}`, "🔔");
  },

  deleteAlert(id) {
    this._alerts = this._alerts.filter(a => a.id !== id);
    localStorage.setItem("pr_alerts", JSON.stringify(this._alerts));
    this.renderAlertsList();
    UI.toast("Alert removed", "✓");
  },

  renderAlertsList() {
    const list  = document.getElementById("alertsList");
    const empty = document.getElementById("alertsEmpty");
    const count = document.getElementById("alertsCount");
    count.textContent = `${this._alerts.length} alert${this._alerts.length !== 1 ? "s" : ""}`;

    if (!this._alerts.length) {
      empty.style.display = "flex"; list.innerHTML = ""; return;
    }
    empty.style.display = "none";
    list.innerHTML = this._alerts.map(a => `
      <li class="alert-item">
        <span class="alert-icon">🔔</span>
        <span class="alert-info">
          <span class="alert-product">${a.product}</span>
          <span class="alert-detail">Alert when below ₹${a.targetPrice.toLocaleString("en-IN")} · ${a.email}</span>
        </span>
        <span class="alert-date">${a.createdAt}</span>
        <button class="btn-icon-delete" onclick="Tracker.deleteAlert(${a.id})">✕</button>
      </li>`).join("");
  },

  init() {
    this.renderAlertsList();
  },
};
