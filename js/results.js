// Read-only public results. Loads JSON from the Apps Script submitUrl when set,
// using JSONP when that host is on another origin, otherwise ./results.json.

import { RESULTS_CONFIG, activeSubmitUrl } from "./results-config.js";
import { esc } from "./logic.js";

const app = document.querySelector("#app");
const COLUMNS = [
  ["comp", "CMP", "Completions"],
  ["incomp", "INC", "Incompletions"],
  ["att", "ATT", "Pass attempts"],
  ["cmpPct", "CMP%", "Completion percentage"],
  ["passTd", "PTD", "Passing touchdowns (no points)"],
  ["intThrown", "INT-", "Interceptions thrown"],
  ["rush", "RSH", "Rushes"],
  ["rushTd", "RTD", "Rushing touchdowns"],
  ["rec", "REC", "Receptions"],
  ["recTd", "RCTD", "Receiving touchdowns"],
  ["conv1", "1PT", "1-point conversions"],
  ["conv2", "2PT", "2-point conversions"],
  ["safety", "SAF", "Safeties"],
  ["flag", "FLG", "Flag pulls"],
  ["sack", "SCK", "Sacks"],
  ["int", "INT", "Interceptions"],
  ["pd", "PD", "Pass deflections"],
  ["defTd", "DTD", "Defensive touchdowns"],
  ["td", "TD", "Total touchdowns"],
  ["pts", "PTS", "Points"],
];

let payload = null;
let teamId = "";
let gameId = "";

function withCacheBust(url) {
  const base = new URL(url, window.location.href);
  base.searchParams.set("t", String(Date.now()));
  return base;
}

function loadJsonp(url) {
  return new Promise((resolve, reject) => {
    const cbName = `ffResults_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("The public results took too long to load."));
    }, 20000);
    function cleanup() {
      clearTimeout(timer);
      try { delete window[cbName]; } catch { /* ignore */ }
      script.remove();
    }
    window[cbName] = (data) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("Couldn't load the public results."));
    };
    const target = withCacheBust(url);
    target.searchParams.set("callback", cbName);
    script.src = target.toString();
    document.head.appendChild(script);
  });
}

async function loadResults() {
  const submitUrl = activeSubmitUrl();
  if (submitUrl) {
    const target = new URL(submitUrl, window.location.href);
    if (target.origin !== window.location.origin) {
      const json = await loadJsonp(submitUrl);
      if (!json || !Array.isArray(json.teams)) throw new Error("shape");
      return json;
    }
    const response = await fetch(withCacheBust(submitUrl), { cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));
    const json = await response.json();
    if (!json || !Array.isArray(json.teams)) throw new Error("shape");
    return json;
  }
  const response = await fetch(withCacheBust(RESULTS_CONFIG.resultsUrl || "./results.json"), { cache: "no-store" });
  if (!response.ok) throw new Error(String(response.status));
  const json = await response.json();
  if (!json || !Array.isArray(json.teams)) throw new Error("shape");
  return json;
}

function currentTeam() {
  return payload?.teams?.find((team) => team.id === teamId) || payload?.teams?.[0] || null;
}

function readHash() {
  const raw = decodeURIComponent((window.location.hash || "").replace(/^#/, ""));
  const [team, game] = raw.split("/").filter(Boolean);
  if (team && payload?.teams?.some((item) => item.id === team)) teamId = team;
  gameId = game || "";
  const teamData = currentTeam();
  if (!teamData?.games?.some((item) => item.id === gameId)) gameId = "";
}

function setHash() {
  const next = gameId ? `#${teamId}/${gameId}` : `#${teamId}`;
  if (window.location.hash !== next) history.replaceState(null, "", next);
}

function versus(game) {
  return game.homeAway === "away" ? `@ ${game.opponent}` : `vs ${game.opponent}`;
}

function resultWord(letter) {
  if (letter === "W") return "Win";
  if (letter === "L") return "Loss";
  return "Tie";
}

function renderTable(players, totals) {
  const head = COLUMNS.map(([, label, title]) => `<th title="${esc(title)}">${esc(label)}</th>`).join("");
  const row = (name, number, stats, attrs) => {
    const who = `${number ? `#${number} ` : ""}${name}`;
    const cells = COLUMNS.map(([key]) => `<td data-stat="${esc(key)}">${esc(stats?.[key] ?? "—")}</td>`).join("");
    return `<tr ${attrs}><th class="name-col" scope="row">${esc(who)}</th>${cells}</tr>`;
  };
  const body = (players || []).map((player) => row(player.name, player.number, player.stats, `data-player="${esc(player.name)}"`)).join("");
  const totalsRow = row("Team", "", totals, 'data-testid="totals-row" data-player="Totals"');
  return `<p class="swipe-hint">Swipe sideways for every column.</p>
    <div class="table-wrap"><table data-testid="public-box">
      <thead><tr><th class="name-col">Player</th>${head}</tr></thead>
      <tbody>${body}${totalsRow}</tbody>
    </table></div>`;
}

function renderHalfTable(game) {
  const halves = game.halves || [];
  const head = halves.map((half) => `<th>${esc(half.label)}</th>`).join("");
  const line = (label, side) => `<tr><th scope="row">${label}</th>${halves.map((half) => `<td>${half[side]}</td>`).join("")}<td>${game[side]}</td></tr>`;
  return `<table class="qscore" data-testid="public-halves"><thead><tr><th></th>${head}<th>Total</th></tr></thead><tbody>${line("Us", "us")}${line("Them", "them")}</tbody></table>`;
}

function renderLeaders(leaders) {
  if (!leaders?.length) return "";
  return `<h2 class="section-title">Season leaders</h2>${leaders.map((board) => `<section class="panel">
    <h3>${esc(board.label)}</h3>
    <ol class="leaders">${board.rows.map((row) => `<li><span class="rank">${row.rank}</span><span>${row.number ? `<b>#${esc(row.number)}</b> ` : ""}${esc(row.name)}</span><span class="val">${esc(row.value)}</span></li>`).join("")}</ol>
  </section>`).join("")}`;
}

function renderGame(team, game) {
  const place = game.homeAway === "away" ? "Away" : "Home";
  return `<section class="view">
    <button type="button" class="back" data-action="back">Back</button>
    <p class="lede">${esc(team.name)}</p>
    <h1>${esc(versus(game))}</h1>
    <p class="lede">${esc(game.dateLabel || game.date || "")} · ${place}${game.location ? ` · ${esc(game.location)}` : ""} · ${esc(resultWord(game.result))}</p>
    ${renderHalfTable(game)}
    <div class="metrics">
      <div class="metric"><b>${esc(String(game.us))}</b><span>Us</span></div>
      <div class="metric"><b>${esc(String(game.them))}</b><span>Opp</span></div>
      <div class="metric"><b>${esc(game.totals?.td ?? "0")}</b><span>TDs</span></div>
      <div class="metric"><b>${esc(game.totals?.pts ?? "0")}</b><span>Points</span></div>
    </div>
    ${renderTable(game.players, game.totals)}
    <p class="legend">Rush, receiving, and defensive touchdowns are worth 6. A passing touchdown credits the quarterback and does not add another 6. Comp % is completions ÷ (completions + incompletions).</p>
  </section>`;
}

function renderList(team) {
  const games = team.games || [];
  const list = games.length ? games.map((game) => `<button type="button" class="card result-card" data-action="open-game" data-id="${esc(game.id)}" aria-label="${esc(`${game.dateLabel || game.date}, ${versus(game)}, ${game.us} to ${game.them}, ${resultWord(game.result)}`)}">
      <div class="card-top">
        <div>
          <p class="card-date">${esc(game.dateLabel || game.date || "")} · ${game.homeAway === "away" ? "Away" : "Home"}</p>
          <h2>${esc(versus(game))}</h2>
          ${game.location ? `<p class="card-loc">${esc(game.location)}</p>` : ""}
        </div>
        <div class="result-side">
          <p class="card-score">${game.us}<span class="dash">–</span>${game.them}</p>
          <p class="result-mark ${esc(game.result)}">${esc(game.result)}</p>
        </div>
      </div>
    </button>`).join("") : `<p class="empty-copy" data-testid="empty-results">No games published yet.</p>`;
  return `<section class="view">
    <h1>Results</h1>
    <p class="lede">${esc(team.name)}</p>
    <div class="metrics" data-testid="public-record">
      <div class="metric"><b>${esc(team.recordLabel || "0-0-0")}</b><span>Record</span></div>
      <div class="metric"><b>${esc(String(team.pointsFor ?? 0))}</b><span>Points for</span></div>
      <div class="metric"><b>${esc(String(team.pointsAgainst ?? 0))}</b><span>Points against</span></div>
      <div class="metric"><b>${games.length}</b><span>Games</span></div>
    </div>
    <h2 class="section-title">Games</h2>
    <div class="stack">${list}</div>
    ${renderLeaders(team.leaders)}
    <p class="fine"><a href="./index.html">Back to the stat tracker</a></p>
  </section>`;
}

function render() {
  const dark = document.documentElement.dataset.theme === "dark";
  if (!payload) {
    app.innerHTML = `<section class="view"><h1>Results</h1><p class="empty-copy">Couldn't load the public results.</p></section>`;
    return;
  }
  const teams = payload.teams || [];
  const team = currentTeam();
  if (!team) {
    app.innerHTML = `<section class="view"><h1>Results</h1><p class="empty-copy" data-testid="empty-results">No games published yet.</p></section>`;
    return;
  }
  const game = gameId ? team.games?.find((item) => item.id === gameId) : null;
  const body = game ? renderGame(team, game) : renderList(team);
  app.innerHTML = `
    <header class="topbar">
      <div class="teams" role="group" aria-label="Team">
        ${teams.map((item) => `<button type="button" class="team${item.id === team.id ? " is-on" : ""}" data-action="team" data-id="${esc(item.id)}" aria-pressed="${item.id === team.id ? "true" : "false"}">${esc(item.name)}</button>`).join("")}
      </div>
      <button type="button" class="icon-btn" data-action="theme" aria-label="${dark ? "Switch to light mode" : "Switch to dark mode"}">${dark ? sunSvg() : moonSvg()}</button>
    </header>
    <main class="main">${body}</main>`;
  document.title = game ? `${versus(game)} · Results` : `Results · ${team.name}`;
}

function sunSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19"/></svg>`;
}
function moonSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.5 3.2a8.2 8.2 0 1 0 5.4 13.8A8.2 8.2 0 0 1 15.5 3.2z"/></svg>`;
}

app.addEventListener("click", (event) => {
  const el = event.target.closest("[data-action]");
  if (!el) return;
  if (el.dataset.action === "team") {
    teamId = el.dataset.id;
    gameId = "";
    setHash();
    render();
  } else if (el.dataset.action === "open-game") {
    gameId = el.dataset.id;
    setHash();
    window.scrollTo(0, 0);
    render();
  } else if (el.dataset.action === "back") {
    gameId = "";
    setHash();
    render();
  } else if (el.dataset.action === "theme") {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("ffstats.resultsTheme", next); } catch { /* ignore */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next === "dark" ? "#140e0c" : "#f6efe6");
    render();
  }
});

window.addEventListener("hashchange", () => {
  readHash();
  render();
});

loadResults().then((json) => {
  payload = json;
  teamId = json.teams[0]?.id || "";
  readHash();
  if (!teamId) teamId = json.teams[0]?.id || "";
  render();
}).catch(() => {
  payload = null;
  render();
});
