import assert from "node:assert/strict";
import test from "node:test";
import {
  BRICK_ELITE_ID,
  SEED_MIGRATIONS,
  SEED_PLAYERS,
  addEvent,
  addTeam,
  applyEvent,
  boxScore,
  chipLabel,
  createGame,
  defaultData,
  deleteEvent,
  deleteGame,
  deleteTeam,
  derive,
  duplicateGroups,
  emptyLine,
  exportPayload,
  formatClock,
  formatPct,
  gameCsv,
  loadData,
  normalizeData,
  parseBackup,
  playerName,
  renameTeam,
  resetClock,
  saveData,
  seasonCsv,
  seasonForTeam,
  scoreGame,
  sortPlayers,
  toggleClock,
  undoLast,
  updateEvent,
  updatePlayer,
} from "../js/logic.js";

function memoryStorage(initial) {
  const map = new Map(initial ? Object.entries(initial) : []);
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

function player(data, id) {
  return data.teams[0].players.find((item) => item.id === id);
}

test("Brick Elite seeds ten players with blank numbers", () => {
  const data = defaultData();
  const team = data.teams[0];
  assert.equal(data.teams.length, 1);
  assert.equal(team.id, BRICK_ELITE_ID);
  assert.equal(team.name, "Brick Elite");
  assert.equal(team.players.length, 10);
  assert.deepEqual(team.players.map((item) => item.firstName), SEED_PLAYERS.map((item) => item.firstName));
  assert.deepEqual(team.players.map((item) => item.number), Array(10).fill(""));
  assert.deepEqual(duplicateGroups(team.players), []);
  assert.deepEqual(sortPlayers(team.players).map(playerName), [
    "Brody", "Cal", "Chris", "Ethan", "Gunz", "Henry", "Keegan", "Nils", "Santana", "Will",
  ]);
  assert.equal(chipLabel(player(data, "p_keegan"), team.players), "Keegan");
  assert.equal(playerName(player(data, "p_gunz")), "Gunz");
});

test("a passing touchdown does not add points until the scoring touchdown is tapped", () => {
  const data = defaultData();
  const team = data.teams[0];
  const { game } = createGame(data, team.id, { opponent: "Rivals", date: "2026-09-12", homeAway: "home", location: "Field 2" });
  const keegan = player(data, "p_keegan");
  const ethan = player(data, "p_ethan");
  addEvent(game, { type: "pass_td", player: keegan, half: "H1" });
  let box = boxScore(game, team);
  assert.equal(box.score.total.us, 0);
  assert.equal(box.players.find((row) => row.name === "Keegan").passTd, 1);
  assert.equal(box.players.find((row) => row.name === "Keegan").pts, 0);

  addEvent(game, { type: "rec_td", player: ethan, half: "H1" });
  box = boxScore(game, team);
  const qb = box.players.find((row) => row.name === "Keegan");
  const receiver = box.players.find((row) => row.name === "Ethan");
  assert.equal(box.score.total.us, 6);
  assert.equal(box.score.total.them, 0);
  assert.equal(box.score.byHalf.H1.us, 6);
  assert.equal(qb.passTd, 1);
  assert.equal(qb.td, 0);
  assert.equal(qb.pts, 0);
  assert.equal(receiver.recTd, 1);
  assert.equal(receiver.td, 1);
  assert.equal(receiver.pts, 6);
  assert.equal(box.totals.td, 1);
  assert.equal(box.totals.pts, 6);
  assert.equal(box.players.reduce((sum, row) => sum + row.pts, 0), box.score.total.us);
});

test("each scoring event adds its points once, split by half", () => {
  const data = defaultData();
  const team = data.teams[0];
  const { game } = createGame(data, team.id, { opponent: "Rivals", date: "2026-09-12", homeAway: "away", location: "" });
  const keegan = player(data, "p_keegan");
  const ethan = player(data, "p_ethan");
  const cal = player(data, "p_cal");
  const henry = player(data, "p_henry");
  const will = player(data, "p_will");
  addEvent(game, { type: "rush_td", player: cal, half: "H1" });
  addEvent(game, { type: "conv1", player: will, half: "H1" });
  addEvent(game, { type: "opp_td", half: "H1" });
  addEvent(game, { type: "opp_conv1", half: "H1" });
  addEvent(game, { type: "pass_td", player: keegan, half: "H2" });
  addEvent(game, { type: "rec_td", player: ethan, half: "H2" });
  addEvent(game, { type: "conv2", player: ethan, half: "H2" });
  addEvent(game, { type: "safety", player: henry, half: "H2" });
  addEvent(game, { type: "def_td", player: santana(data), half: "H2" });
  addEvent(game, { type: "opp_conv2", half: "H2" });
  addEvent(game, { type: "opp_safety", half: "OT" });
  addEvent(game, { type: "comp", player: keegan, half: "OT" });
  addEvent(game, { type: "comp", player: keegan, half: "OT" });
  addEvent(game, { type: "incomp", player: keegan, half: "OT" });
  addEvent(game, { type: "flag", player: henry, half: "OT" });
  addEvent(game, { type: "int_thrown", player: keegan, half: "H1" });
  addEvent(game, { type: "int", player: henry, half: "H2" });

  const box = boxScore(game, team);
  assert.equal(box.score.byHalf.H1.us, 7);
  assert.equal(box.score.byHalf.H1.them, 7);
  assert.equal(box.score.byHalf.H2.us, 16);
  assert.equal(box.score.byHalf.H2.them, 2);
  assert.equal(box.score.byHalf.OT.us, 0);
  assert.equal(box.score.byHalf.OT.them, 2);
  assert.equal(box.score.total.us, 23);
  assert.equal(box.score.total.them, 11);
  assert.deepEqual(box.score.halves, ["H1", "H2", "OT"]);
  assert.equal(box.players.reduce((sum, row) => sum + row.pts, 0), 23);

  const qb = box.players.find((row) => row.name === "Keegan");
  assert.equal(qb.att, 3);
  assert.equal(qb.passTd, 1);
  assert.equal(qb.td, 0);
  assert.equal(qb.pts, 0);
  assert.equal(formatPct(qb.cmpPct), "66.7%");
  assert.equal(formatPct(emptyLine().cmpPct), "—");
  const defense = box.players.find((row) => row.name === "Santana");
  assert.equal(defense.defTd, 1);
  assert.equal(defense.td, 1);
  assert.equal(defense.pts, 6);
  assert.equal(box.players.find((row) => row.name === "Henry").safety, 1);
  assert.equal(box.players.find((row) => row.name === "Henry").pts, 2);
  assert.equal(box.totals.passTd, 1);
  assert.equal(box.totals.td, 3);
});

function santana(data) {
  return player(data, "p_santana");
}

test("undo removes only the last event and edit can turn a pass TD into a score", () => {
  const data = defaultData();
  const team = data.teams[0];
  const { game } = createGame(data, team.id, { opponent: "Rivals", date: "2026-09-19", homeAway: "home", location: "" });
  const keegan = player(data, "p_keegan");
  const ethan = player(data, "p_ethan");
  const pass = addEvent(game, { type: "pass_td", player: keegan, half: "H1" });
  addEvent(game, { type: "opp_td", half: "H2" });
  const undone = undoLast(game);
  assert.equal(undone.type, "opp_td");
  assert.equal(scoreGame(game.events, game.half).total.them, 0);
  updateEvent(game, team, pass.id, { type: "rush_td", playerId: ethan.id, half: "H2" });
  const box = boxScore(game, team);
  assert.equal(box.score.total.us, 6);
  assert.equal(box.score.byHalf.H2.us, 6);
  assert.equal(box.players.find((row) => row.name === "Ethan").rushTd, 1);
  assert.equal(box.players.find((row) => row.name === "Keegan").passTd, 0);
  assert.equal(deleteEvent(game, pass.id), true);
  assert.equal(game.events.length, 0);
  assert.equal(addEvent(game, { type: "not-a-stat", player: keegan }), null);
});

test("season totals, leaders, and games played ignore empty games", () => {
  const data = defaultData();
  const team = data.teams[0];
  const ethan = player(data, "p_ethan");
  const keegan = player(data, "p_keegan");
  const { game: first } = createGame(data, team.id, { opponent: "A", date: "2026-09-05", homeAway: "home", location: "" });
  addEvent(first, { type: "rec_td", player: ethan, half: "H1" });
  addEvent(first, { type: "comp", player: keegan, half: "H1" });
  addEvent(first, { type: "incomp", player: keegan, half: "H1" });
  const { game: second } = createGame(data, team.id, { opponent: "B", date: "2026-09-12", homeAway: "away", location: "" });
  addEvent(second, { type: "opp_td", half: "H1" });
  addEvent(second, { type: "opp_td", half: "H2" });
  addEvent(second, { type: "comp", player: keegan, half: "H2" });
  createGame(data, team.id, { opponent: "Empty", date: "2026-09-19", homeAway: "home", location: "" });
  const season = seasonForTeam(data, team);
  assert.equal(season.gamesPlayed, 2);
  assert.deepEqual(season.record, { w: 1, l: 1, t: 0 });
  assert.equal(season.pointsFor, 6);
  assert.equal(season.pointsAgainst, 12);
  const wr = season.players.find((row) => row.name === "Ethan");
  const qb = season.players.find((row) => row.name === "Keegan");
  assert.equal(wr.gp, 1);
  assert.equal(wr.td, 1);
  assert.equal(wr.pts, 6);
  assert.equal(qb.gp, 2);
  assert.equal(qb.att, 3);
  assert.equal(qb.pts, 0);
  assert.equal(season.totals.td, 1);
  const csv = seasonCsv(team, season);
  assert.match(csv, /Brick Elite/);
  assert.match(csv, /Ethan/);
  assert.match(csv, /1-1-0/);
  assert.match(csv, /Per game averages/);
  const gameExport = gameCsv(team, first, boxScore(first, team));
  assert.match(gameExport, /Ethan/);
  assert.match(gameExport, /Keegan/);
  const planted = createGame(data, team.id, { opponent: "=1+1", date: "2026-09-20", homeAway: "home", location: "" });
  assert.match(gameCsv(team, planted.game, boxScore(planted.game, team)), /'=1\+1/);
});

test("jersey edits and future seed migrations keep games and user-edited fields", () => {
  const data = defaultData();
  const team = data.teams[0];
  updatePlayer(team, "p_keegan", { firstName: "Keegan", lastName: "Glowacki", number: "12" });
  const ethan = player(data, "p_ethan");
  const { game } = createGame(data, team.id, { opponent: "Rivals", date: "2026-09-12", homeAway: "home", location: "Turf" });
  addEvent(game, { type: "rec_td", player: ethan, half: "H1" });
  team.players = team.players.filter((item) => item.id !== "p_chris");
  SEED_MIGRATIONS.push({
    id: "test-roster-update",
    ops: [
      { op: "fillNumber", playerId: "p_keegan", number: "7" },
      { op: "replaceNumber", playerId: "p_keegan", from: "7", to: "8" },
      { op: "fillNumber", playerId: "p_ethan", number: "4" },
      { op: "setName", playerId: "p_keegan", from: { firstName: "Keegan", lastName: "" }, to: { firstName: "K", lastName: "G" } },
      { op: "setName", playerId: "p_ethan", from: { firstName: "Ethan", lastName: "" }, to: { firstName: "Ethan", lastName: "Cole" } },
      { op: "add", player: { id: "p_chris", firstName: "Chris", lastName: "", number: "11" } },
      { op: "add", player: { id: "p_keegan", firstName: "Other", lastName: "Name", number: "99" } },
      { op: "add", player: { id: "p_alex", firstName: "Alex", lastName: "", number: "" } },
    ],
  });
  try {
    const loaded = normalizeData(JSON.parse(JSON.stringify(data)));
    const next = loaded.teams.find((item) => item.id === BRICK_ELITE_ID);
    const keegan = next.players.find((item) => item.id === "p_keegan");
    const loadedEthan = next.players.find((item) => item.id === "p_ethan");
    assert.equal(keegan.firstName, "Keegan");
    assert.equal(keegan.lastName, "Glowacki");
    assert.equal(keegan.number, "12");
    assert.equal(loadedEthan.number, "4");
    assert.equal(loadedEthan.lastName, "Cole");
    assert.equal(next.players.find((item) => item.id === "p_chris").number, "11");
    assert.equal(next.players.find((item) => item.id === "p_alex").firstName, "Alex");
    assert.equal(loaded.games.length, 1);
    assert.equal(loaded.games[0].opponent, "Rivals");
    assert.equal(loaded.games[0].events[0].type, "rec_td");
    assert.equal(loaded.appliedSeedMigrations.includes("test-roster-update"), true);

    const again = normalizeData(JSON.parse(JSON.stringify(loaded)));
    again.teams[0].players = again.teams[0].players.filter((item) => item.id !== "p_alex");
    const kept = normalizeData(JSON.parse(JSON.stringify(again)));
    assert.equal(kept.teams[0].players.some((item) => item.id === "p_alex"), false);
    assert.equal(kept.games[0].events.length, 1);
  } finally {
    SEED_MIGRATIONS.pop();
  }
});

test("deleting a seed player is not undone by the original roster migration", () => {
  const data = defaultData();
  data.teams[0].players = data.teams[0].players.filter((item) => item.id !== "p_chris");
  const { game } = createGame(data, BRICK_ELITE_ID, { opponent: "Rivals", date: "2026-09-12", homeAway: "home", location: "" });
  addEvent(game, { type: "flag", player: player(data, "p_nils"), half: "H1" });
  const loaded = normalizeData(JSON.parse(JSON.stringify(data)));
  assert.equal(loaded.teams[0].players.some((item) => item.id === "p_chris"), false);
  assert.equal(loaded.games[0].events[0].type, "flag");
  assert.equal(loaded.teams[0].players.length, 9);
});

test("teams can be added and renamed without wiping the other team's games", () => {
  const data = defaultData();
  const { game } = createGame(data, BRICK_ELITE_ID, { opponent: "Rivals", date: "2026-09-12", homeAway: "home", location: "" });
  addEvent(game, { type: "sack", player: player(data, "p_brody"), half: "H1" });
  const added = addTeam(data, "Practice Squad");
  assert.equal(added.team.players.length, 0);
  assert.equal(data.activeTeamId, added.team.id);
  renameTeam(added.team, "Scout");
  const removed = deleteTeam(data, BRICK_ELITE_ID);
  assert.equal(removed.ok, true);
  assert.equal(data.teams.length, 1);
  assert.equal(data.teams[0].name, "Scout");
  assert.equal(data.games.length, 0);
  assert.equal(deleteTeam(data, added.team.id).error, "Keep at least one team.");
});

test("backup round-trip keeps games and refuses the wrong file", () => {
  const data = defaultData();
  createGame(data, BRICK_ELITE_ID, { opponent: "Ocean", date: "2026-10-01", homeAway: "away", location: "Beach" });
  const storage = memoryStorage();
  saveData(storage, data);
  const loaded = loadData(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.data.games[0].opponent, "Ocean");
  assert.equal(loaded.data.teams[0].players.length, 10);
  const wrapped = JSON.stringify(exportPayload(loaded.data, new Date("2026-10-01T15:00:00Z")));
  const parsed = parseBackup(wrapped);
  assert.equal(parsed.data.games[0].location, "Beach");
  assert.equal(parsed.exportedAt, "2026-10-01T15:00:00.000Z");
  assert.equal(parseBackup("{").error.includes("JSON"), true);
  assert.equal(Boolean(parseBackup('{"nope":true}').error), true);
  assert.match(parseBackup('{"app":"lacrosse-stats","data":{}}').error, /flag football/);
  deleteGame(parsed.data, parsed.data.games[0].id);
  assert.equal(parsed.data.games.length, 0);
});

test("the sideline clock pauses without jumping ahead of the saved elapsed time", () => {
  const game = { clockMs: 0, clockStartedAt: null };
  toggleClock(game, 1_000);
  assert.equal(game.clockStartedAt, 1_000);
  toggleClock(game, 4_000);
  assert.equal(game.clockMs, 3_000);
  assert.equal(game.clockStartedAt, null);
  assert.equal(formatClock(3_000), "00:03");
  assert.equal(formatClock(65_000), "01:05");
  resetClock(game);
  assert.equal(game.clockMs, 0);
  const line = emptyLine();
  applyEvent(line, { type: "pd" });
  assert.equal(derive(line).pd, 1);
  assert.equal(derive(line).pts, 0);
});
