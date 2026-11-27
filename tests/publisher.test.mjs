import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { addEvent, createGame, defaultData } from "../js/logic.js";
import { RESULTS_CONFIG } from "../js/results-config.js";
import { buildPublicResults, mergeQueue, postToResults, publishResults, publishingMode } from "../js/publisher.js";

function privateKeys(value, found = []) {
  if (!value || typeof value !== "object") return found;
  for (const key of Object.keys(value)) {
    if (["events", "playerId", "passcode", "password", "token", "secret", "authorization", "clockStartedAt"].includes(key)) found.push(key);
    privateKeys(value[key], found);
  }
  return found;
}

function sample() {
  const data = defaultData();
  const team = data.teams[0];
  const keegan = team.players.find((player) => player.id === "p_keegan");
  const ethan = team.players.find((player) => player.id === "p_ethan");
  const { game } = createGame(data, team.id, { opponent: "Rivals", date: "2026-09-12", homeAway: "home", location: "Field 2" });
  addEvent(game, { type: "pass_td", player: keegan, half: "H1" });
  addEvent(game, { type: "rec_td", player: ethan, half: "H1" });
  addEvent(game, { type: "opp_safety", half: "H2" });
  const { game: hidden } = createGame(data, team.id, { opponent: "Secret Scrimmage", date: "2026-09-13", homeAway: "away", location: "" });
  addEvent(hidden, { type: "rush_td", player: ethan, half: "H1" });
  const extra = addTeamSafe(data);
  const { game: other } = createGame(data, extra.id, { opponent: "Ocean", date: "2026-09-20", homeAway: "away", location: "" });
  other.final = true;
  addEvent(other, { type: "def_td", player: { id: "p_new", firstName: "Alex", lastName: "", number: "8" }, half: "H1" });
  game.final = true;
  return { data, game };
}

function addTeamSafe(data) {
  data.teams.push({ id: "practice", name: "Practice", players: [] });
  return data.teams[1];
}

test("the repo does not ship a submit URL or a passcode", () => {
  assert.equal(RESULTS_CONFIG.submitUrl, "");
  assert.equal(RESULTS_CONFIG.resultsUrl, "./results.json");
  const config = readFileSync(new URL("../js/results-config.js", import.meta.url), "utf8");
  assert.doesNotMatch(config, /PASSCODE\s*=\s*["']/);
  const script = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");
  assert.match(script, /getProperty\("PASSCODE"\)/);
  assert.doesNotMatch(script, /var PASSCODE\s*=/);
  const doc = JSON.parse(readFileSync(new URL("../results.json", import.meta.url), "utf8"));
  assert.equal(doc.teams[0].name, "Brick Elite");
  assert.equal(doc.teams[0].games.length, 0);
  assert.equal(doc.teams[0].recordLabel, "0-0-0");
  assert.equal(doc.teams[0].pointsFor, 0);
  assert.equal(doc.teams[0].pointsAgainst, 0);
});

test("public results include only final games and do not double-count a passing touchdown", () => {
  const { data, game } = sample();
  const payload = buildPublicResults(data, new Date("2026-09-12T18:00:00Z"));
  assert.equal(payload.version, 1);
  assert.deepEqual(privateKeys(payload), []);
  const team = payload.teams.find((item) => item.id === "brick-elite");
  const practice = payload.teams.find((item) => item.id === "practice");
  assert.equal(team.games.length, 1);
  assert.equal(team.games[0].id, game.id);
  assert.equal(team.games[0].opponent, "Rivals");
  assert.equal(team.games[0].us, 6);
  assert.equal(team.games[0].them, 2);
  assert.equal(team.games[0].result, "W");
  assert.equal(team.recordLabel, "1-0-0");
  assert.equal(team.pointsFor, 6);
  assert.equal(team.pointsAgainst, 2);
  const keegan = team.games[0].players.find((player) => player.name === "Keegan");
  const ethan = team.games[0].players.find((player) => player.name === "Ethan");
  assert.equal(keegan.stats.passTd, "1");
  assert.equal(keegan.stats.pts, "0");
  assert.equal(keegan.stats.td, "0");
  assert.equal(ethan.stats.recTd, "1");
  assert.equal(ethan.stats.pts, "6");
  assert.equal(ethan.stats.td, "1");
  assert.equal(JSON.stringify(team).includes("Secret Scrimmage"), false);
  assert.equal(practice.games[0].opponent, "Ocean");
  assert.equal(practice.games[0].us, 6);
  assert.equal(practice.recordLabel, "1-0-0");
  assert.equal(team.leaders.some((board) => board.label === "Points" && board.rows[0].name === "Ethan"), true);
  assert.equal(team.leaders.some((board) => board.label === "Passing TDs" && board.rows[0].name === "Keegan"), true);
});

test("file publisher downloads results and the endpoint posts text without a stored secret", async () => {
  const previous = RESULTS_CONFIG.submitUrl;
  try {
    RESULTS_CONFIG.submitUrl = "";
    assert.equal(publishingMode(), "file");
    const { data } = sample();
    let downloaded = "";
    const fileResult = await publishResults(data, {
      downloadImpl: (_name, text) => { downloaded = text; },
    });
    assert.equal(fileResult.mode, "file");
    assert.match(downloaded, /Rivals/);
    assert.equal(downloaded.includes("Secret Scrimmage"), false);
    assert.equal(JSON.parse(downloaded).teams.find((team) => team.id === "brick-elite").games[0].us, 6);

    RESULTS_CONFIG.submitUrl = "https://example.com/flag-results";
    assert.equal(publishingMode(), "endpoint");
    let seen = null;
    const endpointResult = await publishResults(data, {
      passcode: "typed-on-the-phone",
      hiddenIds: ["secret"],
      fetchImpl: async (url, options) => {
        seen = { url, options };
        return { ok: true, json: async () => ({ ok: true }) };
      },
    });
    assert.equal(endpointResult.mode, "endpoint");
    assert.equal(seen.url, "https://example.com/flag-results");
    assert.equal(seen.options.method, "POST");
    assert.match(seen.options.headers["Content-Type"], /text\/plain/);
    assert.equal(seen.options.headers.Authorization, undefined);
    assert.equal(seen.options.headers["X-Api-Key"], undefined);
    const posted = JSON.parse(seen.options.body);
    assert.equal(posted.passcode, "typed-on-the-phone");
    assert.deepEqual(posted.hiddenIds, ["secret"]);
    assert.equal(posted.teams.find((team) => team.id === "brick-elite").games[0].us, 6);

    await assert.rejects(
      () => postToResults({ teams: [] }, { online: false, passcode: "typed-on-the-phone" }),
      (error) => error.code === "offline",
    );
    await assert.rejects(
      () => postToResults({ teams: [] }, {
        passcode: "nope",
        fetchImpl: async () => ({ ok: true, json: async () => ({ ok: false, error: "Wrong passcode." }) }),
      }),
      (error) => error.code === "passcode",
    );
    await assert.rejects(
      () => publishResults(data, { passcode: "" }),
      (error) => error.code === "need-passcode",
    );
  } finally {
    RESULTS_CONFIG.submitUrl = previous;
  }
});

test("a non-http submit URL falls back to the file and the offline queue drops the passcode", async () => {
  const previous = RESULTS_CONFIG.submitUrl;
  try {
    RESULTS_CONFIG.submitUrl = "javascript:alert(1)";
    assert.equal(publishingMode(), "file");
    const queued = mergeQueue([{ game: { id: "g1" }, passcode: "old" }], {
      game: { id: "g1", opponent: "Rivals" },
      passcode: "should-not-stick",
    });
    assert.equal(queued.length, 1);
    assert.equal(queued[0].passcode, undefined);
    assert.equal(queued[0].game.opponent, "Rivals");
  } finally {
    RESULTS_CONFIG.submitUrl = previous;
  }
});
