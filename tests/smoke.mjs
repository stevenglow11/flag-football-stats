import { createServer } from "node:http";
import { readFile, mkdir, copyFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createGasApp } from "./gas-harness.mjs";

const ROOT = "/workspace";
const PREFIX = "/flag-football-stats";
const PASS = "field-test-code";
const SHOTS = "/tmp/flag-shots";
const ARTIFACTS = "/opt/cursor/artifacts";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

function startSite() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      if (!url.pathname.startsWith(PREFIX)) {
        res.writeHead(404);
        res.end("missing");
        return;
      }
      let rel = decodeURIComponent(url.pathname.slice(PREFIX.length)).replace(/^\/+/, "");
      if (!rel || rel.endsWith("/")) rel = `${rel}index.html`;
      const path = normalize(join(ROOT, rel));
      if (path !== ROOT && !path.startsWith(`${ROOT}/`)) {
        res.writeHead(403);
        res.end("no");
        return;
      }
      const body = await readFile(path);
      res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream", "cache-control": "no-cache" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("missing");
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function startSheet() {
  const gas = createGasApp(PASS);
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (url.pathname !== "/exec") {
      res.writeHead(404);
      res.end("missing");
      return;
    }
    if (req.method === "GET") {
      const out = gas.get(Object.fromEntries(url.searchParams.entries()));
      const type = out.mime === "application/javascript" ? "application/javascript; charset=utf-8" : "application/json; charset=utf-8";
      res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
      res.end(out.text);
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { body = {}; }
    const out = gas.post(body);
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(JSON.stringify(out));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, gas })));
}

async function shot(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const path = join(SHOTS, name);
  await page.screenshot({ path });
  await copyFile(path, join(ARTIFACTS, name));
}

async function main() {
  await mkdir(SHOTS, { recursive: true });
  await mkdir(ARTIFACTS, { recursive: true });
  const site = await startSite();
  const sheet = await startSheet();
  const appUrl = `http://127.0.0.1:${site.address().port}${PREFIX}/`;
  const submitUrl = `http://127.0.0.1:${sheet.server.address().port}/exec`;
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/opt/google/chrome/chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
    locale: "en-US",
  });
  await context.addInitScript(`window.__FF_SUBMIT_URL__ = ${JSON.stringify(submitUrl)};`);
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const pageErrors = [];
  const badResponses = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("response", (response) => {
    const url = response.url();
    if (response.status() >= 400 && url.startsWith(appUrl)) badResponses.push(`${response.status()} ${url}`);
  });

  const player = (name) => page.getByRole("button", { name, exact: true });
  const stat = (name) => page.getByRole("button", { name, exact: true });

  try {
    await page.goto(appUrl);
    await page.getByRole("button", { name: "Roster", exact: true }).click();
    await page.getByRole("heading", { name: "Roster" }).waitFor();
    const names = await page.locator("[data-testid=roster-player]").evaluateAll((rows) => rows.map((row) => row.dataset.name));
    assert.deepEqual(names, ["Brody", "Cal", "Chris", "Ethan", "Gunz", "Henry", "Keegan", "Nils", "Santana", "Will"]);
    assert.equal(await page.locator("[data-testid=roster-player] .jersey").evaluateAll((nodes) => nodes.every((node) => node.textContent.trim() === "—")), true);
    await page.getByRole("button", { name: "Edit Keegan", exact: true }).click();
    await page.locator("#player-number").fill("7");
    await page.locator(".sheet").getByRole("button", { name: "Save player", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Roster saved" }).waitFor();
    assert.equal((await page.locator("[data-name='Keegan'] .jersey").innerText()).trim(), "7");
    await page.getByRole("status").filter({ hasText: "Roster saved" }).waitFor({ state: "hidden" });
    await shot(page, "roster_screen.png");

    await page.getByRole("button", { name: "Games", exact: true }).click();
    await page.getByRole("button", { name: "New game", exact: true }).click();
    await page.getByLabel("Opponent").fill("Rivals");
    await page.getByLabel("Date").fill("2026-09-12");
    await page.getByLabel(/Location/).fill("Field 2");
    await page.locator(".sheet").getByRole("button", { name: "Start game", exact: true }).click();
    await page.getByTestId("score-us").waitFor();

    await player("Number 7, Keegan").click();
    await stat("Passing touchdown").click();
    assert.equal((await page.getByTestId("score-us").innerText()).trim(), "0");
    await player("No number, Ethan").click();
    await stat("Receiving touchdown").click();
    await page.getByRole("dialog", { name: "Yards · Ethan" }).waitFor();
    assert.equal(await page.locator("[data-testid=score-us]").evaluate((node) => node.textContent.trim()), "0");
    await page.locator("#custom-yards").fill("12");
    await page.getByRole("button", { name: "Add yards", exact: true }).click();
    assert.equal((await page.getByTestId("score-us").innerText()).trim(), "6");
    assert.match(await page.getByTestId("feed").innerText(), /Ethan Rec TD \+12 yds/);
    await stat("Opponent touchdown").click();
    assert.equal((await page.getByTestId("score-them").innerText()).trim(), "6");
    await page.getByRole("button", { name: "2nd Half", exact: true }).click();
    assert.equal((await page.getByTestId("half-label").innerText()).trim(), "2nd Half");
    await player("No number, Cal").click();
    await stat("Rush").click();
    await page.getByRole("button", { name: "+10 yards", exact: true }).click();
    assert.equal((await page.getByTestId("score-us").innerText()).trim(), "6");
    assert.match(await page.getByTestId("feed").innerText(), /Cal Rush \+10 yds/);
    await stat("Rushing touchdown").click();
    await page.getByRole("button", { name: "+20 yards", exact: true }).click();
    assert.equal((await page.getByTestId("score-us").innerText()).trim(), "12");
    await page.getByRole("button", { name: "Undo last event", exact: true }).click();
    assert.equal((await page.getByTestId("score-us").innerText()).trim(), "6");
    assert.equal((await page.getByTestId("feed").innerText()).includes("Rush TD"), false);
    await stat("2 point conversion").click();
    await page.getByRole("dialog", { name: "2-Pt · Cal" }).waitFor();
    assert.equal(await page.locator("[data-testid=score-us]").evaluate((node) => node.textContent.trim()), "6");
    await page.getByRole("button", { name: "Passer Ethan", exact: true }).click();
    assert.equal((await page.getByTestId("score-us").innerText()).trim(), "8");
    assert.match(await page.getByTestId("feed").innerText(), /Cal 2-Pt Conv \(\+10 rec yds\) from Ethan \(\+10 pass yds\)/);
    await page.getByRole("button", { name: "Undo last event", exact: true }).click();
    assert.equal((await page.getByTestId("score-us").innerText()).trim(), "6");
    assert.equal((await page.getByTestId("feed").innerText()).includes("2-Pt Conv"), false);
    await stat("1 point conversion").click();
    await page.getByRole("button", { name: "Run / No passer", exact: true }).click();
    assert.equal((await page.getByTestId("score-us").innerText()).trim(), "7");
    assert.match(await page.getByTestId("feed").innerText(), /Cal 1-Pt Conv run \(\+5 rush yds\)/);
    await page.getByRole("button", { name: "Start clock", exact: true }).click();
    await page.getByRole("button", { name: "Pause clock", exact: true }).waitFor();
    const passTd = await stat("Passing touchdown").boundingBox();
    assert.ok(passTd && passTd.height >= 44 && passTd.width >= 44, "stat target");
    const keeganBox = await player("Number 7, Keegan").boundingBox();
    assert.ok(keeganBox && keeganBox.height >= 44, "player target");
    await shot(page, "live_entry_screen.png");

    await page.getByRole("button", { name: "Box score", exact: true }).click();
    await page.getByTestId("half-score").waitFor();
    const halves = (await page.getByTestId("half-score").innerText()).replace(/\s+/g, " ");
    assert.match(halves, /Us 6 1 7/);
    assert.match(halves, /Them 6 0 6/);
    const cell = async (name, key) => (await page.locator(`[data-testid="box-table"] [data-player="${name}"] [data-stat="${key}"]`).innerText()).trim();
    assert.equal(await cell("Keegan", "passTd"), "1");
    assert.equal(await cell("Keegan", "td"), "0");
    assert.equal(await cell("Keegan", "pts"), "0");
    assert.equal(await cell("Ethan", "recTd"), "1");
    assert.equal(await cell("Ethan", "recYds"), "12");
    assert.equal(await cell("Ethan", "ydsPerRec"), "12");
    assert.equal(await cell("Ethan", "pts"), "6");
    assert.equal(await cell("Cal", "rush"), "1");
    assert.equal(await cell("Cal", "rushYds"), "15");
    assert.equal(await cell("Cal", "ydsPerRush"), "15");
    assert.equal(await cell("Cal", "passYds"), "0");
    assert.equal(await cell("Ethan", "passYds"), "0");
    assert.equal(await cell("Cal", "rushTd"), "0");
    assert.equal(await cell("Cal", "conv1"), "1");
    assert.equal(await cell("Cal", "pts"), "1");
    assert.equal(await cell("Totals", "pts"), "7");
    assert.equal(await cell("Totals", "recYds"), "12");
    assert.equal(await cell("Totals", "rushYds"), "15");
    await shot(page, "box_score_screen.png");

    await page.getByRole("button", { name: "Stats", exact: true }).click();
    assert.match(await page.getByTestId("metric-record").innerText(), /1-0-0/);
    assert.match(await page.getByTestId("metric-pf").innerText(), /7/);
    assert.match(await page.getByTestId("metric-pa").innerText(), /6/);
    await page.getByRole("button", { name: "Leaders", exact: true }).click();
    const receiving = page.locator(".panel", { has: page.getByRole("heading", { name: "Receiving yards", exact: true }) });
    const rushing = page.locator(".panel", { has: page.getByRole("heading", { name: "Rushing yards", exact: true }) });
    assert.match(await receiving.innerText(), /Ethan/);
    assert.match(await receiving.innerText(), /12/);
    assert.match(await rushing.innerText(), /Cal/);
    assert.match(await rushing.innerText(), /15/);
    await shot(page, "season_stats_screen.png");

    await page.getByRole("button", { name: "Games", exact: true }).click();
    await page.getByRole("button", { name: "Submit results", exact: true }).click();
    await page.getByRole("textbox", { name: "Results passcode" }).fill(PASS);
    await page.locator(".sheet").getByRole("button", { name: "Save passcode", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Submitted" }).waitFor();
    const posted = JSON.parse(sheet.gas.get().text);
    const brick = posted.teams.find((team) => team.id === "brick-elite");
    assert.equal(brick.games[0].opponent, "Rivals");
    assert.equal(brick.games[0].us, 7);
    assert.equal(brick.games[0].them, 6);
    assert.equal(JSON.stringify(sheet.gas.rows()).includes(PASS), false);
    assert.equal(brick.games[0].players.find((item) => item.name === "Keegan").stats.pts, "0");
    assert.equal(brick.games[0].players.find((item) => item.name === "Ethan").stats.pts, "6");
    assert.equal(brick.games[0].players.find((item) => item.name === "Ethan").stats.recYds, "12");
    assert.equal(brick.games[0].players.find((item) => item.name === "Cal").stats.rushYds, "15");
    assert.equal(brick.games[0].players.find((item) => item.name === "Ethan").stats.passYds, "0");

    await page.goto(`${appUrl}results.html`);
    await page.getByRole("button", { name: /Rivals/ }).waitFor();
    assert.match(await page.getByTestId("public-record").innerText(), /1-0-0/);
    assert.match(await page.getByTestId("public-record").innerText(), /7/);
    assert.match(await page.locator("body").innerText(), /Receiving yards/);
    assert.match(await page.locator("body").innerText(), /Rushing yards/);
    assert.match(await page.locator(".panel", { has: page.getByRole("heading", { name: "Receiving yards", exact: true }) }).innerText(), /Ethan/);
    assert.match(await page.locator(".panel", { has: page.getByRole("heading", { name: "Rushing yards", exact: true }) }).innerText(), /Cal/);
    await shot(page, "results_list.png");
    await page.getByRole("button", { name: /Rivals/ }).click();
    await page.getByTestId("public-halves").waitFor();
    assert.match(await page.getByTestId("public-box").innerText(), /Keegan/);
    assert.match(await page.getByTestId("public-box").innerText(), /Ethan/);
    await shot(page, "results_game.png");

    const empty = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      colorScheme: "light",
    });
    await empty.addInitScript("window.__FF_SUBMIT_URL__ = '';");
    const emptyPage = await empty.newPage();
    await emptyPage.goto(`${appUrl}results.html`);
    await emptyPage.getByTestId("empty-results").waitFor();
    assert.match(await emptyPage.getByTestId("public-record").innerText(), /0-0-0/);
    await empty.close();

    await page.goto(appUrl);
    await page.getByRole("button", { name: "Games", exact: true }).click();
    await context.setOffline(true);
    await page.getByRole("button", { name: "Mark in progress", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "offline" }).waitFor();
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.getByRole("status").filter({ hasText: "Sent saved results" }).waitFor();
    const hidden = JSON.parse(sheet.gas.get().text);
    assert.equal(hidden.teams.find((team) => team.id === "brick-elite").games.length, 0);

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
    assert.equal(manifestHref, "manifest.json");
    const manifest = await page.evaluate(async (href) => {
      const response = await fetch(href);
      return { ok: response.ok, body: await response.json() };
    }, manifestHref);
    assert.equal(manifest.ok, true);
    assert.equal(manifest.body.start_url, "./index.html");
    assert.equal(manifest.body.scope, "./");
    assert.ok(manifest.body.icons.every((icon) => icon.src.startsWith("./")));
    const rooted = await page.evaluate(() => [...document.querySelectorAll("link[href], script[src]")].map((node) => node.getAttribute("href") || node.getAttribute("src")).filter((value) => value && value.startsWith("/")));
    assert.deepEqual(rooted, []);

    await page.evaluate(async () => {
      const ready = await navigator.serviceWorker.ready;
      return ready.scope;
    });
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload();
    await page.getByRole("button", { name: "Games", exact: true }).waitFor();
    await context.setOffline(false);

    assert.deepEqual(pageErrors, []);
    assert.deepEqual(badResponses, []);
    console.log("SMOKE PASSED");
  } catch (error) {
    await page.screenshot({ path: join(ARTIFACTS, "smoke_failure.png"), fullPage: true }).catch(() => {});
    console.error("PAGE ERRORS", pageErrors);
    console.error("BAD RESPONSES", badResponses);
    throw error;
  } finally {
    await browser.close();
    site.close();
    sheet.server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
