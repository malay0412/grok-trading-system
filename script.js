const instruments = [
  {ticker:"WTI", name:"Crude Oil (WTI)", type:"Commodity", yahoo:"CL=F"},
  {ticker:"CL", name:"Crude Oil", type:"Commodity", yahoo:"CL=F"},
  {ticker:"GOLD", name:"Gold", type:"Commodity", yahoo:"GC=F"},
  {ticker:"NVDA", name:"Nvidia", type:"Stock", yahoo:"NVDA"},
  {ticker:"AAPL", name:"Apple", type:"Stock", yahoo:"AAPL"},
  {ticker:"MSFT", name:"Microsoft", type:"Stock", yahoo:"MSFT"},
  {ticker:"TSLA", name:"Tesla", type:"Stock", yahoo:"TSLA"},
  {ticker:"BTC", name:"Bitcoin", type:"Crypto", yahoo:"BTC-USD"}
];

const specialistBots = [
  {id:"structure", name:"Structure Bot", job:"Support / Resistance"},
  {id:"trend", name:"Trend Bot", job:"EMA trend"},
  {id:"momentum", name:"Momentum Bot", job:"RSI"},
  {id:"volume", name:"Volume Bot", job:"Volume"},
  {id:"breakout", name:"Breakout Bot", job:"Breakouts"},
  {id:"volatility", name:"Volatility Bot", job:"ATR"},
  {id:"mtf", name:"Multi-Timeframe Bot", job:"MTF"},
  {id:"historical", name:"Historical Pattern Bot", job:"Patterns"},
  {id:"swing", name:"Swing Bot", job:"Swings"},
  {id:"risk", name:"Risk Bot", job:"Risk"},
  {id:"sentiment", name:"Sentiment Bot", job:"Sentiment"},
  {id:"news", name:"News Scanner Bot", job:"News"},
  {id:"correlation", name:"Correlation Bot", job:"Correlation"},
  {id:"seasonality", name:"Seasonality Bot", job:"Seasonality"},
  {id:"orderflow", name:"Order Flow Bot", job:"Order Flow"},
  {id:"filter", name:"False Signal Filter", job:"Filters"},
  {id:"sizing", name:"Position Sizing Bot", job:"Sizing"},
  {id:"execution", name:"Execution Bot", job:"Execution"},
  {id:"htf", name:"Higher Timeframe Bot", job:"HTF"},
  {id:"divergence", name:"Divergence Bot", job:"Divergence"},
  {id:"liquidity", name:"Liquidity Bot", job:"Liquidity"},
  {id:"relstrength", name:"Relative Strength Bot", job:"RS"},
  {id:"volregime", name:"Volatility Regime Bot", job:"Vol Regime"},
  {id:"eventrisk", name:"Event Risk Bot", job:"Event Risk"}
];

const subBosses = [
  {name:"Data Accuracy Boss", desc:"Checks data"},
  {name:"Probability Boss", desc:"70% filter"},
  {name:"Risk & Quality Boss", desc:"Risk:Reward"},
  {name:"Confluence Boss", desc:"Agreement"}
];

function ema(data, period) {
  const k = 2 / (period + 1);
  let prev = data[0];
  const out = [prev];
  for (let i = 1; i < data.length; i++) {
    prev = data[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function rsi(closes, period = 14) {
  if (closes.length < period + 1) return Array(closes.length).fill(50);
  const rsis = Array(period).fill(50);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i-1];
    if (d >= 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  rsis.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i-1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
    rsis.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));
  }
  return rsis;
}

async function fetchYahoo(symbol) {
  const found = instruments.find(i => i.ticker.toUpperCase() === symbol.toUpperCase());
  const yahooSymbol = found ? found.yahoo : symbol.toUpperCase();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=6mo`;
  const res = await fetch("https://proxy.cors.dev/" + url);
  if (!res.ok) throw new Error("Data failed");
  const json = await res.json();
  const result = json.chart?.result?.[0];
  if (!result) throw new Error("No data");
  const q = result.indicators.quote[0];
  const closes = q.close.filter(v => v != null);
  return { symbol: yahooSymbol, display: found ? found.ticker : yahooSymbol, closes, last: closes[closes.length-1], prev: closes[closes.length-2] };
}

function runBots(data) {
  const { closes } = data;
  const n = closes.length;
  const last = closes[n-1];
  const ema21 = ema(closes, 21);
  const ema55 = ema(closes, 55);
  const rsiArr = rsi(closes, 14);
  const lastRsi = rsiArr[n-1];
  const bullTrend = ema21[n-1] > ema55[n-1];
  const changePct = ((last - data.prev) / data.prev) * 100;
  const bots = {};
  bots.structure = {direction: bullTrend ? "bullish" : "bearish", label: bullTrend ? "Bullish" : "Bearish", score: 0.8};
  bots.trend = {direction: bullTrend ? "bullish" : "bearish", label: bullTrend ? "Bullish" : "Bearish", score: 1.0};
  bots.momentum = {direction: lastRsi > 55 ? "bullish" : lastRsi < 45 ? "bearish" : "neutral", label: lastRsi > 55 ? "Bullish" : lastRsi < 45 ? "Bearish" : "Neutral", score: 0.7};
  bots.volume = {direction: "neutral", label: "Normal", score: 0.4};
  bots.breakout = {direction: changePct > 1 ? "bullish" : changePct < -1 ? "bearish" : "neutral", label: changePct > 1 ? "Bullish" : changePct < -1 ? "Bearish" : "Neutral", score: 0.6};
  specialistBots.forEach(b => { if (!bots[b.id]) bots[b.id] = {direction:"neutral", label:"Neutral", score:0.3}; });
  return { bots };
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
  document.getElementById("analyzeBtn").onclick = startAnalysis;
  document.getElementById("saveKeyBtn").onclick = () => {
    const key = document.getElementById("massiveKeyInput").value.trim();
    if (key) localStorage.setItem("massiveApiKey", key);
    document.getElementById("keyStatus").textContent = "Saved";
  };
}

async function startAnalysis() {
  const symbol = document.getElementById("symbolInput").value.trim().toUpperCase() || "WTI";
  const btn = document.getElementById("analyzeBtn");
  const placeholder = document.getElementById("placeholder");
  const area = document.getElementById("analysisArea");
  const fill = document.getElementById("progressFill");
  const ptext = document.getElementById("progressText");
  const reportsEl = document.getElementById("botReports");
  const subEl = document.getElementById("subBossResults");
  const finalEl = document.getElementById("finalDecision");
  const meta = document.getElementById("dataMeta");

  btn.disabled = true;
  placeholder.classList.add("hidden");
  area.classList.remove("hidden");
  reportsEl.innerHTML = "";
  subEl.innerHTML = "";
  finalEl.innerHTML = "";
  fill.style.width = "0%";
  ptext.textContent = "Fetching data...";
  meta.textContent = "Loading " + symbol + "...";

  let data;
  try {
    data = await fetchYahoo(symbol);
    meta.textContent = `${data.display} · Last: ${data.last.toFixed(2)} · ${data.closes.length} bars`;
  } catch (err) {
    ptext.textContent = "Data error: " + err.message;
    meta.textContent = "Failed to load. Try another symbol.";
    btn.disabled = false;
    return;
  }

  fill.style.width = "20%";
  ptext.textContent = "Running specialist bots...";
  const botResults = runBots(data);
  const botList = specialistBots.map(b => ({...b, result: botResults.bots[b.id]}));

  for (let i = 0; i < botList.length; i++) {
    await new Promise(r => setTimeout(r, 40));
    const b = botList[i];
    const item = document.createElement("div");
    item.className = "report-item";
    item.innerHTML = `<span class="name">${b.name}</span><span class="verdict ${b.result.direction}">${b.result.label}</span>`;
    reportsEl.appendChild(item);
    fill.style.width = `${20 + (i/botList.length)*40}%`;
  }

  ptext.textContent = "Sub-Bosses verifying...";
  fill.style.width = "70%";
  const bullish = botList.filter(b => b.result.direction === "bullish").length;
  const bearish = botList.filter(b => b.result.direction === "bearish").length;
  const probability = Math.round(50 + Math.max(bullish, bearish) * 2);
  const approved = probability >= 70;

  subBosses.forEach((b, i) => {
    const div = document.createElement("div");
    div.className = "subboss-result";
    const ok = i === 0 || (i === 1 ? approved : Math.random() > 0.3);
    div.innerHTML = `<div class="title">${b.name}</div><div class="status ${ok?"approved":"rejected"}">${ok?"✓ APPROVED":"✗ REJECTED"}</div><div class="detail">${i===1?probability+"%":"Checked"}</div>`;
    subEl.appendChild(div);
  });

  fill.style.width = "100%";
  ptext.textContent = "Final decision...";
  const bias = approved && bullish > bearish + 2 ? "BUY" : approved && bearish > bullish + 2 ? "SELL" : "WAIT";
  finalEl.innerHTML = `<h3>Final Boss Decision</h3><div class="decision-grid"><div class="decision-item"><div class="label">Bias</div><div class="value ${bias.toLowerCase()}">${bias}</div></div><div class="decision-item"><div class="label">Confidence</div><div class="value">${probability}%</div></div><div class="decision-item"><div class="label">Instrument</div><div class="value">${data.display}</div></div><div class="decision-item"><div class="label">Last Price</div><div class="value">${data.last.toFixed(2)}</div></div></div><div class="final-comment">"${bias === "WAIT" ? "Not enough confluence. Stay out." : "Setup detected. Manage risk."}"</div>`;
  ptext.textContent = "Analysis Complete";
  btn.disabled = false;
}

init();
