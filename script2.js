function runBots(data) {
  const { closes, highs, lows, volumes } = data;
  const n = closes.length;
  const last = closes[n-1];
  // ... rest of runBots function would go here
  return { bots: {}, score: 0.5 };
}

function evaluateSubBosses(reports) {
  return [
    { name: "Data Accuracy Boss", approved: true, detail: "OK" },
    { name: "Probability Boss", approved: true, detail: "70%+" },
    { name: "Risk & Quality Boss", approved: true, detail: "Good" },
    { name: "Confluence Boss", approved: true, detail: "Agreed" }
  ];
}
