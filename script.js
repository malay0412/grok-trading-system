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
  document.getElementById("analyzeBtn").onclick = () => {
    alert("Analysis is being restored. Full version coming soon.");
  };
}
init();
