/**
 * app.js — Keylogger Software: Educational Demo (frontend)
 * -----------------------------------------------------------------------
 * IMPORTANT SCOPE NOTE:
 * The only keyboard listeners in this entire file are attached to the
 * single #testArea <textarea> element (see the two addEventListener
 * calls near the bottom that reference `testArea`). There is no
 * document-level or window-level keydown/keyup listener anywhere in
 * this app, so typing outside that one box is never seen by this code.
 * -----------------------------------------------------------------------
 */

// ---- DOM references --------------------------------------------------
const consentCheckbox = document.getElementById('consentCheckbox');
const consentHint = document.getElementById('consentHint');

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusPill = document.getElementById('statusPill');
const testArea = document.getElementById('testArea');
const messageBar = document.getElementById('messageBar');

const liveFeed = document.getElementById('liveFeed');
const liveCount = document.getElementById('liveCount');

const refreshLogBtn = document.getElementById('refreshLogBtn');
const exportLogBtn = document.getElementById('exportLogBtn');
const clearLogBtn = document.getElementById('clearLogBtn');
const logMessageBar = document.getElementById('logMessageBar');
const logTableBody = document.getElementById('logTableBody');
const logCount = document.getElementById('logCount');

// ---- App state ----------------------------------------------------------
let isRecording = false;
let sessionEventCount = 0;
let pendingEvents = []; // buffered events waiting to be flushed to the server
let flushTimer = null;

const FLUSH_INTERVAL_MS = 700;

// ---- Small UI helpers -----------------------------------------------------
function setMessage(el, text, type) {
  el.textContent = text || '';
  el.classList.remove('is-success', 'is-error');
  if (type === 'success') el.classList.add('is-success');
  if (type === 'error') el.classList.add('is-error');
}

function formatTime(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString(undefined, { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  } catch (e) {
    return isoString;
  }
}

// ---- Consent gating ---------------------------------------------------------
consentCheckbox.addEventListener('change', () => {
  const consented = consentCheckbox.checked;
  startBtn.disabled = !consented || isRecording;
  consentHint.textContent = consented
    ? 'Consent recorded for this session. You may start recording.'
    : 'Check the consent box above to enable recording controls.';
});

// ---- Recording controls ---------------------------------------------------
function updateStatusUI() {
  if (isRecording) {
    statusPill.classList.remove('status-off');
    statusPill.classList.add('status-on');
    statusPill.innerHTML = '<span class="status-dot" aria-hidden="true"></span> Recording ON — capturing keys in test area';
  } else {
    statusPill.classList.remove('status-on');
    statusPill.classList.add('status-off');
    statusPill.innerHTML = '<span class="status-dot" aria-hidden="true"></span> Recording off';
  }
}

startBtn.addEventListener('click', () => {
  if (!consentCheckbox.checked) {
    setMessage(messageBar, 'You must check the consent box before recording.', 'error');
    return;
  }
  isRecording = true;
  testArea.disabled = false;
  testArea.placeholder = 'Recording is ON. Type here — every keystroke in this box is being captured.';
  testArea.focus();
  startBtn.disabled = true;
  stopBtn.disabled = false;
  updateStatusUI();
  setMessage(messageBar, 'Recording started. Keystrokes typed in the test area below are now being captured.', 'success');
  startFlushTimer();
});

stopBtn.addEventListener('click', () => {
  isRecording = false;
  testArea.disabled = true;
  testArea.placeholder = 'Recording is off. Press "Start Recording" to begin again.';
  startBtn.disabled = !consentCheckbox.checked;
  stopBtn.disabled = true;
  updateStatusUI();
  flushPendingEvents(); // make sure nothing captured right before Stop is lost
  stopFlushTimer();
  setMessage(messageBar, 'Recording stopped. No further keystrokes are being captured.', 'success');
});

// ---- Scoped keystroke capture: attached ONLY to #testArea -------------------
function captureEvent(domEvent, type) {
  if (!isRecording) return; // extra guard: never record while off, even if listener fires

  const evt = {
    type: type, // 'keydown' or 'keyup'
    key: domEvent.key,
    code: domEvent.code,
    timestamp: new Date().toISOString()
  };

  sessionEventCount += 1;
  liveCount.textContent = sessionEventCount + ' events';
  renderLiveEvent(evt);

  pendingEvents.push(evt);
}

testArea.addEventListener('keydown', (e) => captureEvent(e, 'keydown'));
testArea.addEventListener('keyup', (e) => captureEvent(e, 'keyup'));

function renderLiveEvent(evt) {
  if (liveFeed.querySelector('.feed-empty')) {
    liveFeed.innerHTML = '';
  }
  const row = document.createElement('div');
  row.className = 'feed-row';
  row.innerHTML =
    '<span class="feed-time">' + formatTime(evt.timestamp) + '</span>' +
    '<span class="feed-type">' + evt.type + '</span>' +
    '<span class="feed-key">' + escapeHtml(evt.key) + ' <span style="color:var(--text-faint)">(' + escapeHtml(evt.code) + ')</span></span>';
  liveFeed.insertBefore(row, liveFeed.firstChild);

  // Cap the visible feed so the DOM doesn't grow unbounded in a long demo
  const rows = liveFeed.querySelectorAll('.feed-row');
  if (rows.length > 200) {
    rows[rows.length - 1].remove();
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---- Sending captured events to the local server for logging ----------------
function startFlushTimer() {
  stopFlushTimer();
  flushTimer = setInterval(flushPendingEvents, FLUSH_INTERVAL_MS);
}

function stopFlushTimer() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

async function flushPendingEvents() {
  if (pendingEvents.length === 0) return;
  const batch = pendingEvents;
  pendingEvents = [];

  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error((data && data.error) || 'Unknown error saving events.');
    }
  } catch (err) {
    // Put the batch back so we retry on the next flush, and let the user know.
    pendingEvents = batch.concat(pendingEvents);
    setMessage(messageBar, 'Could not save events to the local log: ' + err.message, 'error');
  }
}

// Best-effort flush if the user navigates away mid-recording.
window.addEventListener('beforeunload', () => {
  if (pendingEvents.length > 0) {
    const blob = new Blob([JSON.stringify({ events: pendingEvents })], { type: 'application/json' });
    navigator.sendBeacon('/api/events', blob);
  }
});

// ---- Log viewer ---------------------------------------------------------------
async function loadLog() {
  try {
    const res = await fetch('/api/log');
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error((data && data.error) || 'Failed to load log.');
    }
    renderLogTable(data.entries);
    logCount.textContent = data.count + ' saved events';
    setMessage(logMessageBar, '', null);
  } catch (err) {
    setMessage(logMessageBar, 'Could not load the log file: ' + err.message, 'error');
  }
}

function renderLogTable(entries) {
  if (!entries || entries.length === 0) {
    logTableBody.innerHTML = '<tr><td colspan="5" class="empty-row">No saved log entries yet.</td></tr>';
    return;
  }
  logTableBody.innerHTML = entries
    .map((evt, i) => {
      return (
        '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + escapeHtml(evt.timestamp) + '</td>' +
        '<td>' + escapeHtml(evt.type) + '</td>' +
        '<td>' + escapeHtml(evt.key) + '</td>' +
        '<td>' + escapeHtml(evt.code) + '</td>' +
        '</tr>'
      );
    })
    .join('');
}

refreshLogBtn.addEventListener('click', loadLog);

clearLogBtn.addEventListener('click', async () => {
  const confirmed = window.confirm('This will permanently delete all saved log entries. Continue?');
  if (!confirmed) return;

  try {
    const res = await fetch('/api/log', { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error((data && data.error) || 'Failed to clear log.');
    }
    setMessage(logMessageBar, 'Log cleared successfully.', 'success');
    await loadLog();
  } catch (err) {
    setMessage(logMessageBar, 'Could not clear the log: ' + err.message, 'error');
  }
});

exportLogBtn.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/log/export');
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to export log.');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="(.+)"/);
    a.href = url;
    a.download = match ? match[1] : 'keylog-export.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMessage(logMessageBar, 'Log exported and downloaded.', 'success');
  } catch (err) {
    setMessage(logMessageBar, 'Could not export the log: ' + err.message, 'error');
  }
});

// ---- Initial page setup ---------------------------------------------------------
updateStatusUI();
loadLog();
