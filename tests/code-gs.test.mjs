import assert from "node:assert/strict";
import test from "node:test";
import { createGasApp } from "./gas-harness.mjs";

const PASS = "sheet-test-pass";

function game(id, opponent, us, them) {
  return {
    id,
    date: "2026-09-12",
    dateLabel: "Sat, Sep 12, 2026",
    opponent,
    homeAway: "home",
    location: "Field 2",
    result: us > them ? "W" : us < them ? "L" : "T",
    us,
    them,
    halves: [
      { label: "1st", us, them: 0 },
      { label: "2nd", us: 0, them },
    ],
    players: [
      { name: "Keegan", number: "", stats: { passTd: "1", comp: "0", att: "0", td: "0", pts: "0", rushTd: "0", recTd: "0", defTd: "0", rushYds: "0", recYds: "0" } },
      { name: "Ethan", number: "4", stats: { recTd: "1", td: "1", pts: "6", passTd: "0", rushTd: "0", defTd: "0", comp: "0", rushYds: "4", recYds: "18" } },
    ],
    totals: { td: "1", pts: "6", passTd: "1" },
  };
}

test("the sheet script rejects a missing or wrong passcode and stores none", () => {
  const gas = createGasApp(PASS);
  assert.equal(gas.post({ game: game("g1", "Rivals", 6, 0), teamId: "brick-elite", teamName: "Brick Elite" }).error, "Wrong passcode.");
  const unset = createGasApp("");
  assert.match(unset.post({ passcode: "", game: game("g1", "Rivals", 6, 0) }).error, /not set up/);
  assert.equal(gas.rows().length, 0);
});

test("an empty sheet still describes Brick Elite", () => {
  const gas = createGasApp(PASS);
  const doc = JSON.parse(gas.get().text);
  assert.equal(doc.version, 1);
  assert.equal(doc.teams[0].id, "brick-elite");
  assert.equal(doc.teams[0].name, "Brick Elite");
  assert.equal(doc.teams[0].games.length, 0);
  assert.equal(doc.teams[0].pointsFor, 0);
  assert.equal(doc.teams[0].recordLabel, "0-0-0");
});

test("upsert, hide, leaders, and player rows keep a six-point passing play at six", () => {
  const gas = createGasApp(PASS);
  const saved = gas.post({
    passcode: PASS,
    teamId: "brick-elite",
    teamName: "Brick Elite",
    hidden: false,
    game: game("g1", "Rivals", 6, 2),
  });
  assert.equal(saved.ok, true);
  assert.equal(JSON.stringify(gas.rows()).includes(PASS), false);
  assert.equal(gas.rows().length, 2);
  assert.equal(gas.rows()[1][6], 6);

  let doc = JSON.parse(gas.get().text);
  const brick = doc.teams.find((team) => team.id === "brick-elite");
  assert.equal(brick.recordLabel, "1-0-0");
  assert.equal(brick.pointsFor, 6);
  assert.equal(brick.pointsAgainst, 2);
  assert.equal(brick.games[0].opponent, "Rivals");
  assert.equal(brick.games[0].us, 6);
  assert.equal(brick.leaders.find((board) => board.label === "Points").rows[0].name, "Ethan");
  assert.equal(brick.leaders.find((board) => board.label === "Points").rows[0].value, "6");
  assert.equal(brick.leaders.find((board) => board.label === "Total TDs").rows.some((row) => row.name === "Keegan"), false);
  assert.equal(brick.leaders.find((board) => board.label === "Passing TDs").rows[0].name, "Keegan");
  assert.equal(brick.leaders.find((board) => board.label === "Receiving yards").rows[0].name, "Ethan");
  assert.equal(brick.leaders.find((board) => board.label === "Receiving yards").rows[0].value, "18");
  assert.equal(brick.leaders.find((board) => board.label === "Rushing yards").rows[0].value, "4");
  assert.equal(brick.leaders.some((board) => board.label === "Rushing yards" && board.rows[0].name === "Keegan"), false);

  const header = gas.playerRows()[0];
  const nameCol = header.indexOf("player");
  const passCol = header.indexOf("passTd");
  const ptsCol = header.indexOf("pts");
  const recYdsCol = header.indexOf("recYds");
  const rushYdsCol = header.indexOf("rushYds");
  const keegan = gas.playerRows().find((row) => row[nameCol] === "Keegan");
  const ethan = gas.playerRows().find((row) => row[nameCol] === "Ethan");
  assert.equal(keegan[passCol], "1");
  assert.equal(keegan[ptsCol], "0");
  assert.equal(ethan[ptsCol], "6");
  assert.equal(ethan[recYdsCol], "18");
  assert.equal(ethan[rushYdsCol], "4");
  assert.equal(keegan[recYdsCol], "0");

  const again = gas.post({
    passcode: PASS,
    teamId: "brick-elite",
    teamName: "Brick Elite",
    game: game("g1", "Rivals", 6, 2),
  });
  assert.equal(again.ok, true);
  assert.equal(gas.rows().length, 2);

  assert.equal(gas.post({ passcode: PASS, action: "visibility", id: "g1", hidden: true }).ok, true);
  doc = JSON.parse(gas.get().text);
  assert.equal(doc.teams.find((team) => team.id === "brick-elite").games.length, 0);
  assert.equal(doc.teams.find((team) => team.id === "brick-elite").pointsFor, 0);

  assert.equal(gas.post({ passcode: PASS, id: "g1", hidden: false }).ok, true);
  doc = JSON.parse(gas.get().text);
  assert.equal(doc.teams.find((team) => team.id === "brick-elite").games.length, 1);

  const full = gas.post({
    passcode: PASS,
    teams: [
      { id: "practice", name: "Practice", games: [game("g2", "Ocean", 8, 6)] },
    ],
    hiddenIds: ["g1"],
  });
  assert.equal(full.ok, true);
  doc = JSON.parse(gas.get().text);
  assert.equal(doc.teams.find((team) => team.id === "brick-elite").games.length, 0);
  assert.equal(doc.teams.find((team) => team.id === "practice").games[0].opponent, "Ocean");
  assert.equal(doc.teams.find((team) => team.id === "practice").recordLabel, "1-0-0");
  assert.equal(doc.teams.find((team) => team.id === "practice").pointsFor, 8);

  const jsonp = gas.get({ callback: "ffResults_1" });
  assert.equal(jsonp.mime, "application/javascript");
  assert.match(jsonp.text, /^ffResults_1\(/);
  assert.equal(gas.get({ callback: "alert(1)" }).mime, "application/json");
});
