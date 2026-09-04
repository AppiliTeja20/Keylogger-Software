# Keylogger Software — Educational Demo

## Objective

Demonstrate, for a college assignment on input handling and local logging, how keystroke
events can be captured, timestamped, displayed live, and written to a local log file —
**safely and transparently**, with no system-wide monitoring of any kind.

## Description

This is a small Node.js + Express web application that runs entirely on your own computer
(`localhost` only). It shows a dashboard with a single designated **Test Keyboard Area**.
When you explicitly press **Start Recording** (after giving consent), every `keydown` and
`keyup` event typed *inside that one text box* is timestamped, shown live on screen, and
appended to a local log file. Nothing typed anywhere else on your computer — in any other
field, window, or application — is ever seen by this app.

This project started from a public `node-keylogger` repository that captured keystrokes by
reading the Linux kernel's raw input device (`/dev/input/eventX`) — a system-wide, global
keyboard hook. That capture method has been **completely removed** and replaced with the
scoped, in-browser approach described above. See [Security and Ethical Considerations](#security-and-ethical-considerations)
and the note at the bottom of this file for details.

## Features

- Clear project title and an explicit **educational-use / consent notice** shown before any
  recording can start
- Consent checkbox that gates the Start Recording button
- Visible **Start Recording** / **Stop Recording** buttons
- Always-visible **recording status indicator** (pulsing red = live, grey = off)
- One designated **Test Keyboard Area** — the only place keystrokes are ever captured
- **Live event display** showing each captured keystroke with a timestamp as it happens
- Keystrokes are saved to a **local log file** (`logs/keylog.log`)
- **Log Viewer** table that reads and displays the saved log on demand
- **Clear Log** button (with confirmation) to wipe the saved log
- **Export Log** button to download the log as a formatted `.json` file
- Friendly success/error messages for every action
- Responsive, professional cybersecurity-themed dashboard UI

## Technologies Used

- **Node.js** — runtime
- **Express** — local web server and small JSON API (only third-party dependency)
- **HTML / CSS / vanilla JavaScript** — dashboard front end (no framework, no build step)
- Local filesystem (`fs`) — log storage; no database, no external services

## Installation

1. Make sure [Node.js](https://nodejs.org) (v16 or newer) is installed:
   ```
   node -v
   ```
2. From inside the project folder, install the one dependency:
   ```
   npm install
   ```

## Running the Project

```
npm start
```

Then open your browser to:

```
http://localhost:3000
```

The server only binds to `127.0.0.1` (localhost) and prints a confirmation banner in the
terminal. Press `Ctrl+C` in the terminal to stop the server completely — there is no
background process left running.

## How to Use the Application

1. Read the **educational use & consent notice** at the top of the page.
2. Check **"I understand this is an authorized educational demonstration…"**.
3. Click **Start Recording**. The status indicator turns red and pulses, and the Test
   Keyboard Area becomes active.
4. Click into the **Test Keyboard Area** and type a short demo sentence (do **not** type
   real passwords or personal information).
5. Watch keystrokes appear instantly in **Live captured events**, each with a timestamp.
6. Click **Stop Recording** when you're done. The status indicator turns grey.
7. Scroll down to the **Local log viewer** and click **Refresh Log** to see everything that
   was saved to `logs/keylog.log`.
8. Use **Export Log** to download a timestamped `.json` copy, or **Clear Log** to wipe the
   saved file (you'll be asked to confirm first).

## Project Structure

```
keylogger-software-educational-demo/
├── package.json          # dependencies + npm start script
├── server.js             # Express server: serves the UI, saves/reads/clears/exports the log
├── public/
│   ├── index.html        # dashboard markup (consent notice, controls, viewer)
│   ├── style.css          # cybersecurity-themed dashboard styling
│   └── app.js             # scoped keystroke capture + all dashboard logic
├── logs/
│   └── keylog.log         # created automatically at runtime (local log storage)
├── .gitignore
└── README.md
```

## Security and Ethical Considerations

This project is built for **authorized educational demonstration only** — showing how
input events can be captured and logged, not for monitoring anyone without their knowledge.

**What this application does:**
- Captures keystrokes **only** from the single Test Keyboard Area, and **only** while
  recording is explicitly turned on
- Requires the user to check a consent box before recording is even possible
- Shows a clear, constant on-screen indicator whenever recording is active
- Stores logs **locally only**, in a plain file on the machine running the server
- Runs only while you run it, in a visible terminal and browser tab

**What this application deliberately does NOT do:**
- No global or system-wide keyboard hook of any kind (no `iohook`, no
  `node-global-key-listener`, no `uiohook-napi`, no raw `/dev/input` access — the
  original project's OS-level hook was removed entirely)
- No stealth mode, no hidden windows, no background/minimized operation
- No persistence or auto-start mechanism (no service install, no registry key, no cron/
  startup entry) — it never runs unless you manually start it
- No capturing of passwords or credentials — there is no password field anywhere in this
  app, and the consent notice explicitly instructs users not to type sensitive data into
  the test area
- No monitoring of other applications, browsers, or system-wide input
- No network transmission of any kind — the server makes no outbound requests, and logs
  never leave the local machine

**Use this software only on your own systems, or with the explicit, informed consent of
anyone whose test keystrokes are being recorded.** Using keystroke-logging software against
people without their knowledge or consent is unethical and illegal in most jurisdictions.

## Sample Demonstration Procedure

A short, repeatable walkthrough suitable for a live college project demo:

1. Run `npm start` and open `http://localhost:3000` in a browser, screen-sharing if remote.
2. Point out the consent notice and explain why it exists before checking it.
3. Click **Start Recording** and highlight the status indicator turning on.
4. Type a short sentence, e.g. `Hello Professor, this is a logging demo.` in the Test
   Keyboard Area, narrating that each keystroke is appearing live with a timestamp.
5. Click **Stop Recording** and show the indicator turning off.
6. Open the **Local log viewer**, click **Refresh Log**, and show the same events now
   persisted with timestamps.
7. Click **Export Log** to show a downloadable `.json` file was produced locally.
8. Click **Clear Log**, confirm the prompt, and refresh to show the log is now empty.
9. (Optional) Try typing in the browser's address bar or another field to demonstrate that
   nothing is captured outside the designated test area — reinforcing the scoped design.

---

### Note on the original project

The uploaded starting point (`node-keylogger`) worked by opening `/dev/input/eventX` and
parsing raw Linux input-device packets — a global, OS-level keyboard hook capable of
recording every keystroke typed anywhere on the machine, regardless of which window had
focus. That file (`src/index.js`) and its supporting keycode table (`src/keycodes.js`) have
been removed rather than adapted, because there is no safe way to scope that capture
method to a single on-screen field — the hook itself operates below and outside the
browser/application layer. The capture mechanism in this version is built from scratch as a
browser `keydown`/`keyup` listener attached to one `<textarea>`, which is the only approach
that can honestly satisfy "visible, consent-based, scoped-to-one-field" capture.
