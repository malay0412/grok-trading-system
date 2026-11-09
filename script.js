// ====================== DATA ======================
const specialistBots = [
    { name: "Structure Bot", job: "Support / Resistance / Zones" },
    { name: "Trend Bot", job: "Daily + 4H + 1H Trend" },
    { name: "Momentum Bot", job: "RSI, ROC, MACD Strength" },
    { name: "Volume Bot", job: "Volume spikes & confirmation" },
    { name: "Breakout Bot", job: "Real vs False Breakouts" },
    { name: "Volatility Bot", job: "ATR & Range Expansion" },
    { name: "Multi-Timeframe Bot", job: "Timeframe Alignment" },
    { name: "Historical Pattern Bot", job: "Last 6-12 Months Patterns" },
    { name: "Swing Bot", job: "Swing Highs & Lows" },
    { name: "Risk Bot", job: "Stop / Target / R:R" },
    { name: "Sentiment Bot", job: "Market Sentiment" },
    { name: "News & Event Bot", job: "High Impact Events" },
    { name: "Correlation Bot", job: "DXY, Gold, Related Markets" },
    { name: "Seasonality Bot", job: "Seasonal Tendencies" },
    { name: "Order Flow Bot", job: "Buying / Selling Pressure" },
    { name: "False Signal Filter", job: "Trap Detection" },
    { name: "Position Sizing Bot", job: "Position Size Suggestion" },
    { name: "Execution Bot", job: "Best Entry Method" }
];

const subBosses = [
    { name: "Data Accuracy Boss", desc: "Checks data consistency & conflicts" },
    { name: "Probability Boss", desc: "Calculates probability (70% filter)" },
    { name: "Risk & Quality Boss", desc: "Risk:Reward and structure quality" },
    { name: "Confluence Boss", desc: "Checks agreement between bots" }
];

// ====================== INIT ======================
function init() {
    const botsContainer = document.getElementById('specialist-bots');
    specialistBots.forEach(bot => {
        const div = document.createElement('div');
        div.className = 'bot-card';
        div.innerHTML = `<div class="bot-name">${bot.name}</div><div class="bot-job">${bot.job}</div>`;
        botsContainer.appendChild(div);
    });

    const subContainer = document.getElementById('sub-bosses');
    subBosses.forEach(boss => {
        const div = document.createElement('div');
        div.className = 'subboss-card';
        div.innerHTML = `<strong>${boss.name}</strong><p>${boss.desc}</p>`;
        subContainer.appendChild(div);
    });

    document.getElementById('analyzeBtn').addEventListener('click', startAnalysis);
    document.getElementById('symbolInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') startAnalysis();
    });
}

// ====================== ANALYSIS SIMULATION ======================
async function startAnalysis() {
    const symbol = document.getElementById('symbolInput').value.trim().toUpperCase() || 'WTI';
    const btn = document.getElementById('analyzeBtn');
    const placeholder = document.getElementById('placeholder');
    const analysisArea = document.getElementById('analysisArea');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const botReports = document.getElementById('botReports');
    const subBossResults = document.getElementById('subBossResults');
    const finalDecision = document.getElementById('finalDecision');

    btn.disabled = true;
    placeholder.classList.add('hidden');
    analysisArea.classList.remove('hidden');
    botReports.innerHTML = '';
    subBossResults.innerHTML = '';
    finalDecision.innerHTML = '';
    progressFill.style.width = '0%';

    // Step 1: Specialist Bots
    progressText.textContent = 'Specialist Bots analyzing...';
    const reports = [];
    
    for (let i = 0; i < specialistBots.length; i++) {
        await sleep(180 + Math.random() * 120);
        const bot = specialistBots[i];
        const verdict = generateVerdict(symbol, bot.name);
        reports.push({ bot: bot.name, ...verdict });

        const item = document.createElement('div');
        item.className = 'report-item';
        item.innerHTML = `
            <span class="name">${bot.name}</span>
            <span class="verdict ${verdict.direction}">${verdict.label}</span>
        `;
        botReports.appendChild(item);
        botReports.scrollTop = botReports.scrollHeight;

        progressFill.style.width = `${((i + 1) / 18) * 55}%`;
    }

    // Step 2: Sub-Bosses
    progressText.textContent = 'Sub-Bosses verifying...';
    await sleep(600);

    const subResults = evaluateSubBosses(reports);
    subResults.forEach(res => {
        const div = document.createElement('div');
        div.className = 'subboss-result';
        div.innerHTML = `
            <div class="title">${res.name}</div>
            <div class="status ${res.approved ? 'approved' : 'rejected'}">
                ${res.approved ? '✓ APPROVED' : '✗ REJECTED'}
            </div>
            <div class="detail">${res.detail}</div>
        `;
        subBossResults.appendChild(div);
    });

    progressFill.style.width = '80%';
    await sleep(700);

    // Step 3: Final Boss
    progressText.textContent = 'Final Boss deciding...';
    progressFill.style.width = '100%';
    await sleep(800);

    const decision = makeFinalDecision(symbol, reports, subResults);
    renderFinalDecision(decision);

    progressText.textContent = 'Analysis Complete';
    btn.disabled = false;
}

function generateVerdict(symbol, botName) {
    // Simulated intelligent-ish verdicts (biased slightly bullish for demo on WTI)
    const rand = Math.random();
    let direction, label;

    if (botName.includes('News') || botName.includes('False Signal')) {
        direction = rand > 0.6 ? 'neutral' : (rand > 0.3 ? 'bullish' : 'bearish');
    } else if (botName.includes('Trend') || botName.includes('Structure') || botName.includes('Momentum')) {
        direction = rand > 0.35 ? 'bullish' : (rand > 0.15 ? 'neutral' : 'bearish');
    } else {
        direction = rand > 0.45 ? 'bullish' : (rand > 0.2 ? 'neutral' : 'bearish');
    }

    if (direction === 'bullish') label = 'Bullish';
    else if (direction === 'bearish') label = 'Bearish';
    else label = 'Neutral';

    return { direction, label };
}

function evaluateSubBosses(reports) {
    const bullishCount = reports.filter(r => r.direction === 'bullish').length;
    const bearishCount = reports.filter(r => r.direction === 'bearish').length;
    const total = reports.length;

    const probability = Math.round(55 + (Math.max(bullishCount, bearishCount) / total) * 40 + (Math.random() * 8 - 4));
    const probApproved = probability >= 70;

    const confluenceApproved = Math.max(bullishCount, bearishCount) >= 9;

    return [
        {
            name: "Data Accuracy Boss",
            approved: true,
            detail: "No major data conflicts detected"
        },
        {
            name: "Probability Boss",
            approved: probApproved,
            detail: `Calculated probability: ${probability}% ${probApproved ? '(Above 70%)' : '(Below 70% - Cancelled)'}`
        },
        {
            name: "Risk & Quality Boss",
            approved: Math.random() > 0.25,
            detail: Math.random() > 0.25 ? "Good structure & acceptable R:R" : "Risk:Reward or structure not ideal"
        },
        {
            name: "Confluence Boss",
            approved: confluenceApproved,
            detail: `${Math.max(bullishCount, bearishCount)} bots agree on direction`
        }
    ];
}

function makeFinalDecision(symbol, reports, subResults) {
    const approvedCount = subResults.filter(r => r.approved).length;
    const bullishCount = reports.filter(r => r.direction === 'bullish').length;
    const bearishCount = reports.filter(r => r.direction === 'bearish').length;

    const probBoss = subResults.find(r => r.name.includes('Probability'));
    const probMatch = probBoss.detail.match(/(\d+)%/);
    const probability = probMatch ? parseInt(probMatch[1]) : 65;

    let bias = 'WAIT';
    let confidence = probability;

    if (approvedCount >= 3 && probability >= 70) {
        if (bullishCount > bearishCount + 3) {
            bias = 'BUY';
        } else if (bearishCount > bullishCount + 3) {
            bias = 'SELL';
        } else {
            bias = 'WAIT';
            confidence = Math.min(confidence, 68);
        }
    } else {
        bias = 'WAIT';
        confidence = Math.min(probability, 64);
    }

    // Generate realistic levels for demo (WTI style)
    const basePrice = symbol === 'WTI' || symbol === 'CL' || symbol === 'CRUDE' ? 87.40 : 100 + Math.random() * 50;
    const entry = bias === 'BUY' ? (basePrice - 0.3).toFixed(2) + ' – ' + (basePrice + 0.2).toFixed(2) :
                  bias === 'SELL' ? (basePrice - 0.2).toFixed(2) + ' – ' + (basePrice + 0.3).toFixed(2) : '—';
    const stop = bias === 'BUY' ? (basePrice - 1.9).toFixed(2) :
                 bias === 'SELL' ? (basePrice + 1.9).toFixed(2) : '—';
    const tp1 = bias === 'BUY' ? (basePrice + 3.1).toFixed(2) :
                bias === 'SELL' ? (basePrice - 3.1).toFixed(2) : '—';
    const tp2 = bias === 'BUY' ? (basePrice + 5.4).toFixed(2) :
                bias === 'SELL' ? (basePrice - 5.4).toFixed(2) : '—';
    const rr = bias !== 'WAIT' ? '1 : 2.7' : '—';

    return {
        symbol,
        bias,
        confidence,
        entry,
        stop,
        tp1,
        tp2,
        rr,
        size: bias === 'WAIT' ? '—' : (confidence > 80 ? 'Normal' : 'Reduced'),
        reasons: bias === 'WAIT' ? 
            ['Insufficient confluence between bots', 'Probability or quality filters not fully met'] :
            [
                'Strong agreement from Structure + Trend + Momentum bots',
                'Volume confirmation present on the breakout',
                'Historical pattern shows similar successful setups'
            ],
        risks: [
            'Possible sudden news / geopolitical event',
            'Nearby opposing liquidity zone'
        ],
        comment: bias === 'WAIT' ?
            'System prefers to stay out. Capital protection first.' :
            `Clean setup detected. Wait for price to reach the entry zone before taking the trade.`
    };
}

function renderFinalDecision(d) {
    const el = document.getElementById('finalDecision');
    el.innerHTML = `
        <h3>Final Boss Decision</h3>
        <div class="decision-grid">
            <div class="decision-item">
                <div class="label">Bias</div>
                <div class="value ${d.bias.toLowerCase()}">${d.bias}</div>
            </div>
            <div class="decision-item">
                <div class="label">Confidence</div>
                <div class="value">${d.confidence}%</div>
            </div>
            <div class="decision-item">
                <div class="label">Instrument</div>
                <div class="value">${d.symbol}</div>
            </div>
            <div class="decision-item">
                <div class="label">Position Size</div>
                <div class="value">${d.size}</div>
            </div>
            <div class="decision-item">
                <div class="label">Entry Zone</div>
                <div class="value">${d.entry}</div>
            </div>
            <div class="decision-item">
                <div class="label">Stop Loss</div>
                <div class="value">${d.stop}</div>
            </div>
            <div class="decision-item">
                <div class="label">Take Profit 1</div>
                <div class="value">${d.tp1}</div>
            </div>
            <div class="decision-item">
                <div class="label">Take Profit 2</div>
                <div class="value">${d.tp2}</div>
            </div>
            <div class="decision-item">
                <div class="label">Risk : Reward</div>
                <div class="value">${d.rr}</div>
            </div>
        </div>

        <div class="reasons">
            <h4>Main Reasons</h4>
            <ul>${d.reasons.map(r => `<li>${r}</li>`).join('')}</ul>
        </div>

        <div class="risks">
            <h4>Biggest Risks</h4>
            <ul>${d.risks.map(r => `<li>${r}</li>`).join('')}</ul>
        </div>

        <div class="final-comment">"${d.comment}"</div>
    `;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Start
init();
