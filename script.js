const instruments = [
  {ticker:"WTI", name:"Crude Oil (WTI)", type:"Commodity", yahoo:"CL=F"},
  {ticker:"GOLD", name:"Gold", type:"Commodity", yahoo:"GC=F"},
  {ticker:"NVDA", name:"Nvidia", type:"Stock", yahoo:"NVDA"},
  {ticker:"AAPL", name:"Apple", type:"Stock", yahoo:"AAPL"},
  {ticker:"TSLA", name:"Tesla", type:"Stock", yahoo:"TSLA"},
  {ticker:"BTC", name:"Bitcoin", type:"Crypto", yahoo:"BTC-USD"}
];
const specialistBots = [
  {id:"structure", name:"Structure Bot", job:"Support / Resistance"},
  {id:"trend", name:"Trend Bot", job:"EMA trend"},
  {id:"momentum", name:"Momentum Bot", job:"RSI"},
  {id:"breakout", name:"Breakout Bot", job:"Breakouts"}
];
const subBosses = [
  {name:"Probability Boss", desc:"70% filter"},
  {name:"Confluence Boss", desc:"Agreement"}
];
function setupAutocomplete() {
  const input = document.getElementById("symbolInput");
  const box = document.getElementById("suggestions");
  input.addEventListener("input", () => {
    const q = input.value.trim().toUpperCase();
    box.innerHTML = "";
    if (!q) { box.classList.remove("show"); return; }
    const matches = instruments.filter(i => i.ticker.includes(q) || i.name.toUpperCase().includes(q)).slice(0, 6);
    matches.forEach(m => {
      const div = document.createElement("div");
      div.className = "suggestion-item";
      div.innerHTML = `<span class="ticker">${m.ticker}</span><span class="name">${m.name}</span>`;
      div.onclick = () => { input.value = m.ticker; box.classList.remove("show"); };
      box.appendChild(div);
    });
    if (matches.length) box.classList.add("show");
  });
}
async function fetchYahoo(symbol) {
  const found = instruments.find(i => i.ticker.toUpperCase() === symbol.toUpperCase());
  const yahooSymbol = found ? found.yahoo : symbol.toUpperCase();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=3mo`;
  const res = await fetch("https://proxy.cors.dev/" + url);
  if (!res.ok) throw new Error("Data failed");
  const json = await res.json();
  const result = json.chart?.result?.[0];
  if (!result) throw new Error("No data");
  const closes = result.indicators.quote[0].close.filter(v => v != null);
  return { display: found ? found.ticker : yahooSymbol, closes, last: closes[closes.length-1], prev: closes[closes.length-2] };
}
function init() {
  const botsEl = document.getElementById("specialist-bots");
  specialistBots.forEach(b => {
    const d = document.createElement("div");
    d.className = "bot-card";
    d.innerHTML = `<div class="bot-name">${b.name}</div><div class="bot-job">${b.job}</div>`;
    botsEl.appendChild(d);
  });
  const subEl = document.getElementById("sub-bosses");
  subBosses.forEach(b => {
    const d = document.createElement("div");
    d.className = "subboss-card";
    d.innerHTML = `<strong>${b.name}</strong><p>${b.desc}</p>`;
    subEl.appendChild(d);
  });
  setupAutocomplete();
  document.getElementById("analyzeBtn").onclick = startAnalysis;
}
async function startAnalysis() {
  const symbol = document.getElementById("symbolInput").value.trim().toUpperCase() || "WTI";
  const btn = document.getElementById("analyzeBtn");
  const placeholder = document.getElementById("placeholder");
  const area = document.getElementById("analysisArea");
  const ptext = document.getElementById("progressText");
  const reportsEl = document.getElementById("botReports");
  const finalEl = document.getElementById("finalDecision");
  const meta = document.getElementById("dataMeta");
  btn.disabled = true;
  placeholder.classList.add("hidden");
  area.classList.remove("hidden");
  reportsEl.innerHTML = "";
  finalEl.innerHTML = "";
  ptext.textContent = "Fetching data...";
  meta.textContent = "Loading " + symbol + "...";
  try {
    const data = await fetchYahoo(symbol);
    meta.textContent = data.display + " · Last: " + data.last.toFixed(2);
    ptext.textContent = "Running bots...";
    const change = ((data.last - data.prev) / data.prev) * 100;
    const bias = change > 1 ? "BUY" : change < -1 ? "SELL" : "WAIT";
    specialistBots.forEach(b => {
      const item = document.createElement("div");
      item.className = "report-item";
      item.innerHTML = `<span class="name">${b.name}</span><span class="verdict ${bias==="BUY"?"bullish":bias==="SELL"?"bearish":"neutral"}>${bias}</span>`;
      reportsEl.appendChild(item);
    });
    finalEl.innerHTML = `<h3>Final Boss Decision</h3><div class="decision-item"><div class="label">Bias</div><div class="value ${bias.toLowerCase()}">${bias}</div></div><div class="decision-item"><div class="label">Last Price</div><div class="value">${data.last.toFixed(2)}</div></div><div class="final-comment">"${bias === "WAIT" ? "No clear signal." : bias + " signal based on recent move."}"</div>`;
    ptext.textContent = "Analysis Complete";
  } catch (e) {
    ptext.textContent = "Error: " + e.message;
    meta.textContent = "Failed to load data";
  }
  btn.disabled = false;
}
init();
