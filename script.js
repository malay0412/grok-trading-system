const instruments = [
  {ticker:"WTI", name:"Crude Oil (WTI)", type:"Commodity", yahoo:"CL=F"},
  {ticker:"CL", name:"Crude Oil", type:"Commodity", yahoo:"CL=F"},
  {ticker:"GOLD", name:"Gold", type:"Commodity", yahoo:"GC=F"},
  {ticker:"GC", name:"Gold Futures", type:"Commodity", yahoo:"GC=F"},
  {ticker:"SILVER", name:"Silver", type:"Commodity", yahoo:"SI=F"},
  {ticker:"SI", name:"Silver Futures", type:"Commodity", yahoo:"SI=F"},
  {ticker:"NATGAS", name:"Natural Gas", type:"Commodity", yahoo:"NG=F"},
  {ticker:"NG", name:"Natural Gas Futures", type:"Commodity", yahoo:"NG=F"},
  {ticker:"NVDA", name:"Nvidia", type:"Stock", yahoo:"NVDA"},
  {ticker:"AAPL", name:"Apple", type:"Stock", yahoo:"AAPL"},
  {ticker:"MSFT", name:"Microsoft", type:"Stock", yahoo:"MSFT"},
  {ticker:"AMZN", name:"Amazon", type:"Stock", yahoo:"AMZN"},
  {ticker:"GOOGL", name:"Alphabet", type:"Stock", yahoo:"GOOGL"},
  {ticker:"META", name:"Meta Platforms", type:"Stock", yahoo:"META"},
  {ticker:"TSLA", name:"Tesla", type:"Stock", yahoo:"TSLA"},
  {ticker:"AMD", name:"AMD", type:"Stock", yahoo:"AMD"},
  {ticker:"BTC", name:"Bitcoin", type:"Crypto", yahoo:"BTC-USD"},
  {ticker:"ETH", name:"Ethereum", type:"Crypto", yahoo:"ETH-USD"}
];

const specialistBots = [
  {name:"Structure Bot", job:"Support / Resistance"},
  {name:"Trend Bot", job:"EMA trend"},
  {name:"Momentum Bot", job:"RSI"},
  {name:"Volume Bot", job:"Volume"},
  {name:"Breakout Bot", job:"Breakouts"},
  {name:"Volatility Bot", job:"ATR"},
  {name:"Multi-Timeframe Bot", job:"MTF"},
  {name:"Historical Pattern Bot", job:"Patterns"},
  {name:"Swing Bot", job:"Swings"},
  {name:"Risk Bot", job:"Risk"},
  {name:"Sentiment Bot", job:"Sentiment"},
  {name:"News Scanner Bot", job:"News"},
  {name:"Correlation Bot", job:"Correlation"},
  {name:"Seasonality Bot", job:"Seasonality"},
  {name:"Order Flow Bot", job:"Order Flow"},
  {name:"False Signal Filter", job:"Filters"},
  {name:"Position Sizing Bot", job:"Sizing"},
  {name:"Execution Bot", job:"Execution"},
  {name:"Higher Timeframe Bot", job:"HTF"},
  {name:"Divergence Bot", job:"Divergence"},
  {name:"Liquidity Bot", job:"Liquidity"},
  {name:"Relative Strength Bot", job:"RS"},
  {name:"Volatility Regime Bot", job:"Vol Regime"},
  {name:"Event Risk Bot", job:"Event Risk"}
];

const subBosses = [
  {name:"Data Accuracy Boss", desc:"Checks data"},
  {name:"Probability Boss", desc:"70% filter"},
  {name:"Risk & Quality Boss", desc:"Risk:Reward"},
  {name:"Confluence Boss", desc:"Agreement"}
];

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
  const meta = document.getElementById("dataMeta");
  btn.disabled = true;
  meta.textContent = "Loading " + symbol + "...";
  try {
    const isCommodity = /WTI|CL|GOLD|GC|SILVER|SI|NATGAS|NG|BTC|ETH/i.test(symbol);
    if (!isCommodity && localStorage.getItem("massiveApiKey")) {
      meta.textContent = "Using Massive for " + symbol;
    } else {
      meta.textContent = "Using Yahoo for " + symbol;
    }
    setTimeout(() => {
      meta.textContent = symbol + " · Analysis ready (full logic restoring)";
      btn.disabled = false;
    }, 800);
  } catch (e) {
    meta.textContent = "Error: " + e.message;
    btn.disabled = false;
  }
}

init();
