import {
  HALVES,
  STAT_BUTTONS,
  STORAGE_KEY,
  TABLE_COLUMNS,
  THEIR_SCORE,
  OUR_SCORE,
  addEvent,
  addPlayer,
  addTeam,
  boxScore,
  chipLabel,
  clockElapsed,
  createGame,
  currentGame,
  currentTeam,
  deleteEvent,
  deleteGame,
  deleteTeam,
  duplicateGroups,
  eventLabel,
  eventWho,
  exportPayload,
  formatClock,
  formatCount,
  formatDate,
  formatPct,
  formatStat,
  formatTime,
  gameCsv,
  gamesForTeam,
  halfName,
  halfShort,
  leaderboard,
  needsYards,
  playLine,
  loadData,
  normNumber,
  parseBackup,
  playerAria,
  playerGameLog,
  playerName,
  removePlayer,
  renameTeam,
  resetClock,
  saveData,
  seasonCsv,
  sanitizeYards,
  seasonForTeam,
  slug,
  sortPlayers,
  todayISO,
  toggleClock,
  undoLast,
  updateEvent,
  YARD_PRESETS,
  updateGameMeta,
  updatePlayer,
  versus,
  esc,
} from "./logic.js";
import { activeSubmitUrl } from "./results-config.js";
import { buildPublicResults, mergeQueue, postToResults, publishResults, publishingMode, submissionForGame } from "./publisher.js";

const app = document.querySelector("#app");
const PASSCODE_KEY = "ffstats.passcode";
const QUEUE_KEY = "ffstats.publishQueue";

let data = null;
let ui = freshUi();
let pendingConfirm = null;
let focusSheet = false;
let flashSide = "";
let toastTimer = 0;
let clockTimer = 0;
let resumeClockOnShow = false;

function freshUi() {
  return {
    view: "games",
    sheet: null,
    statsTab: "season",
    avgMode: "totals",
    logPlayerId: "",
    selectedPlayerId: null,
    pendingStat: null,
    toast: "",
    draft: null,
    edit: null,
    confirmBack: null,
    fatal: "",
    pendingSubmitId: null,
  };
}

function boot() {
  const loaded = loadData(localStorage);
  if (!loaded.ok) {
    data = null;
    ui = freshUi();
    ui.fatal = loaded.error || "Saved data could not be read.";
    render();
    return;
  }
  data = loaded.data;
  ui = freshUi();
  if (data.lastView === "box" && data.boxGameId) ui.view = "box";
  else if (["games", "live", "stats", "roster"].includes(data.lastView)) ui.view = data.lastView;
  applyTheme();
  render();
  startClockTicker();
  registerSw();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    if (data && !data.theme) applyTheme();
  });
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", () => freezeRunningClocks());
  window.addEventListener("online", () => {
    flushPublishQueue().then((result) => {
      if (result.sent) toast("Sent saved results to the public page.");
    }).catch(() => {});
  });
  flushPublishQueue().then((result) => {
    if (result.sent) toast("Sent saved results to the public page.");
  }).catch(() => {});
}

function onVisibility() {
  const game = data ? currentGame(data) : null;
  if (!game) return;
  if (document.hidden) {
    if (game.clockStartedAt) {
      game.clockMs = clockElapsed(game);
      game.clockStartedAt = null;
      resumeClockOnShow = true;
      persist();
    }
    return;
  }
  if (resumeClockOnShow) {
    resumeClockOnShow = false;
    game.clockStartedAt = Date.now();
    persist();
    render();
  }
}

function freezeRunningClocks() {
  if (!data) return;
  let changed = false;
  for (const game of data.games) {
    if (!game.clockStartedAt) continue;
    game.clockMs = clockElapsed(game);
    game.clockStartedAt = null;
    changed = true;
  }
  if (changed) saveData(localStorage, data);
}

function applyTheme() {
  const dark = data?.theme === "dark" || (!data?.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#140e0c" : "#f6efe6");
}

function persist() {
  if (!data) return;
  data.lastView = ui.view;
  const running = [];
  const now = Date.now();
  for (const game of data.games) {
    if (!game.clockStartedAt) continue;
    game.clockMs = clockElapsed(game, now);
    game.clockStartedAt = null;
    running.push(game);
  }
  saveData(localStorage, data);
  const resumed = Date.now();
  for (const game of running) game.clockStartedAt = resumed;
}

function toast(message) {
  ui.toast = message;
  render();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (ui.toast === message) {
      ui.toast = "";
      render();
    }
  }, 2600);
}

function startClockTicker() {
  clearInterval(clockTimer);
  clockTimer = setInterval(() => {
    const node = document.querySelector("[data-testid=game-clock]");
    const game = data ? currentGame(data) : null;
    if (!node || !game?.clockStartedAt) return;
    const text = formatClock(clockElapsed(game));
    if (node.textContent !== text) node.textContent = text;
  }, 250);
}

function registerSw() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function findGame(id) {
  return data.games.find((game) => game.id === id) || null;
}

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function syncDraftFromDom() {
  const form = document.querySelector("form[data-draft-form]");
  if (!form || !ui.draft) return;
  for (const [key, value] of new FormData(form).entries()) ui.draft[key] = String(value);
}

function syncEditFields() {
  if (!ui.edit) return;
  const playerSelect = document.querySelector("#edit-player");
  if (playerSelect) ui.edit.playerId = playerSelect.value;
  const yards = document.querySelector("#edit-yards");
  if (yards) ui.edit.yards = yards.value;
}

function duplicateOthers(team, selfId, number) {
  const value = normNumber(number);
  if (!value) return [];
  return team.players.filter((player) => player.id !== selfId && normNumber(player.number) === value);
}

function updateNumberWarning() {
  const input = document.querySelector("#player-number");
  const note = document.querySelector("#number-warning");
  if (!input || !note || !data) return;
  const others = duplicateOthers(currentTeam(data), ui.draft?.playerId || "", input.value);
  if (!others.length) {
    note.hidden = true;
    note.textContent = "";
    return;
  }
  note.hidden = false;
  note.textContent = `Same number as ${others.map(playerName).join(" and ")}. You can still save.`;
}

function render() {
  const scroll = {
    main: app.querySelector(".main")?.scrollTop || 0,
    players: app.querySelector(".player-grid")?.scrollTop || 0,
    live: app.querySelector(".live-scroll")?.scrollTop || 0,
  };
  if (!data) {
    app.className = "app";
    app.innerHTML = renderFatal();
    document.body.classList.remove("sheet-open");
    return;
  }
  applyTheme();
  const view = ui.view === "live" ? renderLive()
    : ui.view === "roster" ? renderRoster()
    : ui.view === "stats" ? renderStats()
    : ui.view === "box" ? renderBox()
    : renderGames();
  app.className = `app${ui.view === "live" ? " is-live" : ""}`;
  app.innerHTML = renderShell(view);
  const main = app.querySelector(".main");
  if (main) main.scrollTop = scroll.main;
  const players = app.querySelector(".player-grid");
  if (players) players.scrollTop = scroll.players;
  const live = app.querySelector(".live-scroll");
  if (live) live.scrollTop = scroll.live;
  document.body.classList.toggle("sheet-open", Boolean(ui.sheet));
  if (focusSheet) {
    focusSheet = false;
    const field = ui.sheet?.type === "yards"
      ? app.querySelector(".sheet")
      : app.querySelector(".sheet input, .sheet select, .sheet");
    field?.focus();
  }
  if (flashSide) {
    app.querySelector(".scoreboard")?.classList.add(flashSide === "them" ? "flash-them" : "flash-us");
    flashSide = "";
  }
  if (ui.sheet?.type === "player") updateNumberWarning();
  app.querySelector(".player.is-on")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  const team = currentTeam(data);
  const labels = { games: "Games", live: "Live", stats: "Stats", roster: "Roster", box: "Box score" };
  document.title = `${labels[ui.view] || "Flag"} · ${team.name}`;
}

function renderFatal() {
  return `<section class="view">
    <h1>Stats couldn't be read</h1>
    <p>${esc(ui.fatal)}</p>
    <p>You can start fresh. The unreadable save stays on this phone as a spare copy.</p>
    <button type="button" class="primary" data-action="reset-save">Start fresh</button>
  </section>`;
}

function renderShell(body) {
  const team = currentTeam(data);
  const dark = document.documentElement.dataset.theme === "dark";
  const modal = ui.sheet ? " inert aria-hidden=\"true\"" : "";
  return `
    <header class="topbar"${modal}>
      <div class="teams" role="group" aria-label="Team">
        ${data.teams.map((item) => `<button type="button" class="team${item.id === team.id ? " is-on" : ""}" data-action="team" data-id="${esc(item.id)}" aria-pressed="${item.id === team.id ? "true" : "false"}">${esc(item.name)}</button>`).join("")}
      </div>
      <button type="button" class="icon-btn" data-action="theme" aria-label="${dark ? "Switch to light mode" : "Switch to dark mode"}">${dark ? sunSvg() : moonSvg()}</button>
    </header>
    <main class="main"${modal}>${body}</main>
    <nav class="nav" aria-label="Sections"${modal}>
      ${navButton("games", "Games", iconGames())}
      ${navButton("live", "Live", iconLive())}
      ${navButton("stats", "Stats", iconStats())}
      ${navButton("roster", "Roster", iconRoster())}
    </nav>
    ${renderSheet()}
    ${ui.toast ? `<div class="toast" role="status">${esc(ui.toast)}</div>` : ""}
  `;
}

function navButton(view, label, icon) {
  const on = ui.view === view;
  return `<button type="button" data-action="nav" data-view="${view}" ${on ? 'aria-current="page"' : ""}>
    ${icon}<span>${label}</span>
  </button>`;
}

function renderInstallBanner() {
  if (data.installDismissed || isStandalone()) return "";
  return `<aside class="banner">
    <p><strong>Keep it on the sideline.</strong> In Safari, tap Share, then Add to Home Screen. Open that icon once while you have service so it still works if the signal drops.</p>
    <button type="button" data-action="dismiss-install">Got it</button>
  </aside>`;
}

function renderDataPanel() {
  const endpoint = publishingMode() === "endpoint";
  const passcode = readPasscode();
  const waiting = readQueue().length;
  return `<section class="panel">
    <h2>Public results</h2>
    <p>${endpoint
      ? "Submit a finished game and it shows up on the public results page. Offline submits wait on this phone and send later."
      : "Submit downloads results.json. Upload that file to GitHub and the public page updates. The one-tap Google Sheet setup is in the README."}</p>
    <div class="stack">
      <button type="button" class="primary" data-action="publish-results">Publish results</button>
      <button type="button" class="secondary" data-action="download-results">Download results file</button>
      ${endpoint ? `<button type="button" class="secondary" data-action="change-passcode">${passcode ? "Change results passcode" : "Set results passcode"}</button>` : ""}
      <a class="secondary block" href="results.html">View public results</a>
      ${waiting ? `<p class="fine">${waiting} update${waiting === 1 ? "" : "s"} waiting to send.</p>` : ""}
    </div>
  </section>
  <section class="panel">
    <h2>Save a copy</h2>
    <p>Stats stay on this phone until you publish. Download a backup before clearing browser data, or to move games to another phone.</p>
    <div class="stack">
      <button type="button" class="primary" data-action="export-json">Download backup</button>
      <button type="button" class="secondary" data-action="import-json">Restore backup</button>
      <button type="button" class="secondary" data-action="export-season">Export season CSV</button>
    </div>
  </section>`;
}

function renderGames() {
  const team = currentTeam(data);
  const games = gamesForTeam(data, team.id);
  const activeId = data.activeGameByTeam?.[team.id];
  const cards = games.length ? games.map((game) => {
    const score = scoreOf(game);
    const started = game.events.length > 0;
    return `<article class="card">
      <div class="card-top">
        <div>
          <p class="card-date">${esc(formatDate(game.date))} · ${game.homeAway === "away" ? "Away" : "Home"} · ${game.final ? "Final" : "In progress"}${activeId === game.id ? " · Current" : ""}</p>
          <h2>${esc(versus(game))}</h2>
          ${game.location ? `<p class="card-loc">${esc(game.location)}</p>` : ""}
        </div>
        <p class="card-score"><span>${started ? score.total.us : "–"}</span><span class="dash">–</span><span>${started ? score.total.them : "–"}</span></p>
      </div>
      <div class="card-actions">
        <button type="button" class="primary" data-action="go-live" data-id="${esc(game.id)}" aria-label="Track this game live">Live</button>
        <button type="button" class="secondary" data-action="open-box" data-id="${esc(game.id)}">Box score</button>
        <button type="button" class="secondary" data-action="edit-game" data-id="${esc(game.id)}" aria-label="Edit ${esc(versus(game))}">Edit</button>
        <button type="button" class="secondary" data-action="delete-game" data-id="${esc(game.id)}" aria-label="Delete ${esc(versus(game))}">Delete</button>
        <button type="button" class="primary wide" data-action="submit-game" data-id="${esc(game.id)}">Submit results</button>
        <button type="button" class="secondary wide" data-action="toggle-final" data-id="${esc(game.id)}" aria-pressed="${game.final ? "true" : "false"}" aria-label="${game.final ? "Mark in progress" : "Mark final"}">${game.final ? "Final" : "In progress"}</button>
      </div>
    </article>`;
  }).join("") : `<p class="empty-copy">No games yet. Start one when you get to the field.</p>`;
  return `<section class="view">
    <h1>Games</h1>
    <p class="lede">${esc(team.name)}</p>
    ${renderInstallBanner()}
    <button type="button" class="primary block" data-action="new-game">New game</button>
    ${cards}
    ${renderDataPanel()}
  </section>`;
}

function scoreOf(game) {
  return boxScore(game, currentTeam(data)).score;
}

function renderLive() {
  const team = currentTeam(data);
  const game = currentGame(data);
  if (!game) {
    const games = gamesForTeam(data, team.id);
    return `<section class="view">
      <h1>Live</h1>
      <p class="lede">Start a game, then tap stats here with one hand.</p>
      <button type="button" class="primary block" data-action="new-game">New game</button>
      <div class="stack">
        ${games.map((item) => `<button type="button" class="secondary" data-action="go-live" data-id="${esc(item.id)}">${esc(versus(item))} · ${esc(formatDate(item.date))}</button>`).join("")}
      </div>
    </section>`;
  }
  const score = scoreOf(game);
  const players = sortPlayers(team.players);
  const selected = players.find((player) => player.id === ui.selectedPlayerId);
  const armed = STAT_BUTTONS.find((button) => button.type === ui.pendingStat);
  let status = "Tap a player, then a stat. Pass TD does not add points.";
  if (selected) {
    const number = normNumber(selected.number);
    status = `Logging ${number ? `#${number} ` : ""}${playerName(selected)}`;
  } else if (armed) status = `${armed.aria} — now tap the player`;
  const running = Boolean(game.clockStartedAt);
  const clockText = formatClock(clockElapsed(game));
  const showReset = running || (Number(game.clockMs) || 0) > 0;
  const newest = game.events.slice().reverse();
  return `<section class="live">
    <h1 class="sr-only">Live stats ${esc(versus(game))}</h1>
    <div class="scoreboard">
      <div class="score-side"><div class="score-num" data-testid="score-us">${score.total.us}</div><div class="score-label">${esc(teamShort(team))}</div></div>
      <div class="score-mid">
        <button type="button" class="clock-face" data-action="toggle-clock" data-testid="game-clock" aria-label="${running ? "Pause clock" : "Start clock"}">${esc(clockText)}</button>
        <div class="score-q" data-testid="half-label">${esc(halfName(game.half))}</div>
        <div class="score-vs">${esc(versus(game))}</div>
      </div>
      <div class="score-side"><div class="score-num" data-testid="score-them">${score.total.them}</div><div class="score-label">Opp</div></div>
    </div>
    <div class="controls">
      <div class="halves" role="group" aria-label="Half">
        ${HALVES.map((half) => `<button type="button" data-action="half" data-half="${half.id}" aria-label="${esc(half.label)}" aria-pressed="${game.half === half.id ? "true" : "false"}" class="${game.half === half.id ? "is-on" : ""}">${esc(half.short)}</button>`).join("")}
      </div>
      ${showReset ? `<button type="button" class="clock-reset" data-action="reset-clock" aria-label="Reset clock">Reset</button>` : ""}
      <button type="button" class="box-jump" data-action="open-box" data-id="${esc(game.id)}" aria-label="Box score">Box</button>
      <button type="button" class="undo" data-action="undo" aria-label="Undo last event"${game.events.length ? "" : " disabled"}>Undo</button>
    </div>
    <div class="status" data-testid="status-line">
      <p>${esc(status)}</p>
      ${selected || armed ? `<button type="button" data-action="clear-selection" aria-label="Clear selection">Clear</button>` : ""}
    </div>
    ${players.length ? "" : `<p class="empty-copy pad">Add players on the Roster tab. Opponent scores still count.</p>`}
    <div class="player-grid" data-testid="player-grid">
      ${players.map((player) => {
        const on = player.id === ui.selectedPlayerId;
        const number = normNumber(player.number);
        return `<button type="button" class="player${on ? " is-on" : ""}" data-action="pick-player" data-id="${esc(player.id)}" aria-label="${esc(playerAria(player))}" aria-pressed="${on ? "true" : "false"}">
          <span class="num">${number ? esc(number) : "—"}</span>
          <span class="nm">${esc(chipLabel(player, players))}</span>
        </button>`;
      }).join("")}
    </div>
    <div class="live-scroll">
      <div class="stat-pad">
        ${renderStatButtons(players)}
      </div>
      <section class="feed" data-testid="feed" aria-label="Play by play">
        <div class="feed-head">
          <h2>Play by play</h2>
          ${newest.length > 2 ? `<button type="button" data-action="show-events">All ${newest.length}</button>` : ""}
        </div>
        ${newest.length ? `<ul class="feed-list">${newest.slice(0, 2).map((event) => renderEvent(event, team)).join("")}</ul>` : `<p class="feed-empty">Stats you tap show up here.</p>`}
      </section>
      <div class="publish-bar">
        <button type="button" class="primary block" data-action="submit-game" data-id="${esc(game.id)}">Submit results</button>
        <p class="fine">${game.final ? "Marked final. " : "In progress. "}${publishingMode() === "endpoint" ? "Submit sends this game to the public page." : "Submit downloads results.json."}${readQueue().length ? ` ${readQueue().length} waiting to send.` : ""}</p>
      </div>
    </div>
  </section>`;
}

function teamShort(team) {
  const name = team?.name || "Us";
  return name.length > 12 ? "Us" : name;
}

function renderStatButtons(players) {
  let html = "";
  let last = "";
  for (const button of STAT_BUTTONS) {
    if (button.group !== last) {
      html += `<h2 class="stat-group">${esc(button.group)}</h2>`;
      last = button.group;
    }
    const armed = ui.pendingStat === button.type;
    const disabled = !players.length && !button.opponent;
    html += `<button type="button" class="stat ${button.className || ""}${armed ? " is-armed" : ""}" data-action="stat" data-stat="${button.type}" aria-label="${esc(button.aria)}" aria-pressed="${armed ? "true" : "false"}"${disabled ? " disabled" : ""}>
      <span class="stat-name">${esc(button.name)}</span>
      <span class="stat-sub">${esc(button.sub)}</span>
    </button>`;
  }
  return html;
}

function renderEvent(event, team) {
  const label = eventLabel(event);
  const who = eventWho(event, team);
  const time = formatTime(event.ts);
  const line = needsYards(event.type) ? playLine(event, team) : `${halfShort(event.half)} · ${label}`;
  const meta = needsYards(event.type)
    ? `${halfShort(event.half)}${time ? ` · ${time}` : ""}`
    : `${who}${time ? ` · ${time}` : ""}`;
  return `<li class="event">
    <div class="event-main">
      <span class="event-k">${esc(line)}</span>
      <span class="event-who">${esc(meta)}</span>
    </div>
    <div class="event-actions">
      <button type="button" data-action="edit-event" data-id="${esc(event.id)}" aria-label="Edit ${esc(label)} by ${esc(who)}">Edit</button>
      <button type="button" data-action="delete-event" data-id="${esc(event.id)}" aria-label="Delete ${esc(label)} by ${esc(who)}">Delete</button>
    </div>
  </li>`;
}

function renderRoster() {
  const team = currentTeam(data);
  const players = sortPlayers(team.players);
  const dups = duplicateGroups(players);
  const list = players.length ? `<ul class="roster">${players.map((player) => {
    const number = normNumber(player.number);
    const shared = number && dups.some((group) => group.number === number);
    return `<li class="roster-row" data-testid="roster-player" data-name="${esc(playerName(player))}">
      <div class="jersey">${number ? esc(number) : "—"}</div>
      <div>
        <p class="pname">${esc(playerName(player))}</p>
        ${shared ? `<p class="warn-inline">Same number as another player</p>` : `<p class="pmeta">${number ? `Jersey ${esc(number)}` : "No number yet"}</p>`}
      </div>
      <div class="roster-actions">
        <button type="button" data-action="edit-player" data-id="${esc(player.id)}" aria-label="Edit ${esc(playerName(player))}">Edit</button>
        <button type="button" data-action="remove-player" data-id="${esc(player.id)}" aria-label="Remove ${esc(playerName(player))}">Remove</button>
      </div>
    </li>`;
  }).join("")}</ul>` : `<p class="empty-copy">No players yet. Add the roster before kickoff.</p>`;
  const banner = dups.map((group) => `<p>#${esc(group.number)} is shared by ${esc(group.names.join(" and "))}.</p>`).join("");
  return `<section class="view">
    <h1>Roster</h1>
    <p class="lede">${esc(team.name)} · ${players.length} ${players.length === 1 ? "player" : "players"}</p>
    <div class="stack">
      <button type="button" class="primary" data-action="add-player">Add player</button>
      <button type="button" class="secondary" data-action="edit-team">Rename team</button>
      <button type="button" class="secondary" data-action="add-team">Add team</button>
      ${data.teams.length > 1 ? `<button type="button" class="secondary" data-action="delete-team">Delete this team</button>` : ""}
    </div>
    ${dups.length ? `<div class="warn-banner" data-testid="dup-banner">${banner}<p>Duplicate numbers are allowed. Change one if it was a typo.</p></div>` : ""}
    ${list}
    <p class="legend">Jersey numbers can stay blank and be filled in later. Renaming a player or adding a number does not erase games.</p>
  </section>`;
}

function renderStats() {
  const team = currentTeam(data);
  const season = seasonForTeam(data, team);
  const tabs = [["season", "Season"], ["leaders", "Leaders"], ["player", "Players"]];
  return `<section class="view">
    <h1>Stats</h1>
    <p class="lede">${esc(team.name)}</p>
    <div class="segment" role="group" aria-label="Stat views">
      ${tabs.map(([id, label]) => `<button type="button" data-action="stats-tab" data-tab="${id}" aria-pressed="${ui.statsTab === id ? "true" : "false"}">${label}</button>`).join("")}
    </div>
    ${ui.statsTab === "leaders" ? renderLeaders(season.players) : ""}
    ${ui.statsTab === "player" ? renderPlayerTab(team, season) : ""}
    ${ui.statsTab === "season" ? renderSeason(season) : ""}
    ${renderDataPanel()}
  </section>`;
}

function metric(id, value, label) {
  return `<div class="metric" data-testid="${id}"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;
}

function renderSeason(season) {
  const { record } = season;
  return `
    <div class="metrics" data-testid="team-metrics">
      ${metric("metric-record", `${record.w}-${record.l}-${record.t}`, "Record")}
      ${metric("metric-pf", String(season.pointsFor), "Points for")}
      ${metric("metric-pa", String(season.pointsAgainst), "Points against")}
      ${metric("metric-gp", String(season.gamesPlayed), "Games")}
    </div>
    <div class="segment slim" role="group" aria-label="Totals or averages">
      <button type="button" data-action="avg-mode" data-mode="totals" aria-pressed="${ui.avgMode !== "avg" ? "true" : "false"}">Totals</button>
      <button type="button" data-action="avg-mode" data-mode="avg" aria-pressed="${ui.avgMode === "avg" ? "true" : "false"}">Per game</button>
    </div>
    ${season.gamesPlayed ? renderStatTable(season.players, season.totals, { mode: ui.avgMode, teamGames: season.gamesPlayed, showGp: true, testid: "season-table" }) : `<p class="empty-copy">No games logged yet.</p>`}
    <p class="legend">TD is rushing + receiving + defensive. Passing touchdowns are listed as PTD and do not add points. Points are 6 per TD, plus 1-pt, 2-pt, and safety. Comp % is completions divided by completions + incompletions. The record includes every game that has stats. The public page only shows games marked final.</p>
  `;
}

function renderLeaders(players) {
  const boards = leaderboard(players);
  if (!boards.length) return `<p class="empty-copy">No stats yet. Track a game and the leaders show up here.</p>`;
  return boards.map((board) => `<section class="panel">
    <h2>${esc(board.label)}</h2>
    <ol class="leaders">
      ${board.rows.map((row) => `<li><span class="rank">${row.rank}</span><span>${row.number ? `<b>#${esc(row.number)}</b> ` : ""}${esc(row.name)}</span><span class="val">${esc(row.value)}</span></li>`).join("")}
    </ol>
  </section>`).join("");
}

function renderPlayerTab(team, season) {
  const players = sortPlayers(team.players);
  if (!players.length) return `<p class="empty-copy">Add players on the Roster tab first.</p>`;
  const selected = players.some((player) => player.id === ui.logPlayerId) ? ui.logPlayerId : players[0].id;
  const seasonRow = season.players.find((player) => player.playerId === selected);
  const summary = seasonRow && seasonRow.gp
    ? `${formatCount(seasonRow.td)} TD, ${formatCount(seasonRow.pts)} pts, ${formatCount(seasonRow.passTd)} pass TD in ${formatCount(seasonRow.gp)} ${seasonRow.gp === 1 ? "game" : "games"}.`
    : "No stats for this player yet.";
  const log = playerGameLog(data, team, selected).filter((game) => game.played);
  const rows = log.map((game) => `<tr>
    <th class="name-col" scope="row"><button type="button" data-action="open-box" data-id="${esc(game.gameId)}">${esc(formatDate(game.date))}<br>${esc(versus(game))}</button></th>
    <td>${game.score.total.us}–${game.score.total.them}</td>
    ${TABLE_COLUMNS.map((column) => `<td data-stat="${column.key}">${esc(formatStat(column.key, game, "totals", 1))}</td>`).join("")}
  </tr>`).join("");
  return `
    <label class="field"><span>Player</span>
      <select id="log-player">
        ${players.map((player) => `<option value="${esc(player.id)}"${player.id === selected ? " selected" : ""}>${esc(playerAria(player))}</option>`).join("")}
      </select>
    </label>
    <p class="lede">${esc(summary)}</p>
    ${log.length ? `<p class="swipe-hint">Swipe sideways for every column.</p><div class="table-wrap" data-testid="player-log"><table>
      <thead><tr><th class="name-col">Game</th><th>Score</th>${TABLE_COLUMNS.map((column) => `<th title="${esc(column.title)}">${esc(column.label)}</th>`).join("")}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>` : `<p class="empty-copy">No game log yet.</p>`}
  `;
}

function renderBox() {
  const team = currentTeam(data);
  const game = data.games.find((item) => item.id === data.boxGameId && item.teamId === team.id);
  if (!game) {
    return `<section class="view"><h1>Box score</h1><p class="empty-copy">Pick a game first.</p><button type="button" class="primary" data-action="nav" data-view="games">Go to games</button></section>`;
  }
  const box = boxScore(game, team);
  return `<section class="view">
    <button type="button" class="back" data-action="back-box">Back</button>
    <h1>${esc(versus(game))}</h1>
    <p class="lede">${esc(formatDate(game.date))} · ${game.homeAway === "away" ? "Away" : "Home"}${game.location ? ` · ${esc(game.location)}` : ""} · ${game.final ? "Final" : "In progress"}</p>
    ${renderHalfTable(box.score)}
    <div class="metrics">
      ${metric("metric-us", String(box.score.total.us), "Us")}
      ${metric("metric-them", String(box.score.total.them), "Opp")}
      ${metric("metric-td", formatCount(box.totals.td), "TDs")}
      ${metric("metric-pts", formatCount(box.totals.pts), "Points")}
    </div>
    ${renderStatTable(box.players, box.totals, { mode: "totals", teamGames: 1, showGp: false, testid: "box-table" })}
    <button type="button" class="secondary block" data-action="export-game" data-id="${esc(game.id)}">Export this game</button>
    <p class="legend">Rush TD, Rec TD, and Def TD add 6. Pass TD credits the quarterback and does not add another 6. Yards on a rush or catch do not change the score. RuYd and RcYd include touchdown plays. Y/C is rushing yards per carry. Y/R is receiving yards per catch.</p>
  </section>`;
}

function renderHalfTable(score) {
  const head = score.halves.map((id) => `<th>${esc(halfShort(id))}</th>`).join("");
  const row = (label, side) => `<tr><th scope="row">${label}</th>${score.halves.map((id) => `<td>${score.byHalf[id][side]}</td>`).join("")}<td>${score.total[side]}</td></tr>`;
  return `<table class="qscore" data-testid="half-score"><thead><tr><th></th>${head}<th>Total</th></tr></thead><tbody>${row("Us", "us")}${row("Them", "them")}</tbody></table>`;
}

function renderStatTable(rows, totals, options) {
  const gpHead = options.showGp ? "<th>GP</th>" : "";
  const head = TABLE_COLUMNS.map((column) => `<th title="${esc(column.title)}">${esc(column.label)}</th>`).join("");
  const body = rows.map((row) => {
    const gpCell = options.showGp ? `<td data-stat="gp">${row.gp}</td>` : "";
    const cells = TABLE_COLUMNS.map((column) => `<td data-stat="${column.key}">${esc(formatStat(column.key, row, options.mode, options.showGp ? row.gp : 1))}</td>`).join("");
    const number = row.number ? `#${row.number} ` : "";
    const removed = row.removed ? " (removed)" : "";
    return `<tr data-player="${esc(row.name)}"><th class="name-col" scope="row">${esc(`${number}${row.name}${removed}`)}</th>${gpCell}${cells}</tr>`;
  }).join("");
  const totalGp = options.showGp ? `<td data-stat="gp">${options.teamGames}</td>` : "";
  const totalCells = TABLE_COLUMNS.map((column) => `<td data-stat="${column.key}">${esc(formatStat(column.key, totals, options.mode, options.showGp ? options.teamGames : 1))}</td>`).join("");
  return `<p class="swipe-hint">Swipe sideways for every column.</p><div class="table-wrap"><table data-testid="${options.testid}">
    <thead><tr><th class="name-col">Player</th>${gpHead}${head}</tr></thead>
    <tbody>${body}<tr data-testid="totals-row" data-player="Totals"><th class="name-col" scope="row">Team</th>${totalGp}${totalCells}</tr></tbody>
  </table></div>`;
}

function renderSheet() {
  const sheet = ui.sheet;
  if (!sheet) return "";
  let title = "";
  let body = "";
  if (sheet.type === "passcode") {
    title = readPasscode() ? "Change results passcode" : "Results passcode";
    body = `<form data-draft-form="passcode" novalidate>
      <p class="fine">This is the code saved on the Google Sheet. It stays on this phone. It is not stored in the app.</p>
      <label class="field"><span>Results passcode</span>
        <input name="passcode" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" required>
      </label>
      <div class="sheet-actions">
        <button type="button" class="secondary" data-action="close-sheet">Cancel</button>
        <button type="submit" class="primary">Save passcode</button>
      </div>
    </form>`;
  } else if (sheet.type === "game") {
    title = ui.draft?.gameId ? "Edit game" : "New game";
    body = renderGameForm();
  } else if (sheet.type === "player") {
    title = ui.draft?.playerId ? "Edit player" : "Add player";
    body = renderPlayerForm();
  } else if (sheet.type === "team") {
    title = ui.draft?.mode === "add" ? "Add team" : "Rename team";
    body = renderTeamForm();
  } else if (sheet.type === "events") {
    title = "Play by play";
    const team = currentTeam(data);
    const game = currentGame(data);
    const events = game ? game.events.slice().reverse() : [];
    body = events.length
      ? `<ul class="feed-list">${events.map((event) => renderEvent(event, team)).join("")}</ul>`
      : `<p class="empty-copy">No events yet.</p>`;
  } else if (sheet.type === "yards") {
    const team = currentTeam(data);
    const player = team.players.find((item) => item.id === sheet.playerId);
    const stat = STAT_BUTTONS.find((button) => button.type === sheet.stat);
    title = `Yards · ${player ? playerName(player) : "Player"}`;
    body = renderYardsForm(stat);
  } else if (sheet.type === "edit") {
    title = "Edit event";
    body = renderEditForm();
  } else if (sheet.type === "confirm") {
    title = sheet.title;
    body = `<p>${esc(sheet.body || "")}</p>
      <div class="sheet-actions">
        <button type="button" class="secondary" data-action="close-sheet">Cancel</button>
        <button type="button" class="${sheet.tone === "danger" ? "danger-btn" : "primary"}" data-action="confirm-yes">${esc(sheet.confirm || "Confirm")}</button>
      </div>`;
  }
  return `<div class="overlay"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1">
    <h2>${esc(title)}</h2>
    ${body}
  </div></div>`;
}

function renderGameForm() {
  const draft = ui.draft || {};
  const home = draft.homeAway !== "away";
  return `<form data-draft-form="game" novalidate>
    <label class="field"><span>Opponent</span><input name="opponent" maxlength="60" required value="${esc(draft.opponent || "")}" autocomplete="organization" autocapitalize="words"></label>
    <label class="field"><span>Date</span><input name="date" type="date" required value="${esc(draft.date || todayISO())}"></label>
    <label class="field"><span>Location or notes <em>optional</em></span><input name="location" maxlength="80" value="${esc(draft.location || "")}" autocomplete="off"></label>
    <input type="hidden" name="homeAway" value="${home ? "home" : "away"}">
    <fieldset class="ha">
      <legend>Home or away</legend>
      <button type="button" data-action="home-away" data-ha="home" aria-pressed="${home ? "true" : "false"}" class="${home ? "is-on" : ""}">Home</button>
      <button type="button" data-action="home-away" data-ha="away" aria-pressed="${home ? "false" : "true"}" class="${home ? "" : "is-on"}">Away</button>
    </fieldset>
    <div class="sheet-actions">
      <button type="button" class="secondary" data-action="close-sheet">Cancel</button>
      <button type="submit" class="primary">${draft.gameId ? "Save game" : "Start game"}</button>
    </div>
  </form>`;
}

function renderPlayerForm() {
  const draft = ui.draft || {};
  const others = duplicateOthers(currentTeam(data), draft.playerId || "", draft.number);
  return `<form data-draft-form="player" novalidate>
    <label class="field"><span>First name</span><input name="firstName" maxlength="40" value="${esc(draft.firstName || "")}" autocomplete="given-name" autocapitalize="words"></label>
    <label class="field"><span>Last name <em>optional</em></span><input name="lastName" maxlength="40" value="${esc(draft.lastName || "")}" autocomplete="family-name" autocapitalize="words"></label>
    <label class="field"><span>Jersey number <em>optional</em></span>
      <input id="player-number" name="number" inputmode="numeric" maxlength="3" value="${esc(draft.number || "")}" placeholder="Add it later if you need to">
    </label>
    <p id="number-warning" class="warn"${others.length ? "" : " hidden"}>${others.length ? esc(`Same number as ${others.map(playerName).join(" and ")}. You can still save.`) : ""}</p>
    <p class="fine">Blank numbers are fine. You can edit a player during the season without losing their stats.</p>
    <div class="sheet-actions">
      <button type="button" class="secondary" data-action="close-sheet">Cancel</button>
      <button type="submit" class="primary">${draft.playerId ? "Save player" : "Add player"}</button>
    </div>
  </form>`;
}

function renderTeamForm() {
  const draft = ui.draft || {};
  return `<form data-draft-form="team" novalidate>
    <label class="field"><span>Team name</span><input name="name" maxlength="60" required value="${esc(draft.name || "")}" autocapitalize="words"></label>
    <div class="sheet-actions">
      <button type="button" class="secondary" data-action="close-sheet">Cancel</button>
      <button type="submit" class="primary">${draft.mode === "add" ? "Add team" : "Save team"}</button>
    </div>
  </form>`;
}

function renderYardsForm(stat) {
  return `<p class="lede">${esc(stat?.name || "Play")}. Tap a gain, 0 to skip, or type a number.</p>
    <div class="yard-grid" role="group" aria-label="Yard presets">
      ${YARD_PRESETS.map((yards) => `<button type="button" data-action="yard-preset" data-yards="${yards}" aria-label="+${yards} yards">+${yards}</button>`).join("")}
      <button type="button" class="yard-zero" data-action="yard-preset" data-yards="0" aria-label="0 yards">0</button>
    </div>
    <form data-draft-form="yards" novalidate>
      <label class="field"><span>Other yards</span>
        <input id="custom-yards" name="yards" inputmode="text" enterkeyhint="done" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="18 or -3">
      </label>
      <div class="sheet-actions">
        <button type="button" class="secondary" data-action="close-sheet">Cancel</button>
        <button type="submit" class="primary">Add yards</button>
      </div>
    </form>`;
}

function renderEditForm() {
  const edit = ui.edit;
  const team = currentTeam(data);
  const opponent = Boolean(THEIR_SCORE[edit.type]);
  const options = sortPlayers(team.players).map((player) => `<option value="${esc(player.id)}"${player.id === edit.playerId ? " selected" : ""}>${esc(playerAria(player))}</option>`).join("");
  return `<form data-edit-form novalidate>
    <div class="edit-stats" role="group" aria-label="Stat">
      ${STAT_BUTTONS.map((button) => `<button type="button" class="stat ${button.className || ""}${edit.type === button.type ? " is-armed" : ""}" data-action="edit-type" data-stat="${button.type}" aria-label="${esc(button.aria)}" aria-pressed="${edit.type === button.type ? "true" : "false"}">
        <span class="stat-name">${esc(button.name)}</span><span class="stat-sub">${esc(button.sub)}</span>
      </button>`).join("")}
    </div>
    ${opponent ? "" : `<label class="field"><span>Player</span><select id="edit-player">${options}</select></label>`}
    ${needsYards(edit.type) ? `<label class="field"><span>Yards</span><input id="edit-yards" name="yards" inputmode="text" enterkeyhint="done" autocomplete="off" value="${esc(edit.yards ?? "0")}" placeholder="12 or -3"></label>` : ""}
    <div class="halves edit-quarters" role="group" aria-label="Half">
      ${HALVES.map((half) => `<button type="button" data-action="edit-half" data-half="${half.id}" aria-label="${esc(half.label)}" aria-pressed="${edit.half === half.id ? "true" : "false"}" class="${edit.half === half.id ? "is-on" : ""}">${esc(half.short)}</button>`).join("")}
    </div>
    <div class="sheet-actions">
      <button type="button" class="secondary" data-action="close-sheet">Cancel</button>
      <button type="submit" class="primary">Save event</button>
    </div>
  </form>`;
}

function closeSheet() {
  if (ui.sheet?.type === "confirm" && ui.confirmBack) {
    pendingConfirm = null;
    ui.sheet = ui.confirmBack;
    ui.confirmBack = null;
    focusSheet = true;
    render();
    return;
  }
  pendingConfirm = null;
  ui.sheet = null;
  ui.draft = null;
  ui.edit = null;
  ui.confirmBack = null;
  ui.pendingSubmitId = null;
  render();
}

function openConfirm(sheet, action, back) {
  pendingConfirm = action;
  ui.confirmBack = back || null;
  ui.sheet = sheet;
  focusSheet = true;
  render();
}

function setTeam(id) {
  if (!data.teams.some((team) => team.id === id) || data.activeTeamId === id) return;
  data.activeTeamId = id;
  ui.selectedPlayerId = null;
  ui.pendingStat = null;
  ui.logPlayerId = "";
  ui.sheet = null;
  ui.draft = null;
  ui.edit = null;
  if (ui.view === "box") ui.view = "games";
  persist();
  render();
}

function setView(view) {
  if (!["games", "live", "stats", "roster"].includes(view)) return;
  ui.view = view;
  ui.sheet = null;
  ui.draft = null;
  ui.edit = null;
  persist();
  render();
}

function openNewGame() {
  ui.draft = { gameId: null, opponent: "", date: todayISO(), homeAway: "home", location: "" };
  ui.sheet = { type: "game" };
  focusSheet = true;
  render();
}

function openEditGame(id) {
  const game = findGame(id);
  if (!game) return;
  ui.draft = { gameId: game.id, opponent: game.opponent, date: game.date, homeAway: game.homeAway, location: game.location || "" };
  ui.sheet = { type: "game" };
  focusSheet = true;
  render();
}

function saveGame() {
  syncDraftFromDom();
  if (ui.draft.gameId) {
    const game = findGame(ui.draft.gameId);
    if (!game) return toast("That game is gone.");
    const result = updateGameMeta(game, ui.draft);
    if (result.error) return toast(result.error);
    ui.sheet = null;
    ui.draft = null;
    persist();
    toast("Game saved.");
    return;
  }
  const result = createGame(data, currentTeam(data).id, ui.draft);
  if (result.error) return toast(result.error);
  ui.sheet = null;
  ui.draft = null;
  ui.view = "live";
  ui.selectedPlayerId = null;
  ui.pendingStat = null;
  persist();
  render();
}

function goLive(id) {
  const game = findGame(id);
  const team = currentTeam(data);
  if (!game || game.teamId !== team.id) return;
  if (!data.activeGameByTeam) data.activeGameByTeam = {};
  data.activeGameByTeam[team.id] = game.id;
  ui.view = "live";
  ui.sheet = null;
  ui.pendingStat = null;
  persist();
  render();
}

function openBox(id) {
  const game = findGame(id);
  if (!game) return;
  data.boxGameId = game.id;
  ui.view = "box";
  ui.sheet = null;
  persist();
  render();
}

function askDeleteGame(id) {
  const game = findGame(id);
  if (!game) return;
  openConfirm({
    type: "confirm",
    title: `Delete ${versus(game)}?`,
    body: `${formatDate(game.date)}. This removes the game and every stat in it.`,
    confirm: "Delete game",
    tone: "danger",
  }, () => {
    deleteGame(data, id);
    if (ui.view === "box") ui.view = "games";
    ui.sheet = null;
    persist();
    toast("Game deleted.");
  });
}

function openPlayerForm(id) {
  const team = currentTeam(data);
  const player = id ? team.players.find((item) => item.id === id) : null;
  ui.draft = player
    ? { playerId: player.id, firstName: player.firstName, lastName: player.lastName, number: player.number }
    : { playerId: null, firstName: "", lastName: "", number: "" };
  ui.sheet = { type: "player" };
  focusSheet = true;
  render();
}

function savePlayer() {
  syncDraftFromDom();
  const team = currentTeam(data);
  const result = ui.draft.playerId ? updatePlayer(team, ui.draft.playerId, ui.draft) : addPlayer(team, ui.draft);
  if (result.error) return toast(result.error);
  ui.sheet = null;
  ui.draft = null;
  persist();
  toast("Roster saved.");
}

function askRemovePlayer(id) {
  const team = currentTeam(data);
  const player = team.players.find((item) => item.id === id);
  if (!player) return;
  openConfirm({
    type: "confirm",
    title: `Remove ${playerName(player)}?`,
    body: "Past games keep the stats already entered for this player.",
    confirm: "Remove player",
    tone: "danger",
  }, () => {
    removePlayer(team, id);
    if (ui.selectedPlayerId === id) ui.selectedPlayerId = null;
    ui.sheet = null;
    persist();
    toast("Player removed.");
  });
}

function openTeamForm(mode) {
  const team = currentTeam(data);
  ui.draft = { mode, name: mode === "add" ? "" : team.name };
  ui.sheet = { type: "team" };
  focusSheet = true;
  render();
}

function saveTeam() {
  syncDraftFromDom();
  if (ui.draft?.mode === "add") {
    const result = addTeam(data, ui.draft.name);
    if (result.error) return toast(result.error);
    ui.selectedPlayerId = null;
    ui.pendingStat = null;
    ui.view = "roster";
    ui.sheet = null;
    ui.draft = null;
    persist();
    toast("Team added.");
    return;
  }
  const result = renameTeam(currentTeam(data), ui.draft?.name || "");
  if (result.error) return toast(result.error);
  ui.sheet = null;
  ui.draft = null;
  persist();
  toast("Team name saved.");
}

function askDeleteTeam() {
  const team = currentTeam(data);
  openConfirm({
    type: "confirm",
    title: `Delete ${team.name}?`,
    body: "This removes the team and its games from this phone.",
    confirm: "Delete team",
    tone: "danger",
  }, () => {
    const result = deleteTeam(data, team.id);
    if (result.error) return toast(result.error);
    ui.selectedPlayerId = null;
    ui.pendingStat = null;
    ui.view = "roster";
    ui.sheet = null;
    persist();
    toast("Team deleted.");
  });
}

function setHalf(half) {
  const game = currentGame(data);
  if (!game || !HALVES.some((item) => item.id === half)) return;
  game.half = half;
  persist();
  render();
}

function onToggleClock() {
  const game = currentGame(data);
  if (!game) return;
  toggleClock(game);
  persist();
  render();
}

function onResetClock() {
  const game = currentGame(data);
  if (!game) return;
  resetClock(game);
  resumeClockOnShow = false;
  persist();
  render();
}

function clearSelection() {
  ui.selectedPlayerId = null;
  ui.pendingStat = null;
  render();
}

function pointsSide(type) {
  if (OUR_SCORE[type]) return "us";
  if (THEIR_SCORE[type]) return "them";
  return "";
}

function openYards(type, player) {
  ui.pendingStat = null;
  if (player) ui.selectedPlayerId = player.id;
  ui.draft = { yards: "" };
  ui.sheet = { type: "yards", stat: type, playerId: player?.id || "" };
  focusSheet = true;
  render();
}

function commitStat(type, player, yards) {
  const game = currentGame(data);
  const spec = STAT_BUTTONS.find((button) => button.type === type);
  if (!game || !spec) return;
  if (needsYards(type) && yards == null) {
    openYards(type, player);
    return;
  }
  const event = addEvent(game, {
    type,
    player: spec.opponent ? null : player,
    half: game.half,
    yards,
  });
  if (!event) {
    toast("Use a whole number of yards from -99 to 99.");
    return;
  }
  ui.pendingStat = null;
  ui.sheet = null;
  ui.draft = null;
  if (!spec.opponent && player) ui.selectedPlayerId = player.id;
  flashSide = pointsSide(type);
  persist();
  render();
}

function saveYards() {
  const sheet = ui.sheet;
  if (sheet?.type !== "yards") return;
  syncDraftFromDom();
  const yards = sanitizeYards(ui.draft?.yards);
  if (yards == null) {
    toast("Use a whole number of yards from -99 to 99.");
    return;
  }
  const player = currentTeam(data).players.find((item) => item.id === sheet.playerId);
  commitStat(sheet.stat, player, yards);
}

function onStat(type) {
  const spec = STAT_BUTTONS.find((button) => button.type === type);
  if (!spec) return;
  if (spec.opponent) {
    commitStat(type, null);
    return;
  }
  const team = currentTeam(data);
  const player = team.players.find((item) => item.id === ui.selectedPlayerId);
  if (!player) {
    ui.pendingStat = ui.pendingStat === type ? null : type;
    render();
    return;
  }
  commitStat(type, player);
}

function onPlayer(id) {
  const team = currentTeam(data);
  const player = team.players.find((item) => item.id === id);
  if (!player) return;
  if (ui.pendingStat) {
    commitStat(ui.pendingStat, player);
    return;
  }
  ui.selectedPlayerId = ui.selectedPlayerId === id ? null : id;
  render();
}

function onUndo() {
  const game = currentGame(data);
  if (!game) return;
  const removed = undoLast(game);
  if (!removed) return;
  flashSide = pointsSide(removed.type);
  persist();
  render();
}

function askDeleteEvent(id) {
  const game = currentGame(data);
  const event = game?.events.find((item) => item.id === id);
  if (!event) return;
  const fromList = ui.sheet?.type === "events";
  openConfirm({
    type: "confirm",
    title: "Delete this event?",
    body: `${halfName(event.half)} · ${eventLabel(event)} · ${eventWho(event, currentTeam(data))}.`,
    confirm: "Delete event",
    tone: "danger",
  }, () => {
    deleteEvent(game, id);
    ui.sheet = fromList ? { type: "events" } : null;
    focusSheet = Boolean(ui.sheet);
    persist();
    render();
  }, fromList ? { type: "events" } : null);
}

function openEdit(id) {
  const game = currentGame(data);
  const event = game?.events.find((item) => item.id === id);
  if (!event) return;
  ui.edit = {
    eventId: event.id,
    type: event.type,
    playerId: event.playerId || "",
    half: event.half,
    yards: event.yards == null ? "" : String(event.yards),
  };
  ui.confirmBack = null;
  ui.sheet = { type: "edit" };
  focusSheet = true;
  render();
}

function saveEdit() {
  syncEditFields();
  const game = currentGame(data);
  const team = currentTeam(data);
  if (!game || !ui.edit) return;
  const result = updateEvent(game, team, ui.edit.eventId, ui.edit);
  if (result.error) return toast(result.error);
  ui.sheet = null;
  ui.edit = null;
  persist();
  toast("Event updated.");
}

function exportSeason() {
  const team = currentTeam(data);
  download(`${slug(team.name)}-season.csv`, seasonCsv(team, seasonForTeam(data, team)), "text/csv;charset=utf-8");
}

function exportGame(id) {
  const team = currentTeam(data);
  const game = findGame(id);
  if (!game) return;
  download(`${slug(team.name)}-vs-${slug(game.opponent)}-${game.date}.csv`, gameCsv(team, game, boxScore(game, team)), "text/csv;charset=utf-8");
}

function exportJson() {
  download("flag-football-stats-backup.json", JSON.stringify(exportPayload(data), null, 2), "application/json");
}

function readPasscode() {
  try { return localStorage.getItem(PASSCODE_KEY) || ""; } catch { return ""; }
}

function writePasscode(value) {
  localStorage.setItem(PASSCODE_KEY, value);
}

function readQueue() {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

function enqueue(body) {
  writeQueue(mergeQueue(readQueue(), body));
}

async function sendQueued(body) {
  const passcode = readPasscode();
  if (!passcode) {
    const error = new Error("Enter the results passcode.");
    error.code = "need-passcode";
    throw error;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const offline = new Error("offline");
    offline.code = "offline";
    throw offline;
  }
  return postToResults({ ...body, passcode });
}

async function flushPublishQueue() {
  if (!activeSubmitUrl() || !data) return { ok: true, sent: 0 };
  const queue = readQueue();
  if (!queue.length) return { ok: true, sent: 0 };
  const remain = [];
  let sent = 0;
  let failure = null;
  for (const body of queue) {
    if (failure) {
      remain.push(body);
      continue;
    }
    try {
      await sendQueued(body);
      sent += 1;
    } catch (error) {
      failure = error;
      remain.push(body);
    }
  }
  writeQueue(remain);
  if (!failure) return { ok: true, sent };
  return { ok: false, sent, code: failure.code || "rejected", message: failure.message };
}

function openPasscodeSheet(gameId) {
  ui.pendingSubmitId = gameId || null;
  ui.draft = { passcode: "" };
  ui.sheet = { type: "passcode" };
  focusSheet = true;
  render();
}

function passcodeMessage(code, fallback) {
  if (code === "offline") return "You're offline. This update is saved on the phone and will send the next time you tap Submit while online.";
  if (code === "setup") return "The Google Sheet does not have a PASSCODE saved yet. Add it in Apps Script project settings, then Submit again.";
  if (code === "passcode" || code === "need-passcode") return "That passcode was not accepted. Tap Change results passcode and try again.";
  return fallback || "Couldn't reach the results page. It is saved on this phone and will send the next time you tap Submit. You can also download the results file.";
}

async function deliver(body) {
  if (!activeSubmitUrl()) return { mode: "file" };
  if (!readPasscode()) {
    const error = new Error("Enter the results passcode.");
    error.code = "need-passcode";
    throw error;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    enqueue(body);
    const error = new Error("offline");
    error.code = "offline";
    throw error;
  }
  const flushed = await flushPublishQueue();
  if (!flushed.ok) {
    enqueue(body);
    const error = new Error(flushed.message || "Couldn't send saved results.");
    error.code = flushed.code || "rejected";
    throw error;
  }
  try {
    await sendQueued(body);
  } catch (error) {
    if (error.code !== "passcode" && error.code !== "need-passcode") enqueue(body);
    throw error;
  }
  return { mode: "endpoint" };
}

function toggleFinal(id) {
  const game = findGame(id);
  if (!game) return;
  if (!game.final && !game.events.length) {
    toast("Enter the stats before marking this game final.");
    return;
  }
  const hiding = game.final === true;
  game.final = !game.final;
  persist();
  render();
  if (!activeSubmitUrl()) {
    toast(game.final ? "Marked final. Tap Submit results to put it on the public page." : "Marked in progress. It stays off the public page until you submit it again.");
    return;
  }
  if (!readPasscode()) {
    toast(game.final ? "Marked final. Set the results passcode, then tap Submit results." : "Marked in progress on this phone. Set the passcode, then Submit to update the public page.");
    return;
  }
  const body = submissionForGame(data, game, hiding);
  deliver(body).then(() => {
    toast(hiding ? "Hidden on the public page." : "This game is on the public page.");
  }).catch((error) => {
    toast(passcodeMessage(error.code, hiding
      ? "Couldn't hide it yet. It will retry the next time you tap Submit results."
      : "Couldn't show it yet. Tap Submit results to try again."));
  });
}

async function submitGame(id) {
  const game = (id && findGame(id)) || currentGame(data);
  if (!game) {
    toast("Open a game before submitting.");
    return;
  }
  if (!game.events.length) {
    toast("Enter the stats before submitting this game.");
    return;
  }
  game.final = true;
  persist();
  render();
  if (!activeSubmitUrl()) {
    try {
      const result = await publishResults(data);
      toast(result.mode === "endpoint"
        ? "Submitted. This game is on the public results page."
        : "Downloaded results.json. Upload that file on GitHub to publish it.");
    } catch (error) {
      toast(error?.message || "Couldn't submit results.");
    }
    return;
  }
  if (!readPasscode()) {
    openPasscodeSheet(game.id);
    return;
  }
  try {
    await deliver(submissionForGame(data, game, false));
    toast("Submitted. This game is on the public results page.");
  } catch (error) {
    if (error.code === "need-passcode" || error.code === "passcode") {
      openPasscodeSheet(game.id);
      toast("That passcode was not accepted. Enter it again.");
      return;
    }
    toast(passcodeMessage(error.code));
  }
}

function savePasscode() {
  syncDraftFromDom();
  const value = String(ui.draft?.passcode || "").trim();
  if (!value) {
    toast("Enter the passcode.");
    return;
  }
  writePasscode(value);
  const pending = ui.pendingSubmitId;
  ui.sheet = null;
  ui.draft = null;
  ui.pendingSubmitId = null;
  if (pending) {
    submitGame(pending);
    return;
  }
  toast("Passcode saved on this phone.");
}

async function publishMarked() {
  const anyFinal = data.games.some((game) => game.final && game.events.length);
  if (!anyFinal) {
    toast("Mark a game final, or tap Submit results after entering stats.");
    return;
  }
  if (activeSubmitUrl() && !readPasscode()) {
    openPasscodeSheet("");
    toast("Enter the results passcode, then tap Publish results.");
    return;
  }
  try {
    const result = await publishResults(data, {
      passcode: readPasscode(),
      hiddenIds: data.games.filter((game) => !game.final).map((game) => game.id),
    });
    toast(result.mode === "endpoint"
      ? "Submitted. Final games are on the public results page."
      : "Downloaded results.json. Upload that file on GitHub to publish it.");
  } catch (error) {
    if (activeSubmitUrl() && error.code !== "passcode" && error.code !== "need-passcode") {
      const payload = buildPublicResults(data);
      enqueue({ ...payload, hiddenIds: data.games.filter((game) => !game.final).map((game) => game.id) });
    }
    if (error.code === "passcode" || error.code === "need-passcode") {
      openPasscodeSheet("");
      toast("That passcode was not accepted. Enter it again.");
      return;
    }
    toast(passcodeMessage(error.code));
  }
}

function downloadPublicFile() {
  const payload = buildPublicResults(data);
  download("results.json", `${JSON.stringify(payload, null, 2)}\n`, "application/json");
  toast("Downloaded results.json.");
}

function pickBackup() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.hidden = true;
  document.body.appendChild(input);
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    let text = "";
    try {
      text = await file.text();
    } catch {
      toast("Couldn't read that file.");
      return;
    }
    const parsed = parseBackup(text);
    if (parsed.error) return toast(parsed.error);
    const when = parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "an unknown time";
    openConfirm({
      type: "confirm",
      title: "Restore this backup?",
      body: `This replaces teams, rosters, and games on this phone with the backup from ${when}.`,
      confirm: "Replace data",
      tone: "danger",
    }, () => {
      data = parsed.data;
      ui.selectedPlayerId = null;
      ui.pendingStat = null;
      ui.logPlayerId = "";
      ui.sheet = null;
      ui.view = data.lastView === "box" && data.boxGameId ? "box" : (["live", "stats", "roster"].includes(data.lastView) ? data.lastView : "games");
      applyTheme();
      persist();
      toast("Backup restored on this phone.");
    });
  };
  input.click();
  setTimeout(() => input.remove(), 60_000);
}

function resetSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) localStorage.setItem(`${STORAGE_KEY}.broken`, raw);
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* keep going */ }
  location.reload();
}

function setHomeAway(value) {
  if (!ui.draft) return;
  const homeAway = value === "away" ? "away" : "home";
  ui.draft.homeAway = homeAway;
  const hidden = document.querySelector('input[name="homeAway"]');
  if (hidden) hidden.value = homeAway;
  document.querySelectorAll("[data-ha]").forEach((button) => {
    const on = button.dataset.ha === homeAway;
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function onClick(event) {
  if (event.target.classList?.contains("overlay")) {
    closeSheet();
    return;
  }
  const el = event.target.closest("[data-action]");
  if (!el || el.disabled) return;
  try {
    const id = el.dataset.id || "";
    switch (el.dataset.action) {
      case "team": setTeam(id); break;
      case "theme": {
        const dark = document.documentElement.dataset.theme === "dark";
        data.theme = dark ? "light" : "dark";
        applyTheme();
        persist();
        render();
        break;
      }
      case "nav": setView(el.dataset.view); break;
      case "dismiss-install": data.installDismissed = true; persist(); render(); break;
      case "new-game": openNewGame(); break;
      case "edit-game": openEditGame(id); break;
      case "delete-game": askDeleteGame(id); break;
      case "go-live": goLive(id); break;
      case "open-box": openBox(id); break;
      case "back-box": ui.view = currentGame(data)?.id === data.boxGameId ? "live" : "games"; persist(); render(); break;
      case "close-sheet": closeSheet(); break;
      case "confirm-yes": {
        const fn = pendingConfirm;
        pendingConfirm = null;
        ui.sheet = null;
        ui.confirmBack = null;
        if (fn) fn();
        else render();
        break;
      }
      case "home-away": setHomeAway(el.dataset.ha); break;
      case "add-player": openPlayerForm(""); break;
      case "edit-player": openPlayerForm(id); break;
      case "remove-player": askRemovePlayer(id); break;
      case "edit-team": openTeamForm("rename"); break;
      case "add-team": openTeamForm("add"); break;
      case "delete-team": askDeleteTeam(); break;
      case "half": setHalf(el.dataset.half); break;
      case "toggle-clock": onToggleClock(); break;
      case "reset-clock": onResetClock(); break;
      case "clear-selection": clearSelection(); break;
      case "stat": onStat(el.dataset.stat); break;
      case "pick-player": onPlayer(id); break;
      case "undo": onUndo(); break;
      case "show-events": ui.sheet = { type: "events" }; focusSheet = true; render(); break;
      case "edit-event": openEdit(id); break;
      case "delete-event": askDeleteEvent(id); break;
      case "edit-type": syncEditFields(); ui.edit.type = el.dataset.stat; if (!needsYards(ui.edit.type)) ui.edit.yards = ""; else if (ui.edit.yards === "") ui.edit.yards = "0"; render(); break;
      case "yard-preset": {
        const sheet = ui.sheet;
        if (sheet?.type !== "yards") break;
        const player = currentTeam(data).players.find((item) => item.id === sheet.playerId);
        const yards = sanitizeYards(el.dataset.yards);
        commitStat(sheet.stat, player, yards);
        break;
      }
      case "edit-half": syncEditFields(); ui.edit.half = el.dataset.half; render(); break;
      case "stats-tab": ui.statsTab = el.dataset.tab; render(); break;
      case "avg-mode": ui.avgMode = el.dataset.mode === "avg" ? "avg" : "totals"; render(); break;
      case "export-json": exportJson(); break;
      case "import-json": pickBackup(); break;
      case "export-season": exportSeason(); break;
      case "export-game": exportGame(id); break;
      case "submit-game": submitGame(id); break;
      case "toggle-final": toggleFinal(id); break;
      case "publish-results": publishMarked(); break;
      case "download-results": downloadPublicFile(); break;
      case "change-passcode": openPasscodeSheet(""); break;
      case "reset-save": resetSave(); break;
      default: break;
    }
  } catch {
    toast("Couldn't save on this phone. Download a backup.");
  }
}

function onInput(event) {
  const target = event.target;
  if (!(ui.draft && target?.name && target.closest("form[data-draft-form]"))) return;
  ui.draft[target.name] = target.value;
  if (target.name === "number") updateNumberWarning();
}

function onChange(event) {
  const target = event.target;
  if (ui.draft && target?.name && target.closest("form[data-draft-form]")) {
    ui.draft[target.name] = target.value;
    if (target.name === "number") updateNumberWarning();
  }
  if (target?.id === "log-player") {
    ui.logPlayerId = target.value;
    render();
  }
}

function onSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !app.contains(form)) return;
  event.preventDefault();
  try {
    if (form.dataset.draftForm === "game") saveGame();
    else if (form.dataset.draftForm === "player") savePlayer();
    else if (form.dataset.draftForm === "team") saveTeam();
    else if (form.dataset.draftForm === "passcode") savePasscode();
    else if (form.dataset.draftForm === "yards") saveYards();
    else if (form.hasAttribute("data-edit-form")) saveEdit();
  } catch {
    toast("Couldn't save on this phone. Download a backup.");
  }
}

function iconGames() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 10h16M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}
function iconLive() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>`;
}
function iconStats() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V10M12 19V5M19 19v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}
function iconRoster() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 19c.8-3 2.8-4.5 5.5-4.5S14.2 16 15 19M17 8.5a2.5 2.5 0 1 1 0 5M16.5 14.6c2.2.3 3.7 1.6 4.3 4.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}
function moonSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.5 3.2a8.2 8.2 0 1 0 5.4 13.8A8.2 8.2 0 0 1 15.5 3.2z"/></svg>`;
}
function sunSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19"/></svg>`;
}

app.addEventListener("click", onClick);
app.addEventListener("input", onInput);
app.addEventListener("change", onChange);
app.addEventListener("submit", onSubmit);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && ui?.sheet) {
    event.preventDefault();
    closeSheet();
  }
});

boot();
