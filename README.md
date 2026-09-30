# Vacancy Desk Command Center

An internal tool for running Vacancy Desk's sales process: leads, mystery shops, calls, pipeline, ROI, audits and pilots. Right now it's a **$0 build that runs only on your Mac**. It has no cloud services, no API keys and no credit card anywhere.

> **Status:** the Free Build is complete: Lead finder, Leads, Mystery shops, Calls and call blocks, Pipeline, ROI, Vacancy audits (PDF), the fair-housing checker, Pilots, the Dashboard and Settings. Everything runs on your Mac. The only outside service is Google Places, and only if you add your own key.

## Start here

1. **Install and run it** (once; details in [How to run this on my Mac for free](#how-to-run-this-on-my-mac-for-free) below):
   ```bash
   xcode-select --install                               # Apple's developer tools (git)
   # Install Node.js 24 LTS from https://nodejs.org, then quit and reopen Terminal
   curl -fsSL https://get.pnpm.io/install.sh | sh -     # pnpm; quit and reopen Terminal again
   cd ~/Documents/project                               # wherever you cloned the project
   pnpm install
   pnpm db:setup                                        # local database + fictional demo data
   pnpm dev                                             # open http://localhost:3000
   ```
2. **Look around with the demo data.** Every firm, person, phone and domain in it is made up.
3. **Add your Google Places key** when you want real leads from the Lead finder (see below). Without it, the finder can't search, but everything else works.
4. **Wipe the demo data and start for real** (see below).
5. **Follow the daily routine** (see below).

### Add your Google Places key (optional, stays free under the caps)

The Lead finder uses Google's official **Places API (New)**. It never scrapes Google Maps. The app caps usage at 100 searches a day and 900 a month, and 20 review lookups a day and 200 a month, all inside Google's free monthly allowance. Settings shows today's and this month's use.

1. Go to **https://console.cloud.google.com** and sign in. Create a project named `Vacancy Desk`.
2. **Billing:** Google won't turn on Places API (New) without a billing account, and that needs a card on file. Within the app's caps, usage stays in the free tier, so the expected cost is **$0**. If you'd rather not add a card, skip the key: the rest of the app works without it.
3. **Set a $1 budget alert first:** _Billing → Budgets & alerts → Create budget_. Scope it to this project, set the amount to **$1**, and turn on alerts at 50%, 90% and 100%. You'll get an email long before anything real is spent.
4. **Turn on the API:** _APIs & Services → Library_, search **"Places API (New)"**, and click **Enable**. Don't enable the older "Places API".
5. **Create the key:** _APIs & Services → Credentials → Create credentials → API key_.
6. **Restrict the key:** open the key. Under **API restrictions**, choose _Restrict key_ and tick only **Places API (New)**. Save. (Optional: under _Quotas_ for Places API (New), set daily limits no higher than the app's caps.)
7. **Give it to the app.** In Terminal, inside the project folder (replace the text in quotes with your key):
   ```bash
   echo 'GOOGLE_PLACES_API_KEY=paste-your-key-here' >> .env.local
   ```
   `.env.local` stays on your Mac. It's never committed, and the key is never stored in the database, written to logs or sent to the browser (a build check proves this: `pnpm scan:key`).
8. Stop the app (Ctrl + C) and start it again with `pnpm dev`.
9. Open **Settings → Google Places**. It should show ✓, the key's last 4 characters, and a **Test key** button. Click it: "Google accepted the key" means you're set.

### Wipe the demo data and start with real leads

1. **Settings → Brand:** enter your real name. Mystery shops always use it.
2. **Settings → Data:** click _Download a database backup_ first (it's free insurance), then type `DELETE DEMO DATA` and click **Delete demo data**. This removes only the fictional firms (reserved `.example` domains and 555-01xx phones), their shops, calls, deals, pilots and audits, and the demo weekly numbers. Your settings, rules, scripts and anything you've added stay.
3. **Get real leads** either way:
   - **Lead finder:** add a territory (towns, one per line), click _Run my territory_, then _Check websites_, then _Start triage_ and decide with the keys **A** (add), **S** (skip), **N** (not a fit), **D D** (do not call).
   - **Leads → Import CSV:** map your columns, check the preview and import. Duplicates and do-not-call firms are skipped automatically.
4. The dashboard's **Getting started** checklist shows what's left.

### The daily routine

1. **Find (15 min):** Lead finder → run a saved territory (it stays under the caps) → **triage** with A / S / N / D.
2. **Triage your leads:** Leads → sort by score. Check _Review software_ and _Duplicates_ when the bell or Leads says there are some.
3. **Plan shops (15 min):** Mystery shops → _Plan mystery shops_ → send a genuine inquiry to each firm **under your real name** (never book a fake tour), then log it. The bell reminds you to check for replies at 1h, 4h, 24h and 72h, and flags firms that didn't reply in 24h as **call now**.
4. **Call block (Tue–Thu, 9:00–11:30):** Dashboard → _Start call block_. Tap the number (your phone dials; the app never does), then log the result with keys **1–9**. **Esc** leaves the block. Deals open and move in the Pipeline on their own.
5. **Log calls and next steps:** callbacks come back on the dashboard and in the bell on the day they're due. Use **ROI** on the call (and _Present_ it), then start a **Vacancy audit** and export the PDF when they agree to see one.
6. **Dashboard (end of day):** check Today, the kill test and the MRR chart. **Pilots:** enter each vacancy's numbers daily. **Monday:** Settings → _Weekly numbers_.

Press **?** anywhere for every keyboard shortcut, and **⌘K** to jump to any lead, page or action.

---

## How to run this on my Mac for free

You'll do steps 1–4 **once**. After that, starting the app is just step 5.

You'll type commands into **Terminal**. Open it with ⌘ + Space, type `Terminal`, and press Enter. Paste one command at a time and press Enter after each.

### 1. Install Apple's developer tools (gives you `git`)

```bash
xcode-select --install
```

**Why:** `git` is how you download this project and save versions of it. A window pops up. Click **Install**, and wait 5–15 minutes.

If it says _"command line tools are already installed"_, you're done with this step.

### 2. Install Node.js (the engine that runs the app)

1. Go to **https://nodejs.org**.
2. Download the **LTS** version (24.x). LTS means "long-term support," the stable one.
3. Open the downloaded `.pkg` file and click through the installer.
4. **Quit Terminal completely (⌘ + Q) and open it again**, so it notices the new program.

Check it worked:

```bash
node --version
```

**Why:** this confirms Node is installed. You should see something like `v24.x.x`.

### 3. Install pnpm (the tool that downloads the app's building blocks)

```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

**Why:** pnpm downloads the free code libraries this app is built from. This installer puts it in your home folder, so it needs no admin password.

Then **quit and reopen Terminal again**, and check it:

```bash
pnpm --version
```

**Why:** confirms pnpm is ready. You should see a version number like `10.x.x`.

### 4. Download this project

The easiest way is **GitHub Desktop** (free): https://desktop.github.com

1. Install it and sign in with your GitHub account.
2. Choose _File → Clone repository_, pick `ctownhill0-sketch/project`, and choose a folder, for example `Documents`.

Then, in Terminal, go into the project folder. Change the path if you picked a different folder:

```bash
cd ~/Documents/project
```

**Why:** every command after this has to run _inside_ the project folder.

### 5. Start the app

```bash
pnpm install
```

**Why:** downloads all the building blocks. Only needed the first time, and again after big updates. It can take a few minutes.

```bash
pnpm db:setup
```

**Why:** creates your local database (a folder called `.data/`) and fills it with **fictional** demo firms, so you can try everything safely. You only run this once.

```bash
pnpm dev
```

**Why:** starts the app. Leave this Terminal window open while you use it.

Now open **http://localhost:3000** in your browser. `localhost` means "this Mac only." Nobody else on your Wi-Fi can open it.

**To stop the app:** click the Terminal window and press **Ctrl + C**.
**To start it again another day:** open Terminal, run `cd ~/Documents/project`, then `pnpm dev`.

### Things to know

- **Your data lives in the `.data/` folder on this Mac only.** Use _Settings → Data → Download a database backup_ weekly, and save the file somewhere safe, like iCloud Drive.
- **Only run one copy of the app at a time.** The local database can't be shared between two copies.
- **Cost is $0.** The one exception you choose yourself is the optional Google key: Google needs a billing account for it, the app's caps keep usage in the free tier, and your $1 budget alert watches it. If anything else ever asks for a credit card, stop. That isn't part of this build.

### If something goes wrong

| What you see                            | What to do                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `command not found: node` or `pnpm`     | Quit Terminal with ⌘ + Q, reopen it, and try again. If it still fails, repeat step 2 or 3. |
| `Port 3000 is already in use`           | Another copy is running. Find that Terminal window and press Ctrl + C.                     |
| `database is locked` / `already in use` | Same cause: close the other copy of the app.                                               |
| Anything else                           | Copy the whole error message and paste it to Claude.                                       |

---

## Checking that everything works (optional)

These are the same checks that run automatically before every commit and on GitHub.

```bash
pnpm typecheck && pnpm lint && pnpm test
```

**Why:** type errors, style problems and failing tests show up here before they reach GitHub. All three should finish without errors.

```bash
pnpm exec playwright install chromium
pnpm e2e
```

**Why:** the first command is a one-time, free download of a test browser. The second clicks through the app at phone, tablet and desktop sizes and checks accessibility.

## Useful commands

| Command         | What it does                                                       |
| --------------- | ------------------------------------------------------------------ |
| `pnpm dev`      | Start the app                                                      |
| `pnpm db:reset` | Delete your local data and start over with fresh demo data         |
| `pnpm scan:key` | After `pnpm build`: prove the Google key isn't in any browser file |
| `pnpm format`   | Tidy the code's formatting                                         |

## What's built and what's deferred

See `docs/superpowers/specs/2026-09-28-command-center-design.md` for the plan, and `docs/ideas.md` for everything waiting until there's revenue.
