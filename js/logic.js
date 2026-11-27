// Domain logic for the Brick Elite flag football stat tracker.
// No DOM, so the scoring rules can be unit tested.

export const STORAGE_KEY = "ffstats.v1";
export const APP_ID = "flag-football-stats";
export const BRICK_ELITE_ID = "brick-elite";
export const BRICK_ELITE_NAME = "Brick Elite";

export const HALVES = [
  { id: "H1", short: "1st", label: "1st Half" },
  { id: "H2", short: "2nd", label: "2nd Half" },
  { id: "OT", short: "OT", label: "Overtime" },
];

export const HALF_IDS = HALVES.map((half) => half.id);

// Team points come only from these events. pass_td is intentionally missing:
// it credits the quarterback and must not add a second 6 when the receiver
// (or rusher) is also given the touchdown.
export const OUR_SCORE = {
  rush_td: 6,
  rec_td: 6,
  def_td: 6,
  conv1: 1,
  conv2: 2,
  safety: 2,
};

export const THEIR_SCORE = {
  opp_td: 6,
  opp_conv1: 1,
  opp_conv2: 2,
  opp_safety: 2,
};

const EVENT_FIELD = {
  comp: "comp",
  incomp: "incomp",
  pass_td: "passTd",
  int_thrown: "intThrown",
  rush: "rush",
  rush_td: "rushTd",
  rec: "rec",
  rec_td: "recTd",
  conv1: "conv1",
  conv2: "conv2",
  safety: "safety",
  flag: "flag",
  sack: "sack",
  int: "int",
  pd: "pd",
  def_td: "defTd",
};

export const EVENT_TYPES = [...Object.keys(EVENT_FIELD), ...Object.keys(THEIR_SCORE)];
const EVENT_SET = new Set(EVENT_TYPES);

export const COUNTING_KEYS = Object.values(EVENT_FIELD);

export const YARD_TYPES = new Set(["rush", "rush_td", "rec", "rec_td"]);

export const YARD_PRESETS = [5, 10, 15, 20, 30];

const YARD_FIELD = {
  rush: "rushYds",
  rush_td: "rushYds",
  rec: "recYds",
  rec_td: "recYds",
};

const YARD_KEYS = ["rushYds", "recYds", "passYds"];

const SHORT_STAT = {
  rush: "Rush",
  rush_td: "Rush TD",
  rec: "Rec",
  rec_td: "Rec TD",
};

export const RATE_KEYS = new Set(["cmpPct"]);

export const DECIMAL_KEYS = new Set(["ydsPerRush", "ydsPerRec"]);

export const TABLE_COLUMNS = [
  { key: "comp", label: "CMP", title: "Completions" },
  { key: "incomp", label: "INC", title: "Incompletions" },
  { key: "att", label: "ATT", title: "Pass attempts (completions + incompletions)" },
  { key: "cmpPct", label: "CMP%", title: "Completion percentage: completions divided by attempts" },
  { key: "passTd", label: "PTD", title: "Passing touchdowns. Credits the quarterback and does not add points." },
  { key: "passYds", label: "PsYd", title: "Passing yards. A 1-point conversion adds 5 and a 2-point conversion adds 10 for the passer. Completions stay one tap and do not ask for yards." },
  { key: "intThrown", label: "INT-", title: "Interceptions thrown" },
  { key: "rush", label: "RSH", title: "Rushes, not including rushing touchdowns" },
  { key: "rushYds", label: "RuYd", title: "Rushing yards, including yards on rushing touchdowns" },
  { key: "ydsPerRush", label: "Y/C", title: "Yards per carry: rushing yards divided by rushes plus rushing touchdowns" },
  { key: "rushTd", label: "RTD", title: "Rushing touchdowns (+6)" },
  { key: "rec", label: "REC", title: "Receptions, not including receiving touchdowns" },
  { key: "recYds", label: "RcYd", title: "Receiving yards, including yards on receiving touchdowns" },
  { key: "ydsPerRec", label: "Y/R", title: "Yards per catch: receiving yards divided by receptions plus receiving touchdowns" },
  { key: "recTd", label: "RCTD", title: "Receiving touchdowns (+6)" },
  { key: "conv1", label: "1PT", title: "1-point conversions (+1)" },
  { key: "conv2", label: "2PT", title: "2-point conversions (+2)" },
  { key: "safety", label: "SAF", title: "Safeties (+2)" },
  { key: "flag", label: "FLG", title: "Flag pulls" },
  { key: "sack", label: "SCK", title: "Sacks" },
  { key: "int", label: "INT", title: "Interceptions caught" },
  { key: "pd", label: "PD", title: "Pass deflections" },
  { key: "defTd", label: "DTD", title: "Defensive touchdowns, including a pick-6 (+6)" },
  { key: "td", label: "TD", title: "Total touchdowns: rushing + receiving + defensive. Passing touchdowns are not included." },
  { key: "pts", label: "PTS", title: "Points: 6 per total touchdown, plus 1-pt, 2-pt, and safety points" },
];

export const STAT_BUTTONS = [
  { type: "comp", group: "Passing", name: "Comp", sub: "catch", aria: "Completion" },
  { type: "incomp", group: "Passing", name: "Inc", sub: "miss", aria: "Incomplete pass" },
  { type: "pass_td", group: "Passing", name: "Pass TD", sub: "QB, no pts", aria: "Passing touchdown", className: "stat-credit" },
  { type: "int_thrown", group: "Passing", name: "INT", sub: "thrown", aria: "Interception thrown" },
  { type: "rush", group: "Rushing / Receiving", name: "Rush", sub: "carry", aria: "Rush" },
  { type: "rush_td", group: "Rushing / Receiving", name: "Rush TD", sub: "+6", aria: "Rushing touchdown", className: "stat-score" },
  { type: "rec", group: "Rushing / Receiving", name: "Rec", sub: "catch", aria: "Reception" },
  { type: "rec_td", group: "Rushing / Receiving", name: "Rec TD", sub: "+6", aria: "Receiving touchdown", className: "stat-score" },
  { type: "conv1", group: "Scoring", name: "1-Pt", sub: "+1", aria: "1 point conversion", className: "stat-score" },
  { type: "conv2", group: "Scoring", name: "2-Pt", sub: "+2", aria: "2 point conversion", className: "stat-score" },
  { type: "safety", group: "Scoring", name: "Safety", sub: "+2", aria: "Safety", className: "stat-score" },
  { type: "flag", group: "Defense", name: "Flag", sub: "pull", aria: "Flag pull" },
  { type: "sack", group: "Defense", name: "Sack", sub: "QB down", aria: "Sack" },
  { type: "int", group: "Defense", name: "INT", sub: "catch", aria: "Interception" },
  { type: "pd", group: "Defense", name: "PD", sub: "breakup", aria: "Pass deflection" },
  { type: "def_td", group: "Defense", name: "Def TD", sub: "pick-6 +6", aria: "Defensive touchdown", className: "stat-score" },
  { type: "opp_td", group: "Opponent", name: "Opp TD", sub: "+6", aria: "Opponent touchdown", className: "stat-opp", opponent: true },
  { type: "opp_conv1", group: "Opponent", name: "Opp 1", sub: "+1", aria: "Opponent 1 point", className: "stat-opp", opponent: true },
  { type: "opp_conv2", group: "Opponent", name: "Opp 2", sub: "+2", aria: "Opponent 2 point", className: "stat-opp", opponent: true },
  { type: "opp_safety", group: "Opponent", name: "Opp Saf", sub: "+2", aria: "Opponent safety", className: "stat-opp", opponent: true },
];

const VIEWS = new Set(["games", "live", "stats", "roster", "box"]);
const CLOCK_CAP_MS = 8 * 60 * 60 * 1000;

export function isOpponentEvent(type) {
  return Object.prototype.hasOwnProperty.call(THEIR_SCORE, type);
}

export function needsYards(type) {
  return YARD_TYPES.has(type);
}

export function isConversion(type) {
  return type === "conv1" || type === "conv2";
}

export function conversionYards(type) {
  if (type === "conv1") return 5;
  if (type === "conv2") return 10;
  return 0;
}

export function sanitizeYards(value) {
  if (value == null || value === "") return 0;
  const n = Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < -99 || rounded > 99) return null;
  return rounded;
}

export function formatYards(yards) {
  const n = Number.isFinite(Number(yards)) ? Math.round(Number(yards)) : 0;
  return `${n > 0 ? "+" : n < 0 ? "" : "+"}${n} yds`;
}

export function uid(prefix) {
  const rnd = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rnd}`;
}

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function clip(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

export function todayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return iso || "";
  const dt = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export function formatTime(ts) {
  if (!ts) return "";
  const dt = new Date(ts);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function halfShort(id) {
  return HALVES.find((half) => half.id === id)?.short || id || "";
}

export function halfName(id) {
  return HALVES.find((half) => half.id === id)?.label || id || "";
}

export function normNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (!/^\d{1,3}$/.test(raw)) return "";
  return String(Number(raw));
}

export function playerName(player) {
  if (!player) return "Unknown player";
  const first = String(player.firstName || "").trim();
  const last = String(player.lastName || "").trim();
  return [first, last].filter(Boolean).join(" ") || "Unnamed";
}

export function chipLabel(player, players) {
  const first = String(player.firstName || "").trim();
  const last = String(player.lastName || "").trim();
  if (!last) return first || "Player";
  if (!first) return last;
  const collisions = (players || []).filter((item) => String(item.lastName || "").trim() === last);
  if (collisions.length > 1) return `${first} ${last[0].toUpperCase()}.`;
  return last;
}

export function playerAria(player) {
  const name = playerName(player);
  const number = normNumber(player.number);
  return number ? `Number ${number}, ${name}` : `No number, ${name}`;
}

export function sortPlayers(players) {
  return [...players].sort((a, b) => {
    const an = normNumber(a.number);
    const bn = normNumber(b.number);
    if (an && bn && an !== bn) return Number(an) - Number(bn);
    if (an && !bn) return -1;
    if (!an && bn) return 1;
    return playerName(a).localeCompare(playerName(b), "en", { sensitivity: "base" });
  });
}

export function duplicateGroups(players) {
  const groups = new Map();
  for (const player of players) {
    const number = normNumber(player.number);
    if (!number) continue;
    if (!groups.has(number)) groups.set(number, []);
    groups.get(number).push(player);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([number, list]) => ({ number, names: list.map(playerName) }));
}

export function versus(game) {
  if (!game) return "";
  return game.homeAway === "away" ? `@ ${game.opponent}` : `vs ${game.opponent}`;
}

export function emptyLine() {
  return {
    comp: 0,
    incomp: 0,
    passTd: 0,
    intThrown: 0,
    rush: 0,
    rushTd: 0,
    rec: 0,
    recTd: 0,
    rushYds: 0,
    recYds: 0,
    passYds: 0,
    conv1: 0,
    conv2: 0,
    safety: 0,
    flag: 0,
    sack: 0,
    int: 0,
    pd: 0,
    defTd: 0,
  };
}

export function applyEvent(line, event, role = "player") {
  if (!line || !event) return;
  if (role === "passer") {
    if (event.convMode === "pass" && isConversion(event.type)) line.passYds += conversionYards(event.type);
    return;
  }
  const field = EVENT_FIELD[event.type];
  if (!field) return;
  line[field] += 1;
  const yardsKey = YARD_FIELD[event.type];
  if (yardsKey) line[yardsKey] += Number(event.yards) || 0;
  if ((event.type === "comp" || event.type === "pass_td") && event.yards) line.passYds += Number(event.yards) || 0;
  if (isConversion(event.type) && event.convMode === "run") line.rushYds += conversionYards(event.type);
  if (isConversion(event.type) && event.convMode === "pass") line.recYds += conversionYards(event.type);
}

export function derive(line) {
  const base = emptyLine();
  for (const key of COUNTING_KEYS) base[key] = Number(line?.[key]) || 0;
  for (const key of YARD_KEYS) base[key] = Number(line?.[key]) || 0;
  base.att = base.comp + base.incomp;
  base.cmpPct = base.att > 0 ? base.comp / base.att : null;
  const carries = base.rush + base.rushTd;
  const catches = base.rec + base.recTd;
  base.ydsPerRush = carries > 0 ? base.rushYds / carries : null;
  base.ydsPerRec = catches > 0 ? base.recYds / catches : null;
  base.td = base.rushTd + base.recTd + base.defTd;
  base.pts = 6 * base.td + base.conv1 + 2 * base.conv2 + 2 * base.safety;
  return base;
}

export function sumLines(lines) {
  const total = emptyLine();
  for (const line of lines) {
    for (const key of COUNTING_KEYS) total[key] += Number(line[key]) || 0;
    for (const key of YARD_KEYS) total[key] += Number(line[key]) || 0;
  }
  return derive(total);
}

export function formatPct(ratio) {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  const rounded = Math.round(ratio * 1000) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}%`;
}

export function formatCount(value) {
  const n = Number(value) || 0;
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatAvg(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

export function formatStat(key, line, mode, gp) {
  if (RATE_KEYS.has(key)) return formatPct(line[key]);
  if (DECIMAL_KEYS.has(key)) return formatAvg(line[key]);
  const value = Number(line[key]) || 0;
  if (mode === "avg") {
    if (!gp) return "—";
    return formatAvg(value / gp);
  }
  return formatCount(value);
}

export function scoreGame(events, gameHalf = "H1") {
  const byHalf = Object.fromEntries(HALF_IDS.map((id) => [id, { us: 0, them: 0 }]));
  for (const event of events || []) {
    const half = byHalf[event.half] ? event.half : "H1";
    if (OUR_SCORE[event.type]) byHalf[half].us += OUR_SCORE[event.type];
    else if (THEIR_SCORE[event.type]) byHalf[half].them += THEIR_SCORE[event.type];
  }
  const total = { us: 0, them: 0 };
  for (const id of HALF_IDS) {
    total.us += byHalf[id].us;
    total.them += byHalf[id].them;
  }
  const showOT = gameHalf === "OT" || (events || []).some((event) => event.half === "OT");
  return { halves: showOT ? HALF_IDS.slice() : ["H1", "H2"], byHalf, total };
}

export function clockElapsed(game, now = Date.now()) {
  const base = Math.max(0, Number(game?.clockMs) || 0);
  const started = Number(game?.clockStartedAt) || 0;
  if (!started) return Math.min(base, CLOCK_CAP_MS);
  return Math.min(base + Math.max(0, now - started), CLOCK_CAP_MS);
}

export function formatClock(ms) {
  const total = Math.max(0, Math.min(Math.floor((Number(ms) || 0) / 1000), 8 * 60 * 60));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function toggleClock(game, now = Date.now()) {
  if (!game) return game;
  if (game.clockStartedAt) {
    game.clockMs = clockElapsed(game, now);
    game.clockStartedAt = null;
    return game;
  }
  game.clockMs = Math.max(0, Number(game.clockMs) || 0);
  game.clockStartedAt = now;
  return game;
}

export function resetClock(game) {
  if (!game) return game;
  game.clockMs = 0;
  game.clockStartedAt = null;
  return game;
}

function conversionName(type) {
  return type === "conv2" ? "2-Pt Conv" : "1-Pt Conv";
}

export function eventLabel(event) {
  if (isConversion(event?.type) && event.convMode === "pass") {
    const yds = conversionYards(event.type);
    return `${conversionName(event.type)} (+${yds} rec yds) from ${event.passerName || "Passer"} (+${yds} pass yds)`;
  }
  if (isConversion(event?.type) && event.convMode === "run") {
    const yds = conversionYards(event.type);
    return `${conversionName(event.type)} run (+${yds} rush yds)`;
  }
  if (needsYards(event?.type)) return `${SHORT_STAT[event.type]} ${formatYards(event.yards)}`;
  return STAT_BUTTONS.find((button) => button.type === event?.type)?.aria || "Event";
}

export function playLine(event, team) {
  const who = eventWho(event, team);
  if (isConversion(event?.type) && event.convMode === "pass") {
    const yds = conversionYards(event.type);
    return `${who} ${conversionName(event.type)} (+${yds} rec yds) from ${passerWho(event, team)} (+${yds} pass yds)`;
  }
  if (isConversion(event?.type) && event.convMode === "run") {
    const yds = conversionYards(event.type);
    return `${who} ${conversionName(event.type)} run (+${yds} rush yds)`;
  }
  if (needsYards(event?.type)) return `${who} ${SHORT_STAT[event.type]} ${formatYards(event.yards)}`;
  return `${who} ${eventLabel(event)}`;
}

export function passerWho(event, team) {
  if (!event?.passerId) return event?.passerName || "Passer";
  const player = team?.players?.find((item) => item.id === event.passerId);
  if (player) return playerName(player);
  return event.passerName || "Passer";
}

export function eventWho(event, team) {
  if (!event || isOpponentEvent(event.type)) return "Opponent";
  const player = team?.players?.find((item) => item.id === event.playerId);
  if (player) {
    const number = normNumber(player.number);
    return `${number ? `#${number} ` : ""}${playerName(player)}`;
  }
  if (event.playerName) {
    const number = normNumber(event.playerNumber);
    return `${number ? `#${number} ` : ""}${event.playerName}`;
  }
  return "Unknown player";
}

function rosterMeta(team, playerId, snapshot) {
  const player = team.players.find((item) => item.id === playerId);
  if (player) {
    return {
      playerId,
      name: playerName(player),
      number: normNumber(player.number),
      removed: false,
    };
  }
  return {
    playerId,
    name: snapshot?.playerName || "Removed player",
    number: normNumber(snapshot?.playerNumber),
    removed: true,
  };
}

export function boxScore(game, team) {
  const rows = new Map();
  for (const player of sortPlayers(team.players)) {
    rows.set(player.id, {
      playerId: player.id,
      name: playerName(player),
      number: normNumber(player.number),
      removed: false,
      ...emptyLine(),
    });
  }
  for (const event of game.events || []) creditEvent(rows, team, event);
  const players = [...rows.values()].map((row) => ({ ...row, ...derive(row) }));
  return { players, totals: sumLines(players), score: scoreGame(game.events, game.half) };
}

export function gamesForTeam(data, teamId) {
  return (data.games || [])
    .filter((game) => game.teamId === teamId)
    .slice()
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || 0) - (a.createdAt || 0));
}

export function seasonForTeam(data, team) {
  const games = (data.games || []).filter((game) => game.teamId === team.id);
  const rows = new Map();
  for (const player of sortPlayers(team.players)) {
    rows.set(player.id, {
      playerId: player.id,
      name: playerName(player),
      number: normNumber(player.number),
      removed: false,
      gp: 0,
      ...emptyLine(),
    });
  }
  let gamesPlayed = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;
  const record = { w: 0, l: 0, t: 0 };
  for (const game of games) {
    if (!game.events?.length) continue;
    gamesPlayed += 1;
    const score = scoreGame(game.events, game.half);
    pointsFor += score.total.us;
    pointsAgainst += score.total.them;
    if (score.total.us > score.total.them) record.w += 1;
    else if (score.total.us < score.total.them) record.l += 1;
    else record.t += 1;
    const seen = new Set();
    for (const event of game.events) creditEvent(rows, team, event, seen);
    for (const id of seen) rows.get(id).gp += 1;
  }
  const players = [...rows.values()].map((row) => ({ ...row, ...derive(row), gp: row.gp }));
  return {
    gamesPlayed,
    gamesScheduled: games.length,
    record,
    pointsFor,
    pointsAgainst,
    players,
    totals: sumLines(players),
  };
}

export function leaderboard(players) {
  const cats = [
    { key: "pts", label: "Points", min: (p) => p.pts > 0, format: (p) => formatCount(p.pts) },
    { key: "td", label: "Total TDs", min: (p) => p.td > 0, format: (p) => formatCount(p.td) },
    { key: "rushYds", label: "Rushing yards", min: (p) => p.rushYds !== 0, format: (p) => formatCount(p.rushYds) },
    { key: "recYds", label: "Receiving yards", min: (p) => p.recYds !== 0, format: (p) => formatCount(p.recYds) },
    { key: "rushTd", label: "Rushing TDs", min: (p) => p.rushTd > 0, format: (p) => formatCount(p.rushTd) },
    { key: "recTd", label: "Receiving TDs", min: (p) => p.recTd > 0, format: (p) => formatCount(p.recTd) },
    { key: "passYds", label: "Passing yards", min: (p) => p.passYds !== 0, format: (p) => formatCount(p.passYds) },
    { key: "passTd", label: "Passing TDs", min: (p) => p.passTd > 0, format: (p) => formatCount(p.passTd) },
    { key: "defTd", label: "Defensive TDs", min: (p) => p.defTd > 0, format: (p) => formatCount(p.defTd) },
    { key: "rec", label: "Receptions", min: (p) => p.rec > 0, format: (p) => formatCount(p.rec) },
    { key: "rush", label: "Rushes", min: (p) => p.rush > 0, format: (p) => formatCount(p.rush) },
    { key: "comp", label: "Completions", min: (p) => p.comp > 0, format: (p) => formatCount(p.comp) },
    { key: "cmpPct", label: "Comp %", min: (p) => p.att >= 1, format: (p) => `${formatPct(p.cmpPct)} · ${formatCount(p.comp)}/${formatCount(p.att)}` },
    { key: "flag", label: "Flag pulls", min: (p) => p.flag > 0, format: (p) => formatCount(p.flag) },
    { key: "sack", label: "Sacks", min: (p) => p.sack > 0, format: (p) => formatCount(p.sack) },
    { key: "int", label: "Interceptions", min: (p) => p.int > 0, format: (p) => formatCount(p.int) },
    { key: "pd", label: "Pass deflections", min: (p) => p.pd > 0, format: (p) => formatCount(p.pd) },
    { key: "intThrown", label: "Interceptions thrown", min: (p) => p.intThrown > 0, format: (p) => formatCount(p.intThrown) },
  ];
  return cats
    .map((cat) => {
      const ranked = players
        .filter(cat.min)
        .sort((a, b) => (b[cat.key] - a[cat.key]) || a.name.localeCompare(b.name));
      const top = ranked.slice(0, 5);
      let lastValue = null;
      let lastRank = 0;
      const rows = top.map((player, index) => {
        const rank = lastValue != null && Math.abs(player[cat.key] - lastValue) < 1e-9 ? lastRank : index + 1;
        lastValue = player[cat.key];
        lastRank = rank;
        return { rank, name: player.name, number: player.number, value: cat.format(player) };
      });
      return { label: cat.label, rows };
    })
    .filter((cat) => cat.rows.length);
}

export function playerGameLog(data, team, playerId) {
  const games = gamesForTeam(data, team.id);
  const log = [];
  for (const game of games) {
    const line = emptyLine();
    let played = false;
    for (const event of game.events || []) {
      if (event.playerId === playerId && !isOpponentEvent(event.type)) {
        applyEvent(line, event);
        played = true;
      }
    }
    if (!played && !game.events?.length) continue;
    log.push({
      gameId: game.id,
      date: game.date,
      opponent: game.opponent,
      homeAway: game.homeAway,
      location: game.location,
      played,
      score: scoreGame(game.events, game.half),
      ...derive(line),
    });
  }
  return log;
}

export function cleanPlayerFields(fields) {
  const firstName = clip(fields.firstName, 40);
  const lastName = clip(fields.lastName, 40);
  const rawNumber = String(fields.number ?? "").trim();
  if (!firstName && !lastName) return { error: "Enter a first or last name." };
  if (rawNumber && !/^\d{1,3}$/.test(rawNumber)) return { error: "Use a jersey number from 0 to 999, or leave it blank." };
  return { value: { firstName, lastName, number: normNumber(rawNumber) } };
}

export function cleanGameFields(fields) {
  const opponent = clip(fields.opponent, 60);
  const date = String(fields.date || "").trim();
  const location = clip(fields.location, 80);
  const homeAway = fields.homeAway === "away" ? "away" : "home";
  if (!opponent) return { error: "Enter the opponent." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Enter the game date." };
  return { value: { opponent, date, location, homeAway } };
}

export function cleanTeamName(name) {
  const cleaned = clip(name, 60);
  if (!cleaned) return { error: "Enter a team name." };
  return { value: cleaned };
}

export function addPlayer(team, fields) {
  const cleaned = cleanPlayerFields(fields);
  if (cleaned.error) return cleaned;
  if (team.players.length >= 80) return { error: "This roster is full." };
  const player = { id: uid("p"), ...cleaned.value };
  team.players.push(player);
  return { player };
}

export function updatePlayer(team, playerId, fields) {
  const cleaned = cleanPlayerFields(fields);
  if (cleaned.error) return cleaned;
  const player = team.players.find((item) => item.id === playerId);
  if (!player) return { error: "That player is no longer on the roster." };
  Object.assign(player, cleaned.value);
  return { player };
}

export function removePlayer(team, playerId) {
  team.players = team.players.filter((player) => player.id !== playerId);
}

export function addTeam(data, name) {
  const cleaned = cleanTeamName(name);
  if (cleaned.error) return cleaned;
  if ((data.teams || []).length >= 12) return { error: "You can keep up to 12 teams." };
  const team = { id: uid("t"), name: cleaned.value, players: [] };
  data.teams.push(team);
  data.activeTeamId = team.id;
  return { team };
}

export function renameTeam(team, name) {
  const cleaned = cleanTeamName(name);
  if (cleaned.error) return cleaned;
  team.name = cleaned.value;
  return { team };
}

export function deleteTeam(data, teamId) {
  if ((data.teams || []).length < 2) return { error: "Keep at least one team." };
  if (!data.teams.some((team) => team.id === teamId)) return { error: "That team is gone." };
  data.teams = data.teams.filter((team) => team.id !== teamId);
  data.games = (data.games || []).filter((game) => game.teamId !== teamId);
  if (data.activeTeamId === teamId) data.activeTeamId = data.teams[0].id;
  if (data.activeGameByTeam) delete data.activeGameByTeam[teamId];
  return { ok: true };
}

export function createGame(data, teamId, fields) {
  const cleaned = cleanGameFields(fields);
  if (cleaned.error) return cleaned;
  const game = {
    id: uid("g"),
    teamId,
    ...cleaned.value,
    half: "H1",
    clockMs: 0,
    clockStartedAt: null,
    createdAt: Date.now(),
    final: false,
    events: [],
  };
  data.games.push(game);
  if (!data.activeGameByTeam) data.activeGameByTeam = {};
  data.activeGameByTeam[teamId] = game.id;
  return { game };
}

export function updateGameMeta(game, fields) {
  const cleaned = cleanGameFields(fields);
  if (cleaned.error) return cleaned;
  Object.assign(game, cleaned.value);
  return { game };
}

export function deleteGame(data, gameId) {
  const game = data.games.find((item) => item.id === gameId);
  data.games = data.games.filter((item) => item.id !== gameId);
  if (game && data.activeGameByTeam?.[game.teamId] === gameId) delete data.activeGameByTeam[game.teamId];
  if (data.boxGameId === gameId) data.boxGameId = null;
}

export function addEvent(game, { type, player, half, yards, convMode, passer }) {
  if (!EVENT_SET.has(type)) return null;
  const opponent = isOpponentEvent(type);
  if (!opponent && !player?.id) return null;
  const tracked = conversionFields(type, player, convMode, passer, yards);
  if (tracked.error) return null;
  const event = {
    id: uid("e"),
    type,
    playerId: opponent ? null : player.id,
    playerName: opponent ? "" : playerName(player),
    playerNumber: opponent ? "" : normNumber(player.number),
    half: HALF_IDS.includes(half) ? half : (HALF_IDS.includes(game.half) ? game.half : "H1"),
    yards: tracked.yards,
    convMode: tracked.convMode,
    passerId: tracked.passerId,
    passerName: tracked.passerName,
    passerNumber: tracked.passerNumber,
    ts: Date.now(),
  };
  game.events.push(event);
  return event;
}

function conversionFields(type, player, convMode, passer, yards) {
  const empty = { yards: null, convMode: null, passerId: null, passerName: "", passerNumber: "" };
  if (needsYards(type)) {
    const clean = sanitizeYards(yards);
    if (clean == null) return { error: true };
    return { ...empty, yards: clean };
  }
  if (type === "comp" || type === "pass_td") {
    if (yards == null || yards === "") return empty;
    const clean = sanitizeYards(yards);
    if (clean == null) return { error: true };
    return { ...empty, yards: clean };
  }
  if (!isConversion(type) || (convMode !== "run" && convMode !== "pass")) return empty;
  if (convMode === "run") return { ...empty, convMode: "run", yards: conversionYards(type) };
  if (!passer?.id || passer.id === player?.id) return { error: true };
  return {
    yards: conversionYards(type),
    convMode: "pass",
    passerId: passer.id,
    passerName: playerName(passer),
    passerNumber: normNumber(passer.number),
  };
}

export function undoLast(game) {
  if (!game.events.length) return null;
  return game.events.pop() || null;
}

export function deleteEvent(game, eventId) {
  const before = game.events.length;
  game.events = game.events.filter((event) => event.id !== eventId);
  return game.events.length !== before;
}

export function updateEvent(game, team, eventId, patch) {
  const event = game.events.find((item) => item.id === eventId);
  if (!event) return { error: "That event is gone." };
  const nextType = patch.type && EVENT_SET.has(patch.type) ? patch.type : event.type;
  const nextHalf = patch.half && HALF_IDS.includes(patch.half) ? patch.half : event.half;
  const player = isOpponentEvent(nextType)
    ? null
    : team.players.find((item) => item.id === patch.playerId) || team.players.find((item) => item.id === event.playerId);
  if (!isOpponentEvent(nextType) && !player) return { error: "Pick a player for that stat." };
  let nextYards = null;
  let convMode = null;
  let passerId = null;
  let passerName = "";
  let passerNumber = "";
  if (needsYards(nextType) || nextType === "comp" || nextType === "pass_td") {
    const raw = patch.yards != null ? patch.yards : event.yards;
    if ((nextType === "comp" || nextType === "pass_td") && (raw == null || raw === "")) nextYards = null;
    else {
      nextYards = sanitizeYards(raw);
      if (nextYards == null) return { error: "Use a whole number of yards from -99 to 99." };
    }
  } else if (isConversion(nextType)) {
    const mode = patch.convMode !== undefined ? patch.convMode : event.convMode;
    if (mode === "run") {
      convMode = "run";
      nextYards = conversionYards(nextType);
    } else if (mode === "pass") {
      const nextPasserId = patch.passerId !== undefined ? patch.passerId : event.passerId;
      const passer = team.players.find((item) => item.id === nextPasserId);
      if (!passer || passer.id === player.id) return { error: "Pick a different player as the passer, or mark it a run." };
      convMode = "pass";
      nextYards = conversionYards(nextType);
      passerId = passer.id;
      passerName = playerName(passer);
      passerNumber = normNumber(passer.number);
    }
  }
  event.type = nextType;
  event.half = nextHalf;
  event.yards = nextYards;
  event.convMode = convMode;
  event.passerId = passerId;
  event.passerName = passerName;
  event.passerNumber = passerNumber;
  if (isOpponentEvent(event.type)) {
    event.playerId = null;
    event.playerName = "";
    event.playerNumber = "";
    return { event };
  }
  event.playerId = player.id;
  event.playerName = playerName(player);
  event.playerNumber = normNumber(player.number);
  return { event };
}

function ensureStatRow(rows, team, playerId, snapshot) {
  if (!playerId) return null;
  if (!rows.has(playerId)) {
    rows.set(playerId, { ...rosterMeta(team, playerId, snapshot), gp: 0, ...emptyLine() });
  }
  return rows.get(playerId);
}

function creditEvent(rows, team, event, seen) {
  if (!event?.playerId || isOpponentEvent(event.type)) return;
  const row = ensureStatRow(rows, team, event.playerId, event);
  applyEvent(row, event);
  if (seen) seen.add(event.playerId);
  if (event.convMode === "pass" && event.passerId && event.passerId !== event.playerId) {
    const passer = ensureStatRow(rows, team, event.passerId, {
      playerName: event.passerName,
      playerNumber: event.passerNumber,
    });
    applyEvent(passer, event, "passer");
    if (seen) seen.add(event.passerId);
  }
}

function seedPlayer(id, firstName) {
  return { id, firstName, lastName: "", number: "" };
}

export const SEED_PLAYERS = [
  seedPlayer("p_keegan", "Keegan"),
  seedPlayer("p_ethan", "Ethan"),
  seedPlayer("p_cal", "Cal"),
  seedPlayer("p_henry", "Henry"),
  seedPlayer("p_will", "Will"),
  seedPlayer("p_santana", "Santana"),
  seedPlayer("p_brody", "Brody"),
  seedPlayer("p_nils", "Nils"),
  seedPlayer("p_gunz", "Gunz"),
  seedPlayer("p_chris", "Chris"),
];

// Future roster updates go here. Each id runs once per phone.
// add inserts a missing player and does not edit someone already on the team.
// fillNumber writes a jersey only when the phone's number is still blank.
// replaceNumber changes a number only when it still equals `from`.
// setName renames a player only when the first and last name still equal `from`.
// Migrations never delete players and never touch saved games.
export const SEED_MIGRATIONS = [
  {
    id: "roster-seed-v1",
    ops: SEED_PLAYERS.map((player) => ({ op: "add", player: { ...player } })),
  },
];

function applySeedOp(team, op) {
  if (!op || typeof op !== "object") return;
  if (op.op === "add") {
    const incoming = op.player;
    const id = clip(incoming?.id, 80);
    if (!id || team.players.some((player) => player.id === id)) return;
    if (team.players.length >= 80) return;
    const cleaned = cleanPlayerFields({
      firstName: incoming.firstName,
      lastName: incoming.lastName,
      number: incoming.number,
    });
    if (cleaned.error) return;
    team.players.push({ id, ...cleaned.value });
    return;
  }
  const player = team.players.find((item) => item.id === op.playerId);
  if (!player) return;
  if (op.op === "fillNumber") {
    if (normNumber(player.number)) return;
    const raw = String(op.number ?? "").trim();
    if (!/^\d{1,3}$/.test(raw)) return;
    player.number = normNumber(raw);
    return;
  }
  if (op.op === "replaceNumber") {
    const from = normNumber(op.from);
    if (normNumber(player.number) !== from) return;
    const raw = String(op.to ?? "").trim();
    if (raw && !/^\d{1,3}$/.test(raw)) return;
    player.number = normNumber(raw);
    return;
  }
  if (op.op === "setName") {
    const from = op.from || {};
    const to = op.to || {};
    if (player.firstName !== clip(from.firstName, 40) || player.lastName !== clip(from.lastName, 40)) return;
    const firstName = clip(to.firstName, 40);
    const lastName = clip(to.lastName, 40);
    if (!firstName && !lastName) return;
    player.firstName = firstName;
    player.lastName = lastName;
  }
}

export function applySeedMigrations(data, migrations = SEED_MIGRATIONS) {
  if (!Array.isArray(data.appliedSeedMigrations)) data.appliedSeedMigrations = [];
  const applied = new Set(data.appliedSeedMigrations);
  const team = (data.teams || []).find((item) => item.id === BRICK_ELITE_ID);
  for (const migration of migrations || []) {
    if (!migration?.id || applied.has(migration.id)) continue;
    if (!team) continue;
    for (const op of migration.ops || []) applySeedOp(team, op);
    data.appliedSeedMigrations.push(migration.id);
    applied.add(migration.id);
  }
  return data;
}

export function defaultData() {
  return {
    version: 1,
    activeTeamId: BRICK_ELITE_ID,
    activeGameByTeam: {},
    lastView: "games",
    theme: null,
    installDismissed: false,
    boxGameId: null,
    appliedSeedMigrations: ["roster-seed-v1"],
    teams: [
      {
        id: BRICK_ELITE_ID,
        name: BRICK_ELITE_NAME,
        players: SEED_PLAYERS.map((player) => ({ ...player })),
      },
    ],
    games: [],
  };
}

function normalizePlayer(player) {
  if (!player || typeof player !== "object") return null;
  const id = clip(player.id, 80);
  if (!id) return null;
  const rawNumber = String(player.number ?? "").trim();
  const number = /^\d{1,3}$/.test(rawNumber) ? normNumber(rawNumber) : "";
  return {
    id,
    firstName: clip(player.firstName, 40),
    lastName: clip(player.lastName, 40),
    number,
  };
}

function normalizeEvent(event) {
  if (!event || typeof event !== "object") return null;
  const type = EVENT_SET.has(event.type) ? event.type : "";
  const id = clip(event.id, 80);
  if (!type || !id) return null;
  const half = HALF_IDS.includes(event.half) ? event.half : "H1";
  const opponent = isOpponentEvent(type);
  const playerId = opponent ? null : clip(event.playerId, 80) || null;
  if (!opponent && !playerId) return null;
  let yards = null;
  let convMode = null;
  let passerId = null;
  let passerName = "";
  let passerNumber = "";
  if (needsYards(type)) yards = sanitizeYards(event.yards) ?? 0;
  else if ((type === "comp" || type === "pass_td") && event.yards != null && event.yards !== "") yards = sanitizeYards(event.yards) ?? 0;
  else if (isConversion(type) && event.convMode === "run") {
    convMode = "run";
    yards = conversionYards(type);
  } else if (isConversion(type) && event.convMode === "pass") {
    passerId = clip(event.passerId, 80) || null;
    if (passerId && passerId !== playerId) {
      convMode = "pass";
      yards = conversionYards(type);
      passerName = clip(event.passerName, 80);
      passerNumber = normNumber(event.passerNumber);
    }
  }
  return {
    id,
    type,
    playerId,
    playerName: opponent ? "" : clip(event.playerName, 80),
    playerNumber: opponent ? "" : normNumber(event.playerNumber),
    half,
    yards,
    convMode,
    passerId,
    passerName,
    passerNumber,
    ts: Number.isFinite(Number(event.ts)) ? Number(event.ts) : Date.now(),
  };
}

function normalizeTeam(team) {
  if (!team || typeof team !== "object") return null;
  const id = clip(team.id, 80);
  const name = clip(team.name, 60);
  if (!id || !name) return null;
  const players = (Array.isArray(team.players) ? team.players : []).map(normalizePlayer).filter(Boolean).slice(0, 80);
  return { id, name, players };
}

function normalizeGame(game, teamIds) {
  if (!game || typeof game !== "object") return null;
  const id = clip(game.id, 80);
  const teamId = clip(game.teamId, 80);
  if (!id || !teamIds.has(teamId)) return null;
  const opponent = clip(game.opponent, 60) || "Opponent";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(game.date || "") ? game.date : todayISO();
  const homeAway = game.homeAway === "away" ? "away" : "home";
  const half = HALF_IDS.includes(game.half) ? game.half : "H1";
  const events = (Array.isArray(game.events) ? game.events : []).map(normalizeEvent).filter(Boolean).slice(0, 5000);
  const clockMs = Math.max(0, Math.min(Number(game.clockMs) || 0, CLOCK_CAP_MS));
  return {
    id,
    teamId,
    opponent,
    date,
    homeAway,
    location: clip(game.location, 80),
    half,
    clockMs,
    clockStartedAt: null,
    createdAt: Number.isFinite(Number(game.createdAt)) ? Number(game.createdAt) : Date.now(),
    final: game.final === true,
    events,
  };
}

export function normalizeData(input) {
  if (!input || typeof input !== "object") return null;
  const source = input.app === APP_ID && input.data && typeof input.data === "object" ? input.data : input;
  if (!Array.isArray(source.teams) || !Array.isArray(source.games)) return null;
  const teams = source.teams.map(normalizeTeam).filter(Boolean).slice(0, 12);
  if (!teams.length) return null;
  const teamIds = new Set(teams.map((team) => team.id));
  const games = source.games.map((game) => normalizeGame(game, teamIds)).filter(Boolean).slice(0, 500);
  const activeTeamId = teamIds.has(source.activeTeamId) ? source.activeTeamId : teams[0].id;
  const activeGameByTeam = {};
  const storedActive = source.activeGameByTeam && typeof source.activeGameByTeam === "object" ? source.activeGameByTeam : {};
  for (const team of teams) {
    const gameId = storedActive[team.id];
    if (typeof gameId === "string" && games.some((game) => game.id === gameId && game.teamId === team.id)) {
      activeGameByTeam[team.id] = gameId;
    }
  }
  const boxGameId = games.some((game) => game.id === source.boxGameId) ? source.boxGameId : null;
  const appliedSeedMigrations = Array.isArray(source.appliedSeedMigrations)
    ? source.appliedSeedMigrations.filter((id) => typeof id === "string" && id.length < 80).slice(0, 100)
    : [];
  const data = {
    version: 1,
    activeTeamId,
    activeGameByTeam,
    lastView: VIEWS.has(source.lastView) ? source.lastView : "games",
    theme: source.theme === "light" || source.theme === "dark" ? source.theme : null,
    installDismissed: Boolean(source.installDismissed),
    boxGameId,
    appliedSeedMigrations,
    teams,
    games,
  };
  applySeedMigrations(data);
  return data;
}

export function loadData(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return { ok: true, fresh: true, data: defaultData() };
  try {
    const data = normalizeData(JSON.parse(raw));
    if (!data) return { ok: false, raw, error: "Saved data could not be read." };
    return { ok: true, fresh: false, data };
  } catch {
    return { ok: false, raw, error: "Saved data could not be read." };
  }
}

export function saveData(storage, data) {
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function exportPayload(data, now = new Date()) {
  return {
    app: APP_ID,
    version: 1,
    exportedAt: now.toISOString(),
    data,
  };
}

export function parseBackup(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { error: "That file isn't valid JSON." };
  }
  if (json && json.app && json.app !== APP_ID) return { error: "That file isn't a flag football stats backup." };
  const data = normalizeData(json);
  if (!data) return { error: "That file isn't a flag football stats backup." };
  const exportedAt = json && json.app === APP_ID && typeof json.exportedAt === "string" ? json.exportedAt : "";
  return { data, exportedAt };
}

function csvCell(value) {
  const raw = String(value ?? "");
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`;
  return safe;
}

function csvLine(cells) {
  return cells.map(csvCell).join(",");
}

function statCells(line, mode, gp) {
  return TABLE_COLUMNS.map((column) => {
    if (RATE_KEYS.has(column.key)) {
      const ratio = line[column.key];
      return ratio == null ? "" : String(Math.round(ratio * 1000) / 10);
    }
    if (DECIMAL_KEYS.has(column.key)) {
      return line[column.key] == null ? "" : formatAvg(line[column.key]);
    }
    const value = Number(line[column.key]) || 0;
    if (mode === "avg") {
      if (!gp) return "";
      return formatAvg(value / gp);
    }
    return formatCount(value);
  });
}

export function gameCsv(team, game, box) {
  const rows = [
    csvLine(["Team", team.name]),
    csvLine(["Opponent", game.opponent]),
    csvLine(["Date", game.date]),
    csvLine(["Home/Away", game.homeAway === "away" ? "Away" : "Home"]),
    csvLine(["Location", game.location || ""]),
    csvLine(["Us", box.score.total.us]),
    csvLine(["Them", box.score.total.them]),
    csvLine(["Status", game.final ? "Final" : "In progress"]),
    "",
    csvLine(["Number", "Player", ...TABLE_COLUMNS.map((column) => column.label)]),
  ];
  for (const player of box.players) {
    rows.push(csvLine([
      player.number,
      player.removed ? `${player.name} (removed)` : player.name,
      ...statCells(player, "totals", 1),
    ]));
  }
  rows.push(csvLine(["", "Totals", ...statCells(box.totals, "totals", 1)]));
  return `\uFEFF${rows.join("\r\n")}\r\n`;
}

export function seasonCsv(team, season) {
  const header = ["Number", "Player", "GP", ...TABLE_COLUMNS.map((column) => column.label)];
  const record = `${season.record.w}-${season.record.l}-${season.record.t}`;
  const rows = [
    csvLine(["Team", team.name]),
    csvLine(["Games played", season.gamesPlayed]),
    csvLine(["Record", record]),
    csvLine(["Points for", season.pointsFor]),
    csvLine(["Points against", season.pointsAgainst]),
    "",
    "Totals",
    csvLine(header),
  ];
  for (const player of season.players) {
    rows.push(csvLine([
      player.number,
      player.removed ? `${player.name} (removed)` : player.name,
      player.gp,
      ...statCells(player, "totals", player.gp),
    ]));
  }
  rows.push(csvLine(["", "Totals", season.gamesPlayed, ...statCells(season.totals, "totals", season.gamesPlayed)]));
  rows.push("");
  rows.push("Per game averages");
  rows.push("Completion percentage stays a season rate (not averaged game by game).");
  rows.push(csvLine(header));
  for (const player of season.players) {
    rows.push(csvLine([
      player.number,
      player.name,
      player.gp,
      ...statCells(player, "avg", player.gp),
    ]));
  }
  rows.push(csvLine(["", "Totals", season.gamesPlayed, ...statCells(season.totals, "avg", season.gamesPlayed)]));
  return `\uFEFF${rows.join("\r\n")}\r\n`;
}

export function slug(value) {
  return String(value || "team").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "team";
}

export function currentTeam(data) {
  return data.teams.find((team) => team.id === data.activeTeamId) || data.teams[0];
}

export function currentGame(data) {
  const team = currentTeam(data);
  const gameId = data.activeGameByTeam?.[team.id];
  if (!gameId) return null;
  const game = data.games.find((item) => item.id === gameId && item.teamId === team.id);
  return game || null;
}
