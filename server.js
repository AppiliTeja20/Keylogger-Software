/**
 * server.js
 * -----------------------------------------------------------------------
 * Keylogger Software — Educational Demo (backend)
 *
 * WHAT THIS SERVER DOES:
 *   - Serves the front-end dashboard (public/) over localhost only.
 *   - Accepts keystroke events that the BROWSER already captured from a
 *     single designated <textarea> (see public/app.js) and appends them
 *     to a local, plain-text JSON-lines log file.
 *   - Lets the dashboard read, clear, and export that same local file.
 *
 * WHAT THIS SERVER DELIBERATELY DOES NOT DO:
 *   - It does not hook the OS keyboard, read /dev/input, register any
 *     global/system-wide input listener, or run any native module.
 *   - It never reaches out to the network — there is no fetch/axios/http
 *     client call anywhere in this file. Logs never leave this machine.
 *   - It has no auto-start/persistence hook (no service install, no
 *     registry/cron/startup entry). It only runs while you run it.
 * -----------------------------------------------------------------------
 */

'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const HOST = '127.0.0.1'; // localhost only — never exposed to the network

const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'keylog.log'); // JSON-lines: one event per line

// Make sure the local logs directory exists before anything tries to write to it.
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, '', 'utf8');
}

app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Basic shape validation for an incoming keystroke event. Keeps the log
 * file predictable and rejects obviously malformed payloads instead of
 * writing garbage to disk.
 */
function isValidEvent(evt) {
  return (
    evt &&
    typeof evt === 'object' &&
    typeof evt.type === 'string' &&
    typeof evt.key === 'string' &&
    typeof evt.timestamp === 'string' &&
    evt.key.length <= 40 &&
    evt.type.length <= 20
  );
}

/**
 * POST /api/events
 * Body: { events: [ { type, key, code, timestamp }, ... ] }
 * Appends each valid event as one JSON line to the local log file.
 * This is the ONLY write path into the log — and it only ever receives
 * events the browser generated from the single test textarea while
 * recording was explicitly turned on (see public/app.js).
 */
app.post('/api/events', (req, res) => {
  try {
    const events = Array.isArray(req.body && req.body.events) ? req.body.events : null;

    if (!events || events.length === 0) {
      return res.status(400).json({ ok: false, error: 'No events supplied.' });
    }

    const validEvents = events.filter(isValidEvent);
    if (validEvents.length === 0) {
      return res.status(400).json({ ok: false, error: 'No valid events in payload.' });
    }

    const lines = validEvents
      .map((evt) =>
        JSON.stringify({
          timestamp: evt.timestamp,
          type: evt.type,
          key: evt.key,
          code: typeof evt.code === 'string' ? evt.code.slice(0, 40) : ''
        })
      )
      .join('\n') + '\n';

    fs.appendFileSync(LOG_FILE, lines, 'utf8');

    return res.json({ ok: true, saved: validEvents.length });
  } catch (err) {
    console.error('Failed to append to log file:', err.message);
    return res.status(500).json({ ok: false, error: 'Server failed to save events.' });
  }
});

/**
 * GET /api/log
 * Reads the local log file and returns it as a parsed JSON array,
 * newest entries last (same order they were recorded).
 */
app.get('/api/log', (req, res) => {
  try {
    const raw = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = raw.split('\n').filter((line) => line.trim().length > 0);

    const entries = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch (parseErr) {
        // Skip any corrupted line instead of failing the whole request.
        continue;
      }
    }

    return res.json({ ok: true, count: entries.length, entries });
  } catch (err) {
    console.error('Failed to read log file:', err.message);
    return res.status(500).json({ ok: false, error: 'Server failed to read the log file.' });
  }
});

/**
 * DELETE /api/log
 * Clears the local log file completely.
 */
app.delete('/api/log', (req, res) => {
  try {
    fs.writeFileSync(LOG_FILE, '', 'utf8');
    return res.json({ ok: true, message: 'Log cleared.' });
  } catch (err) {
    console.error('Failed to clear log file:', err.message);
    return res.status(500).json({ ok: false, error: 'Server failed to clear the log file.' });
  }
});

/**
 * GET /api/log/export
 * Sends the current log back as a downloadable, nicely formatted JSON
 * file. This is a local file download (browser Save dialog) — nothing
 * is transmitted anywhere else.
 */
app.get('/api/log/export', (req, res) => {
  try {
    const raw = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = raw.split('\n').filter((line) => line.trim().length > 0);
    const entries = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);

    const exportPayload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        totalEvents: entries.length,
        events: entries
      },
      null,
      2
    );

    const filename = `keylog-export-${Date.now()}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(exportPayload);
  } catch (err) {
    console.error('Failed to export log file:', err.message);
    return res.status(500).json({ ok: false, error: 'Server failed to export the log file.' });
  }
});

// Fallback error handler so a bad request never crashes the process.
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.message);
  res.status(500).json({ ok: false, error: 'Unexpected server error.' });
});

app.listen(PORT, HOST, () => {
  console.log('=============================================================');
  console.log(' Keylogger Software — Educational Demo');
  console.log(` Running locally at: http://localhost:${PORT}`);
  console.log(' This server only listens on localhost and makes no outbound');
  console.log(' network calls. Logs are stored at: ' + LOG_FILE);
  console.log('=============================================================');
});
