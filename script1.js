const instruments = [
  {ticker:"WTI", name:"Crude Oil (WTI)", type:"Commodity", yahoo:"CL=F"},
  {ticker:"CL", name:"Crude Oil", type:"Commodity", yahoo:"CL=F"},
  {ticker:"GOLD", name:"Gold", type:"Commodity", yahoo:"GC=F"},
  {ticker:"GC", name:"Gold Futures", type:"Commodity", yahoo:"GC=F"},
  {ticker:"SILVER", name:"Silver", type:"Commodity", yahoo:"SI=F"},
  {ticker:"SI", name:"Silver Futures", type:"Commodity", yahoo:"SI=F"},
  {ticker:"NATGAS", name:"Natural Gas", type:"Commodity", yahoo:"NG=F"},
  {ticker:"NG", name:"Natural Gas Futures", type:"Commodity", yahoo:"NG=F"},
  {ticker:"SGLN", name:"iShares Physical Gold", type:"ETF", yahoo:"SGLN.L"},
  {ticker:"NVDA", name:"Nvidia", type:"Stock", yahoo:"NVDA"},
  {ticker:"AAPL", name:"Apple", type:"Stock", yahoo:"AAPL"},
  {ticker:"MSFT", name:"Microsoft", type:"Stock", yahoo:"MSFT"},
  {ticker:"AMZN", name:"Amazon", type:"Stock", yahoo:"AMZN"},
  {ticker:"GOOGL", name:"Alphabet (Class A)", type:"Stock", yahoo:"GOOGL"},
  {ticker:"META", name:"Meta Platforms", type:"Stock", yahoo:"META"},
  {ticker:"TSLA", name:"Tesla", type:"Stock", yahoo:"TSLA"},
  {ticker:"AMD", name:"Advanced Micro Devices", type:"Stock", yahoo:"AMD"},
  {ticker:"AVGO", name:"Broadcom", type:"Stock", yahoo:"AVGO"},
  {ticker:"PLTR", name:"Palantir", type:"Stock", yahoo:"PLTR"},
  {ticker:"MU", name:"Micron Technology", type:"Stock", yahoo:"MU"},
  {ticker:"NFLX", name:"Netflix", type:"Stock", yahoo:"NFLX"},
  {ticker:"KO", name:"Coca-Cola", type:"Stock", yahoo:"KO"},
  {ticker:"JPM", name:"JPMorgan Chase", type:"Stock", yahoo:"JPM"},
  {ticker:"VUAG", name:"Vanguard S&P 500 (Acc)", type:"ETF", yahoo:"VUAG.L"},
  {ticker:"VWRP", name:"Vanguard FTSE All-World (Acc)", type:"ETF", yahoo:"VWRP.L"},
  {ticker:"SPY", name:"SPDR S&P 500 ETF", type:"ETF", yahoo:"SPY"},
  {ticker:"QQQ", name:"Invesco QQQ", type:"ETF", yahoo:"QQQ"},
  {ticker:"GLD", name:"SPDR Gold Shares", type:"ETF", yahoo:"GLD"},
  {ticker:"BTC", name:"Bitcoin", type:"Crypto", yahoo:"BTC-USD"},
  {ticker:"ETH", name:"Ethereum", type:"Crypto", yahoo:"ETH-USD"}
];

const specialistBots = [
  {id:"structure", name:"Structure Bot", job:"Support / Resistance / Zones"},
  {id:"trend", name:"Trend Bot", job:"EMA + multi-TF trend"},
  {id:"momentum", name:"Momentum Bot", job:"RSI & rate of change"},
  {id:"volume", name:"Volume Bot", job:"Volume spikes & confirmation"},
  {id:"breakout", name:"Breakout Bot", job:"Real vs false breakouts"},
  {id:"volatility", name:"Volatility Bot", job:"ATR & range expansion"},
  {id:"mtf", name:"Multi-Timeframe Bot", job:"Timeframe alignment"},
  {id:"historical", name:"Historical Pattern Bot", job:"Recent structure patterns"},
  {id:"swing", name:"Swing Bot", job:"Swing highs & lows"},
  {id:"risk", name:"Risk Bot", job:"Stop / Target / R:R"},
  {id:"sentiment", name:"Sentiment Bot", job:"Price action bias"},
  {id:"news", name:"News Scanner Bot", job:"Headlines + sentiment"},
  {id:"correlation", name:"Correlation Bot", job:"Related market context"},
  {id:"seasonality", name:"Seasonality Bot", job:"Seasonal tendencies"},
  {id:"orderflow", name:"Order Flow Bot", job:"Buying / selling pressure"},
  {id:"filter", name:"False Signal Filter", job:"Trap detection"},
  {id:"sizing", name:"Position Sizing Bot", job:"Position size suggestion"},
  {id:"execution", name:"Execution Bot", job:"Best entry method"},
  {id:"htf", name:"Higher Timeframe Bot", job:"Daily/Weekly structure bias"},
  {id:"divergence", name:"Divergence Bot", job:"RSI / price divergences"},
  {id:"liquidity", name:"Liquidity Bot", job:"Demand / supply zones"},
  {id:"relstrength", name:"Relative Strength Bot", job:"Vs index / sector"},
  {id:"volregime", name:"Volatility Regime Bot", job:"Low vs high vol environment"},
  {id:"eventrisk", name:"Event Risk Bot", job:"High-impact event filter"}
];

const subBosses = [
  {name:"Data Accuracy Boss", desc:"Checks data consistency"},
  {name:"Probability Boss", desc:"70% probability filter"},
  {name:"Risk & Quality Boss", desc:"Risk:Reward & structure"},
  {name:"Confluence Boss", desc:"Bot agreement check"}
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

function atr(highs, lows, closes, period = 14) {
  const trs = [highs[0] - lows[0]];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(highs[i]-lows[i], Math.abs(highs[i]-closes[i-1]), Math.abs(lows[i]-closes[i-1])));
  }
  return ema(trs, period);
}

function sma(data, period) {
  const out = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j];
    out.push(sum / period);
  }
  return out;
}

function findSwings(highs, lows, left = 5, right = 5) {
  const swingHighs = [], swingLows = [];
  for (let i = left; i < highs.length - right; i++) {
    let isHigh = true, isLow = true;
    for (let j = 1; j <= left; j++) {
      if (highs[i] <= highs[i-j]) isHigh = false;
      if (lows[i] >= lows[i-j]) isLow = false;
    }
    for (let j = 1; j <= right; j++) {
      if (highs[i] <= highs[i+j]) isHigh = false;
      if (lows[i] >= lows[i+j]) isLow = false;
    }
    if (isHigh) swingHighs.push({idx:i, price:highs[i]});
    if (isLow) swingLows.push({idx:i, price:lows[i]});
  }
  return {swingHighs, swingLows};
}

async function fetchMassive(symbol, interval = "1d", range = "6mo") {
  const key = localStorage.getItem("massiveApiKey") || "";
  if (!key) throw new Error("No Massive key");
  const found = instruments.find(i => i.ticker.toUpperCase() === symbol.toUpperCase());
  const ticker = found ? found.yahoo.replace("=F","").replace("-USD","") : symbol.toUpperCase();
  let multiplier = 1, timespan = "day";
  if (interval === "1h") { multiplier = 1; timespan = "hour"; }
  else if (interval === "4h") { multiplier = 4; timespan = "hour"; }
  const to = new Date().toISOString().slice(0,10);
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - (range === "6mo" ? 6 : 3));
  const from = fromDate.toISOString().slice(0,10);
  const url = `https://api.massive.com/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=500&apiKey=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Massive failed " + res.status);
  const json = await res.json();
  if (!json.results || !json.results.length) throw new Error("No Massive data");
  const results = json.results;
  const closes = results.map(r => r.c);
  const opens = results.map(r => r.o);
  const highs = results.map(r => r.h);
  const lows = results.map(r => r.l);
  const volumes = results.map(r => r.v || 0);
  return {
    symbol: ticker,
    display: found ? found.ticker : ticker,
    opens, highs, lows, closes, volumes,
    last: closes[closes.length-1],
    prev: closes[closes.length-2] || closes[closes.length-1]
  };
}

async function fetchYahoo(symbol, interval = "1d", range = "6mo") {
  const found = instruments.find(i => i.ticker.toUpperCase() === symbol.toUpperCase());
  const yahooSymbol = found ? found.yahoo : symbol.toUpperCase();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}`;
  const proxy = "https://proxy.cors.dev/";
  const res = await fetch(proxy + url, { credentials: "omit" });
  if (!res.ok) throw new Error("Failed to fetch data (" + res.status + ")");
  const json = await res.json();
  const result = json.chart?.result?.[0];
  if (!result) throw new Error("No data returned for " + yahooSymbol);
  const q = result.indicators.quote[0];
  const closes = q.close.map(v => v ?? null);
  const opens = q.open.map(v => v ?? null);
  const highs = q.high.map(v => v ?? null);
  const lows = q.low.map(v => v ?? null);
  const volumes = q.volume.map(v => v ?? 0);
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] == null) closes[i] = closes[i-1];
    if (opens[i] == null) opens[i] = opens[i-1];
    if (highs[i] == null) highs[i] = highs[i-1];
    if (lows[i] == null) lows[i] = lows[i-1];
  }
  return {
    symbol: yahooSymbol,
    display: found ? found.ticker : yahooSymbol,
    meta: result.meta,
    opens, highs, lows, closes, volumes,
    last: closes[closes.length-1],
    prev: closes[closes.length-2]
  };
}
