# Vacancy Desk Command Center

An internal tool for running Vacancy Desk's sales process: leads, mystery shops, calls, pipeline, ROI, audits and pilots. Right now it's a **$0 build that runs only on your Mac**. It has no cloud services, no API keys and no credit card anywhere.

> **Status:** design stage (Checkpoint A). The app code doesn't exist yet. The commands in step 5 below start working once the Foundation step is built. Steps 1–4 you can do today.

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

### 5. Start the app _(works once the Foundation step is built)_

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

- **Your data lives in the `.data/` folder on this Mac only.** Use _Settings → Data → Download backup_ weekly, and save the file somewhere safe, like iCloud Drive.
- **Only run one copy of the app at a time.** The local database can't be shared between two copies.
- **Cost is $0.** If any step ever asks for a credit card, stop. That isn't part of this build.

### If something goes wrong

| What you see                            | What to do                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `command not found: node` or `pnpm`     | Quit Terminal with ⌘ + Q, reopen it, and try again. If it still fails, repeat step 2 or 3. |
| `Port 3000 is already in use`           | Another copy is running. Find that Terminal window and press Ctrl + C.                     |
| `database is locked` / `already in use` | Same cause: close the other copy of the app.                                               |
| Anything else                           | Copy the whole error message and paste it to Claude.                                       |

---

## What's built and what's deferred

See `docs/superpowers/specs/2026-09-28-command-center-design.md` for the plan, and `docs/ideas.md` for everything waiting until there's revenue.
