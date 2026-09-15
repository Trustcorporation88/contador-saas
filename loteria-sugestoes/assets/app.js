"use strict";

/**
 * Sugestão de Apostas — Lotofácil & Mega-Sena
 *
 * Busca resultados oficiais (via API pública que espelha dados da Caixa
 * Econômica Federal), calcula frequência histórica das dezenas e gera
 * sugestões de jogos usando diferentes estratégias.
 *
 * Fonte de dados: https://loteriascaixa-api.herokuapp.com
 * (projeto open source: https://github.com/guto-alves/loterias-api)
 */

const API_BASE = "https://loteriascaixa-api.herokuapp.com/api";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

const LOTTERY_CONFIG = {
  megasena: {
    label: "Mega-Sena",
    min: 1,
    max: 60,
    pick: 6,
    ballClass: "",
  },
  lotofacil: {
    label: "Lotofácil",
    min: 1,
    max: 25,
    pick: 15,
    ballClass: "",
  },
};

const state = {
  lottery: "megasena",
  history: {},
  frequency: {},
};

const els = {
  tabs: document.querySelectorAll(".tab"),
  latestResult: document.getElementById("latest-result"),
  statsMeta: document.getElementById("stats-meta"),
  hotNumbers: document.getElementById("hot-numbers"),
  coldNumbers: document.getElementById("cold-numbers"),
  form: document.getElementById("generator-form"),
  qtyInput: document.getElementById("qty-games"),
  strategySelect: document.getElementById("strategy"),
  generateBtn: document.getElementById("generate-btn"),
  generatedGames: document.getElementById("generated-games"),
};

function pad(num) {
  return String(num).padStart(2, "0");
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Falha ao buscar ${url}: HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchLatest(lottery) {
  return fetchJson(`${API_BASE}/${lottery}/latest`);
}

async function fetchHistory(lottery) {
  const cacheKey = `loteria_history_${lottery}`;
  const cachedRaw = localStorage.getItem(cacheKey);

  if (cachedRaw) {
    try {
      const cached = JSON.parse(cachedRaw);
      if (Date.now() - cached.savedAt < CACHE_TTL_MS && Array.isArray(cached.data)) {
        return cached.data;
      }
    } catch (err) {
      // cache corrompido, ignora e busca novamente
    }
  }

  const data = await fetchJson(`${API_BASE}/${lottery}`);
  try {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({ savedAt: Date.now(), data })
    );
  } catch (err) {
    // localStorage cheio ou indisponível — segue sem cache
  }
  return data;
}

function computeFrequency(history, config) {
  const freq = {};
  for (let n = config.min; n <= config.max; n++) {
    freq[n] = 0;
  }

  for (const draw of history) {
    const dezenas = draw.dezenas || [];
    for (const d of dezenas) {
      const n = parseInt(d, 10);
      if (!Number.isNaN(n) && freq[n] !== undefined) {
        freq[n] += 1;
      }
    }
  }

  return freq;
}

function sortedByFrequency(freq, order = "desc") {
  const entries = Object.entries(freq).map(([num, count]) => ({
    num: parseInt(num, 10),
    count,
  }));
  entries.sort((a, b) => (order === "desc" ? b.count - a.count : a.count - b.count));
  return entries;
}

function renderLatestResult(lottery, latest) {
  const config = LOTTERY_CONFIG[lottery];
  const dezenas = (latest.dezenas || []).map((d) => parseInt(d, 10));

  const ballsHtml = dezenas
    .map((n) => `<span class="ball">${pad(n)}</span>`)
    .join("");

  const acumulou = latest.acumulou
    ? "Acumulou! Ninguém acertou as dezenas."
    : "Houve ganhador(es) na faixa principal.";

  els.latestResult.innerHTML = `
    <div class="result-header">
      <h2>${config.label} — Concurso ${latest.concurso}</h2>
      <span class="contest-date">${latest.data}</span>
    </div>
    <div class="balls">${ballsHtml}</div>
    <p class="result-info">${acumulou} Próximo concurso: <strong>${latest.proximoConcurso}</strong>
    (${latest.dataProximoConcurso || "data a confirmar"}), prêmio estimado
    ${formatCurrency(latest.valorEstimadoProximoConcurso)}.</p>
  `;
}

function formatCurrency(value) {
  if (typeof value !== "number") return "não informado";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function renderStats(lottery, history, freq) {
  const config = LOTTERY_CONFIG[lottery];
  const hot = sortedByFrequency(freq, "desc").slice(0, 10);
  const cold = sortedByFrequency(freq, "asc").slice(0, 10);
  const maxCount = hot[0]?.count || 1;

  els.statsMeta.textContent = `Baseado em ${history.length} concursos de ${config.label} já sorteados.`;

  els.hotNumbers.innerHTML = hot
    .map(
      (entry) => `
      <li>
        <strong>${pad(entry.num)}</strong> — ${entry.count}x
        <span class="freq-bar-wrap"><span class="freq-bar" style="width:${(entry.count / maxCount) * 100}%"></span></span>
      </li>`
    )
    .join("");

  els.coldNumbers.innerHTML = cold
    .map(
      (entry) => `
      <li>
        <strong>${pad(entry.num)}</strong> — ${entry.count}x
        <span class="freq-bar-wrap"><span class="freq-bar" style="width:${(entry.count / maxCount) * 100}%"></span></span>
      </li>`
    )
    .join("");
}

function weightedSampleWithoutReplacement(weights, count) {
  const pool = Object.entries(weights).map(([num, weight]) => ({
    num: parseInt(num, 10),
    weight: Math.max(weight, 0.0001),
  }));

  const chosen = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let r = Math.random() * totalWeight;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= pool[idx].weight;
      if (r <= 0) break;
    }
    idx = Math.min(idx, pool.length - 1);
    chosen.push(pool[idx].num);
    pool.splice(idx, 1);
  }
  return chosen;
}

function buildWeights(config, freq, strategy) {
  const weights = {};
  const counts = Object.values(freq);
  const maxCount = Math.max(...counts, 1);
  const minCount = Math.min(...counts, 0);

  for (let n = config.min; n <= config.max; n++) {
    const count = freq[n] ?? 0;
    let weight;
    switch (strategy) {
      case "hot":
        weight = 1 + (count - minCount);
        break;
      case "cold":
        weight = 1 + (maxCount - count);
        break;
      case "balanced": {
        const normalized = maxCount > minCount ? (count - minCount) / (maxCount - minCount) : 0.5;
        weight = 1 + normalized * 0.6; // leve tendência às mais frequentes, sem exagerar
        break;
      }
      case "random":
      default:
        weight = 1;
    }
    weights[n] = weight;
  }
  return weights;
}

function isReasonablyBalanced(numbers, config) {
  const evenCount = numbers.filter((n) => n % 2 === 0).length;
  const ratio = evenCount / numbers.length;
  // aceita jogos com proporção par/ímpar entre 30% e 70%
  return ratio >= 0.3 && ratio <= 0.7;
}

function generateGame(config, freq, strategy) {
  const weights = buildWeights(config, freq, strategy);
  let attempt = 0;
  let numbers;
  do {
    numbers = weightedSampleWithoutReplacement(weights, config.pick);
    attempt += 1;
  } while (strategy === "balanced" && attempt < 12 && !isReasonablyBalanced(numbers, config));

  return numbers.sort((a, b) => a - b);
}

function renderGeneratedGames(games) {
  els.generatedGames.innerHTML = games
    .map(
      (game, idx) => `
      <div class="game-card">
        <span class="game-index">Jogo ${idx + 1}</span>
        <div class="balls">
          ${game.map((n) => `<span class="ball">${pad(n)}</span>`).join("")}
        </div>
      </div>`
    )
    .join("");
}

async function loadLotteryData(lottery) {
  els.latestResult.innerHTML = `<div class="loading">Carregando último resultado de ${LOTTERY_CONFIG[lottery].label}…</div>`;
  els.statsMeta.textContent = "Carregando histórico de concursos…";
  els.hotNumbers.innerHTML = "";
  els.coldNumbers.innerHTML = "";
  els.generatedGames.innerHTML = "";
  els.generateBtn.disabled = true;

  try {
    const [latest, history] = await Promise.all([
      fetchLatest(lottery),
      fetchHistory(lottery),
    ]);

    const config = LOTTERY_CONFIG[lottery];
    const freq = computeFrequency(history, config);

    state.history[lottery] = history;
    state.frequency[lottery] = freq;

    renderLatestResult(lottery, latest);
    renderStats(lottery, history, freq);
    els.generateBtn.disabled = false;
  } catch (err) {
    console.error(err);
    els.latestResult.innerHTML = `<p class="error">Não foi possível carregar os dados agora. Tente novamente em instantes.</p>`;
    els.statsMeta.textContent = "";
  }
}

function handleTabClick(event) {
  const lottery = event.currentTarget.dataset.lottery;
  if (lottery === state.lottery) return;

  state.lottery = lottery;
  els.tabs.forEach((tab) => {
    const isActive = tab.dataset.lottery === lottery;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  const maxQty = LOTTERY_CONFIG[lottery].pick > 6 ? 10 : 20;
  els.qtyInput.max = String(maxQty);

  loadLotteryData(lottery);
}

function handleGenerateSubmit(event) {
  event.preventDefault();
  const lottery = state.lottery;
  const freq = state.frequency[lottery];
  if (!freq) return;

  const config = LOTTERY_CONFIG[lottery];
  const qty = Math.min(Math.max(parseInt(els.qtyInput.value, 10) || 1, 1), 20);
  const strategy = els.strategySelect.value;

  const games = [];
  for (let i = 0; i < qty; i++) {
    games.push(generateGame(config, freq, strategy));
  }

  renderGeneratedGames(games);
}

function init() {
  els.tabs.forEach((tab) => tab.addEventListener("click", handleTabClick));
  els.form.addEventListener("submit", handleGenerateSubmit);
  loadLotteryData(state.lottery);
}

document.addEventListener("DOMContentLoaded", init);
