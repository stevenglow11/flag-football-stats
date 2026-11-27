# Brick Elite Flag Stats

A phone-first stat tracker for Brick Elite flag football. Keep live stats on the sideline, then look up the box score and season totals later.

Stats stay on the phone. There is no account and no server in the app itself. After the home-screen icon has been opened once with service, it keeps working if the field has bad signal.

Live site (after GitHub Pages is turned on):

**https://stevenglow11.github.io/flag-football-stats/**

Public results (anyone can open this, no login):

**https://stevenglow11.github.io/flag-football-stats/results.html**

The site is plain HTML, CSS, and ES modules. GitHub Pages serves the `main` branch root. There is no build step.

## Turn on GitHub Pages

1. Open this repo on GitHub.
2. Go to **Settings**.
3. Open **Pages** in the left sidebar.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
5. Set the branch to **main** and the folder to **/ (root)**.
6. Save.

GitHub may take a minute or two. Then open https://stevenglow11.github.io/flag-football-stats/

The website itself is public. Stats you enter stay on the phone until you tap **Submit results**. The built-in Brick Elite roster is part of the app, so those names are in the project. The public page starts with no games.

## Add it to the iPhone home screen

1. Open the link in **Safari**.
2. Tap the **Share** button.
3. Tap **Add to Home Screen**, then **Add**.
4. Open **Flag Stats** from the new icon.
5. Leave it open once while you have service. After that it can work offline.

On Android, open the site in Chrome, tap the menu, and choose **Install app** or **Add to Home screen**.

Use that home-screen icon each time. A home-screen app and a Safari tab can keep separate copies of the stats.

## What's already filled in

Brick Elite starts with ten players and no jersey numbers yet: Keegan, Ethan, Cal, Henry, Will, Santana, Brody, Nils, Gunz, and Chris. They can still be tapped during a game. Add numbers later on the Roster tab. Duplicate numbers are allowed, and the roster screen warns you if two players share one.

You can rename the team, add another team, and add or edit players on the phone. Deleting a player does not erase stats already entered for them.

## How scoring works

Tap a player, then a stat. Opponent buttons do not need a player.

These add to the Brick Elite score:

- Rush TD, Rec TD, and Def TD (pick-6) add **6**
- 1-Pt adds **1**
- 2-Pt and Safety add **2**

**Pass TD credits the quarterback and does not add points.** Tap Pass TD for the QB and Rec TD (or Rush TD) for the player who scored. The team gets 6, not 12.

Rush, Rush TD, Rec, and Rec TD then ask for yards. Tap +5, +10, +15, +20, +30, or 0, or type a number such as 12 or -3. The play-by-play line shows it, for example `Keegan Rec +12 yds`. Undo removes the yards with the play. Games saved before yards existed count as 0.

1-Pt and 2-Pt ask who threw it, or Run / No passer. A 1-point conversion is 5 yards and a 2-point conversion is 10 yards, for the scorer and for the passer. A pass gives the scorer receiving yards and the passer the same number of passing yards. A run gives the scorer rushing yards. The team score still goes up only 1 or 2. Completions and passing touchdowns stay one tap and do not ask for yards. Older conversions that were saved before this rule stay points only.

Opponent buttons add only to their score: Opp TD **6**, Opp 1 **1**, Opp 2 **2**, Opp Safety **2**.

Computed stats:

- **Total TDs** are rushing + receiving + defensive. Passing touchdowns are not included.
- **Points** are 6 per total TD, plus 1 for a 1-pt, 2 for a 2-pt, and 2 for a safety.
- **Pass attempts** are completions + incompletions. Comp % is completions divided by attempts.
- **GP** is games in which that player recorded a stat.

The phone's season record counts every game that has stats, including one still in progress. The public page only shows games you mark final and submit.

## Enter a game

1. On **Roster**, fix players: first name, last name, and jersey (optional).
2. On **Games**, tap **New game**. Enter the opponent, date, home or away, and a field or note if you want.
3. You land on **Live**. The big number on the left is Brick Elite. The big number on the right is the opponent.
4. Tap **1st**, **2nd**, or **OT** when the half changes. The clock in the middle of the scoreboard starts and pauses when you tap it. **Reset** clears it. The clock is only a sideline timer. It does not change the score.
5. Tap a player, then the stat. Or tap the stat first, then the player. The player stays selected so the next stat is one tap.
6. Stat buttons are grouped: Passing, Rushing / Receiving, Scoring, Defense, and Opponent. Scroll that area with your thumb. The player row stays put.
7. **Undo** removes the last thing you entered.
8. **Play by play** lists the latest events. **Edit** or **Delete** fixes a mistake. **All** opens the full list.
9. **Box** shows the box score: each player, team totals, and the score by half.
10. **Stats** shows season totals, per-game averages, stat leaders, and a game log for one player.

Every tap is saved immediately. You can refresh the page and the game is still there.

## Publishing results

Anyone can open the results page and see the season record, points for and against, each game's box score, and leaders:

https://stevenglow11.github.io/flag-football-stats/results.html

Nothing is sent there until you tap **Submit results**. The public page shows names, numbers, and stats. It does not get the private backup.

### One tap, after the Google Sheet is set up

The one-time setup is in `apps-script/SETUP.md`. Short version:

1. Create a Google Sheet.
2. **Extensions > Apps Script**, paste `apps-script/Code.gs`.
3. **Project Settings > Script properties**, add `PASSCODE` and a code you make up. Do not put that code in GitHub.
4. **Deploy > New deployment > Web app**. Execute as **Me**. Who has access: **Anyone**. Authorize it.
5. Copy the URL that ends in `/exec`.
6. Paste it into `js/results-config.js` as `submitUrl`, and commit that to `main`. Leave the passcode out of the file.
7. On the phone, enter a game and tap **Submit results**. The first time, type the passcode. It stays on that phone.
8. You should see **Submitted. This game is on the public results page.**

The public page reads that same address. If the browser cannot call it directly, it falls back to JSONP (`?callback=`).

To change the script later: **Deploy > Manage deployments > pencil > New version > Deploy**. The same `/exec` URL keeps working.

To hide a game, tap **Final** until it says **In progress**.

If you are offline, Submit keeps the update on the phone and sends it the next time you tap Submit while online. **Change results passcode** is on the Games screen. **Download results file** is there if Google cannot be reached.

### If the web address is not set up yet

`submitUrl` starts as an empty string.

1. Tap **Submit results**. That downloads `results.json` for every game marked final.
2. On GitHub, open this repo, click **Add file**, then **Upload files**.
3. Drop `results.json` in and commit it to **main**.

The page reads `./results.json` until `submitUrl` is set. It updates a minute or two after the upload.

## Updating the roster in a later version

Players and games live on the phone. Shipping a new `main` does not erase them.

`js/logic.js` keeps a `SEED_MIGRATIONS` list. Each entry has an `id` and runs once per phone. To add a player or fill in numbers later, append a new entry:

- `add` inserts a player id that is not already on Brick Elite. It does not change someone who is already there.
- `fillNumber` writes a jersey only when that player's number is still blank.
- `replaceNumber` changes a number only when it still equals `from`.
- `setName` renames a player only when the first and last name still equal `from`.

Saved games are never edited by a migration. A player you deleted stays deleted, because the original seed id is already marked as applied.

## Back up, or move stats to another phone

1. On **Games** or **Stats**, tap **Download backup**. That saves one file with teams, rosters, and every game.
2. AirDrop, text, or email that file to the other phone.
3. On the other phone, open the app and tap **Restore backup**.
4. Choose the file and confirm. Restore replaces whatever is already on that phone.

**Export season CSV** and **Export this game** make spreadsheets. Percentages in the CSV are numbers like `66.7` for 66.7%.

If you clear Safari website data, or delete the home-screen app, the stats on that phone go with it. Download a backup first if you want to keep them.

## Offline

After the home-screen app has opened once with service, the pages are stored on the phone. You can keep entering a game with no signal. Stats are saved in the phone's local storage either way. Open the app once online after it changes so the phone picks up the new version.

## Tests

```bash
npm test
```

That runs the stat, scoring, season, publisher, and Apps Script checks with Node's built-in test runner. No install is required.

Phone-sized browser checks live in `tests/smoke.mjs` and need Chrome plus Playwright:

```bash
NODE_PATH=/path/to/playwright/node_modules npm run test:smoke
```
