/* chart.js — Price history chart */

const PriceChart = (() => {
  let instance  = null;
  let basePrice = 0;

  const RANGES = {
    "1M": 4,
    "3M": 12,
    "6M": 24,
  };

  function generateHistory(price, points) {
    const data = [];
    let current = price * 1.18;
    for (let i = 0; i < points; i++) {
      const progress = i / (points - 1);
      const trend    = current * (1 - progress * 0.15);
      const noise    = (Math.random() - 0.5) * price * 0.04;
      current = Math.max(price * 0.85, trend + noise);
      data.push(Math.round(current));
    }
    data[data.length - 1] = price; // always end at current price
    return data;
  }

  function generateLabels(points, range) {
    const labels = [];
    const now    = new Date();
    if (range === "1M") {
      for (let i = points - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        labels.push(d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }));
      }
    } else if (range === "3M") {
      for (let i = points - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        labels.push(d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }));
      }
    } else {
      for (let i = points - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        labels.push(d.toLocaleDateString("en-IN", { month: "short" }));
      }
    }
    return labels;
  }

  function render(price) {
    basePrice = price;
    const canvas = document.getElementById("priceChart");
    if (!canvas) return;
    if (instance) { instance.destroy(); instance = null; }

    const ctx    = canvas.getContext("2d");
    const range  = "1M";
    const points = RANGES[range];
    const data   = generateHistory(price, points);
    const labels = generateLabels(points, range);

    const grad = ctx.createLinearGradient(0, 0, 0, 240);
    grad.addColorStop(0, "rgba(45,106,79,0.2)");
    grad.addColorStop(1, "rgba(45,106,79,0.0)");

    instance = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Price",
          data,
          borderColor: "#2d6a4f",
          backgroundColor: grad,
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: "#2d6a4f",
          pointHoverRadius: 6,
          tension: 0.38,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#1c1a16",
            borderColor: "#2e2b24",
            borderWidth: 1,
            padding: 10,
            titleFont: { family: "'DM Mono',monospace", size: 11 },
            bodyFont:  { family: "'DM Mono',monospace", size: 12 },
            callbacks: { label: ctx => ` ₹${ctx.raw.toLocaleString("en-IN")}` },
          },
        },
        scales: {
          x: {
            grid:  { color: "rgba(28,26,22,0.05)", drawBorder: false },
            ticks: { color: "#7a746c", font: { family: "'DM Mono',monospace", size: 10 } },
          },
          y: {
            grid:  { color: "rgba(28,26,22,0.05)", drawBorder: false },
            ticks: {
              color: "#7a746c",
              font:  { family: "'DM Mono',monospace", size: 10 },
              callback: v => "₹" + (v/1000).toFixed(0) + "K",
            },
          },
        },
      },
    });
  }

  function switchRange(range) {
    if (!instance || !basePrice) return;
    const points = RANGES[range] || 4;
    const data   = generateHistory(basePrice, points);
    const labels = generateLabels(points, range);
    instance.data.labels           = labels;
    instance.data.datasets[0].data = data;
    instance.update("active");
  }

  return { render, switchRange };
})();
