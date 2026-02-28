/* ui.js — DOM rendering, toast, modals, progress */

const UI = {

  /* ── Toast ─────────────────────────────── */
  _toastTimer: null,
  toast(msg, icon = "✓", duration = 3000) {
    const el = document.getElementById("toast");
    document.getElementById("toastMsg").textContent  = msg;
    document.getElementById("toastIcon").textContent = icon;
    el.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove("show"), duration);
  },

  /* ── Modals ─────────────────────────────── */
  openModal(id) {
    document.getElementById(id).classList.add("open");
  },
  closeModal(id) {
    document.getElementById(id).classList.remove("open");
    // reset alert error
    const errEl = document.getElementById("alertError");
    if (errEl) errEl.style.display = "none";
  },
  showModalConfirm(id, html) {
    const modal = document.querySelector(`#${id} .modal`);
    if (modal) modal.innerHTML = html;
  },

  /* ── Progress bar ───────────────────────── */
  _progressTimer: null,
  showProgress(platforms) {
    const prog   = document.getElementById("searchProgress");
    const fill   = document.getElementById("progressFill");
    const labels = document.getElementById("progressLabels");
    prog.style.display = "block";
    fill.style.width   = "0%";

    labels.innerHTML = platforms.map(p =>
      `<span class="progress-step" data-plat="${p}">${p.charAt(0).toUpperCase() + p.slice(1)}</span>`
    ).join("");

    let i = 0;
    const steps = labels.querySelectorAll(".progress-step");
    const tick = () => {
      if (i > 0 && steps[i-1]) steps[i-1].className = "progress-step done";
      if (i < steps.length) {
        steps[i].className = "progress-step scanning";
        fill.style.width = Math.round(((i+1)/steps.length)*100) + "%";
        i++;
        this._progressTimer = setTimeout(tick, 400);
      }
    };
    tick();
  },
  hideProgress() {
    clearTimeout(this._progressTimer);
    const prog = document.getElementById("searchProgress");
    const fill = document.getElementById("progressFill");
    if (fill) fill.style.width = "100%";
    setTimeout(() => { if (prog) prog.style.display = "none"; }, 300);
  },

  /* ── Platform pills ─────────────────────── */
  getActivePlatforms() {
    return [...document.querySelectorAll("#platformPills .pill--active")]
      .map(p => p.dataset.platform)
      .filter(Boolean);
  },

  initPills() {
    document.querySelectorAll("#platformPills .pill").forEach(btn => {
      btn.addEventListener("click", () => btn.classList.toggle("pill--active"));
    });
  },

  /* ── Platform tabs in results ───────────── */
  buildPlatformTabs(byPlatform, onSelect) {
    const container = document.getElementById("platformTabs");
    const total = Object.values(byPlatform).reduce((s, a) => s + a.length, 0);

    const tabs = [{ id: "all", label: `All (${total})` },
      ...Object.entries(byPlatform).map(([k, v]) => ({ id: k, label: `${k.charAt(0).toUpperCase()+k.slice(1)} (${v.length})` }))
    ];

    container.innerHTML = tabs.map((t, i) =>
      `<button class="ptab ${i===0?"ptab--active":""}" data-plat="${t.id}">${t.label}</button>`
    ).join("");

    container.querySelectorAll(".ptab").forEach(btn => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".ptab").forEach(b => b.classList.remove("ptab--active"));
        btn.classList.add("ptab--active");
        onSelect(btn.dataset.plat);
      });
    });
  },

  /* ── No results ─────────────────────────── */
  showNoResults(q) {
    document.getElementById("results-section").style.display = "block";
    document.getElementById("productGrid").innerHTML = `
      <div class="no-results">
        <span>🔍</span>
        <p>No products found for "<strong>${q}</strong>".<br>Try a shorter or different search term.</p>
      </div>`;
    document.getElementById("resultsTitle").textContent = `No results for "${q}"`;
    document.getElementById("resultsMeta").textContent  = "";
    document.getElementById("platformTabs").innerHTML   = "";
    document.getElementById("results-section").scrollIntoView({ behavior: "smooth", block: "start" });
  },

  /* ── Demo mode notice ───────────────────── */
  showDemoNotice() {
    if (document.getElementById("demoNotice")) return;
    const bar = document.createElement("div");
    bar.id = "demoNotice";
    bar.className = "demo-notice";
    bar.innerHTML = `
      <span>🔵 <strong>Demo mode</strong> — Showing simulated prices. Start <code>backend/server.py</code> for live data.</span>
      <button onclick="this.parentElement.remove()" class="btn btn--sm btn--ghost" style="margin-left:auto">✕</button>`;
    document.body.insertAdjacentElement("afterbegin", bar);
  },
  hideDemoNotice() {
    const el = document.getElementById("demoNotice");
    if (el) el.remove();
  },

  /* ── Chart tabs ─────────────────────────── */
  initChartTabs() {
    document.getElementById("chartTabs").addEventListener("click", e => {
      const tab = e.target.closest(".tab");
      if (!tab) return;
      document.querySelectorAll("#chartTabs .tab").forEach(t => t.classList.remove("tab--active"));
      tab.classList.add("tab--active");
      PriceChart.switchRange(tab.dataset.range);
    });
  },

  /* ── Filter bar toggle ──────────────────── */
  initFilterBar() {
    document.getElementById("filterToggle").addEventListener("click", () => {
      const bar = document.getElementById("filterBar");
      bar.style.display = bar.style.display === "none" ? "flex" : "none";
    });
    document.getElementById("applyFilters").addEventListener("click", () => Tracker.applyFilters());
    document.getElementById("clearFilters").addEventListener("click", () => {
      document.getElementById("filterMinPrice").value = "";
      document.getElementById("filterMaxPrice").value = "";
      document.getElementById("filterDiscount").value = "0";
      Tracker.renderProductGrid(Tracker._allResults);
    });
  },

  /* ── Sort ───────────────────────────────── */
  initSort() {
    document.getElementById("sortSelect").addEventListener("change", () => {
      Tracker.applySort(Tracker._allResults);
    });
  },

  /* ── All button bindings ────────────────── */
  init() {
    this.initPills();
    this.initChartTabs();
    this.initFilterBar();
    this.initSort();

    // Search
    document.getElementById("searchBtn").addEventListener("click", () => Tracker.runSearch());
    document.getElementById("searchInput").addEventListener("keydown", e => {
      if (e.key === "Enter") Tracker.runSearch();
    });

    // Modals
    ["headerAlertBtn"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", () => Tracker.openAlertModal(""));
    });
    document.getElementById("compareAlertBtn").addEventListener("click", () => {
      Tracker.openAlertModal(Tracker._currentProduct?.name || "");
    });
    document.getElementById("modalCloseBtn").addEventListener("click", () => UI.closeModal("alertModal"));
    document.getElementById("modalCancelBtn").addEventListener("click", () => UI.closeModal("alertModal"));
    document.getElementById("alertModal").addEventListener("click", e => {
      if (e.target === e.currentTarget) UI.closeModal("alertModal");
    });
    document.getElementById("setAlertBtn").addEventListener("click", () => Tracker.saveAlert());

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") UI.closeModal("alertModal");
    });
  },
};
