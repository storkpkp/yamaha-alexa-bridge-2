const { SinricPro: SinricProClass, SinricProTV } = require('sinricpro');
const SinricPro = SinricProClass.getInstance();
const http = require('http');
const path = require('path');
const fs = require('fs');

// --- Terminal Colors ---
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function logAlexa(message) {
  console.log(`${COLORS.magenta}[Alexa] ${message}${COLORS.reset}`);
}

function logYamaha(message) {
  console.log(`${COLORS.green}[Yamaha] ${message}${COLORS.reset}`);
}

function logSinric(message) {
  console.log(`${COLORS.cyan}[SinricPro] ${message}${COLORS.reset}`);
}

function logError(message) {
  console.error(`${COLORS.red}${message}${COLORS.reset}`);
}
// --- Load Configuration ---
const configPath = path.join(__dirname, 'config.json');

if (!fs.existsSync(configPath)) {
  console.error('ERROR: config.json not found.');
  console.error('Copy config.example.json to config.json and fill in your settings.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Validate config
const required = [
  ['yamaha.ip', config.yamaha?.ip],
  ['yamaha.zone', config.yamaha?.zone],
  ['sinricpro.appKey', config.sinricpro?.appKey],
  ['sinricpro.appSecret', config.sinricpro?.appSecret],
  ['sinricpro.deviceId', config.sinricpro?.deviceId],
];

for (const [name, value] of required) {
  if (!value || value.startsWith('YOUR_')) {
    console.error(`ERROR: "${name}" is not set in config.json.`);
    process.exit(1);
  }
}

const YAMAHA_IP = config.yamaha.ip;
const YAMAHA_ZONE = config.yamaha.zone;
const APP_KEY = config.sinricpro.appKey;
const APP_SECRET = config.sinricpro.appSecret;
const DEVICE_ID = config.sinricpro.deviceId;
const STATUS_PORT = Number(config.statusPort || 3000);
const bridgeStatus = {
  yamaha: {
    connected: false,
    power: 'Unknown',
    volume: null,
    maxVolume: null,
    input: 'Unknown',
    mute: 'Unknown',
    lastUpdate: null,
    error: null,
  },
  sinricPro: {
    connected: false,
  },
};

// --- Live Dashboard ---
const dashboardClients = new Set();
let lastBroadcastStatus = '';

function getDashboardSnapshot() {
  const y = bridgeStatus.yamaha;

  return {
    yamaha: {
      connected: y.connected,
      power: y.power,
      volume: y.volume,
      maxVolume: y.maxVolume,
      input: y.input,
      mute: y.mute,
      error: y.error,
    },
    sinricPro: {
      connected: bridgeStatus.sinricPro.connected,
    },
  };
}

function broadcastStatus() {
  const snapshot = getDashboardSnapshot();
  const status = JSON.stringify(snapshot);

  if (status === lastBroadcastStatus) {
    return;
  }

  lastBroadcastStatus = status;

  for (const client of dashboardClients) {
    try {
      client.write(`data: ${status}\n\n`);
    } catch (err) {
      dashboardClients.delete(client);
    }
  }
}
// Map Alexa input names to Yamaha input IDs
const INPUT_MAP = config.yamaha.inputMap || {
  'HDMI 1':     'hdmi1',
  'HDMI 2':     'hdmi2',
  'HDMI 3':     'hdmi3',
  'HDMI 4':     'hdmi4',
  'AV 1':       'av1',
  'AV 2':       'av2',
  'AV 3':       'av3',
  'AUX':        'aux',
  'AUDIO 1':    'audio1',
  'AUDIO 2':    'audio2',
  'AUDIO 3':    'audio3',
  'USB':        'usb',
  'Bluetooth':  'bluetooth',
  'Spotify':    'spotify',
  'AirPlay':    'airplay',
  'TUNER':      'tuner',
  'NET RADIO':  'net_radio',
  'Server':     'server',
};

// --- Yamaha Receiver API ---
function yamahaGet(apiPath) {
  const url = `http://${YAMAHA_IP}/YamahaExtendedControl/v1${apiPath}`;

  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          logError(`[Yamaha API] JSON parse failed: ${e.message}`);
          reject(new Error(`Bad response from receiver: ${data}`));
        }
      });
    }).on('error', (err) => {
      logError(`[Yamaha API] Request failed: ${err.message}`);
      reject(err);
    });
  });
}
async function getYamahaStatus() {
  const status = await yamahaGet(`/${YAMAHA_ZONE}/getStatus`);

  bridgeStatus.yamaha.connected = true;
  bridgeStatus.yamaha.power = status.power ?? 'Unknown';
  bridgeStatus.yamaha.volume = status.volume ?? null;
  bridgeStatus.yamaha.maxVolume = status.max_volume ?? null;
  bridgeStatus.yamaha.input = status.input ?? 'Unknown';
  bridgeStatus.yamaha.mute = status.mute ?? 'Unknown';
  bridgeStatus.yamaha.lastUpdate = new Date().toISOString();
  bridgeStatus.yamaha.error = null;

  broadcastStatus();

  return status;
}

let statusPollInProgress = false;

async function pollYamahaStatus() {
  if (statusPollInProgress) {
    return;
  }

  statusPollInProgress = true;

  try {
    await getYamahaStatus();
  } catch (err) {
    bridgeStatus.yamaha.connected = false;
    bridgeStatus.yamaha.error = err.message;

    broadcastStatus();
  } finally {
    statusPollInProgress = false;
  }
}
async function setYamahaPower(on) {
  const state = on ? 'on' : 'standby';

  const result = await yamahaGet(
    `/${YAMAHA_ZONE}/setPower?power=${state}`
  );

  bridgeStatus.yamaha.power = state === 'on' ? 'on' : 'standby';
  bridgeStatus.yamaha.lastUpdate = new Date().toISOString();

  broadcastStatus();

  return result;
}

async function setYamahaVolume(percent) {
  const maxVolume = bridgeStatus.yamaha.maxVolume || 161;
  const volume = Math.round((percent * maxVolume) / 100);

  const result = await yamahaGet(
    `/${YAMAHA_ZONE}/setVolume?volume=${volume}`
  );

  bridgeStatus.yamaha.volume = volume;
  bridgeStatus.yamaha.maxVolume = maxVolume;
  bridgeStatus.yamaha.lastUpdate = new Date().toISOString();

  broadcastStatus();

  return result;
}

async function setYamahaMute(mute) {
  const result = await yamahaGet(
    `/${YAMAHA_ZONE}/setMute?enable=${mute}`
  );

  bridgeStatus.yamaha.mute = mute ? 'on' : 'off';
  bridgeStatus.yamaha.lastUpdate = new Date().toISOString();

  broadcastStatus();

  return result;
}

async function setYamahaInput(inputId) {
  const result = await yamahaGet(
    `/${YAMAHA_ZONE}/setInput?input=${inputId}`
  );

  bridgeStatus.yamaha.input = inputId;
  bridgeStatus.yamaha.lastUpdate = new Date().toISOString();

  broadcastStatus();

  return result;
}

async function setYamahaPlayback(action) {
  const result = await yamahaGet(`/netusb/setPlayback?playback=${action}`);
  //console.log(`[Yamaha] Playback -> ${action}`);
  return result;
}
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });

  res.end(JSON.stringify(data));
}

async function handleStatusCommand(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Power
    if (url.pathname === '/api/power' && req.method === 'POST') {
      const state = url.searchParams.get('state');

      if (state !== 'on' && state !== 'off') {
        return sendJson(res, 400, {
          success: false,
          error: 'Invalid power state',
        });
      }

      await setYamahaPower(state === 'on');
     

      return sendJson(res, 200, {
        success: true,
      });
    }

    // Mute
    if (url.pathname === '/api/mute' && req.method === 'POST') {
      const state = url.searchParams.get('state');

      if (state !== 'on' && state !== 'off') {
        return sendJson(res, 400, {
          success: false,
          error: 'Invalid mute state',
        });
      }

      await setYamahaMute(state === 'on');

      return sendJson(res, 200, {
        success: true,
      });
    }

    // Volume
    if (url.pathname === '/api/volume' && req.method === 'POST') {
      const volume = Number(url.searchParams.get('value'));

      if (!Number.isFinite(volume) || volume < 0 || volume > 100) {
        return sendJson(res, 400, {
          success: false,
          error: 'Volume must be between 0 and 100',
        });
      }

      await setYamahaVolume(volume);
      

      return sendJson(res, 200, {
        success: true,
      });
    }

    // Input
    if (url.pathname === '/api/input' && req.method === 'POST') {
      const input = url.searchParams.get('input');

      if (!input) {
        return sendJson(res, 400, {
          success: false,
          error: 'Input is required',
        });
      }

      await setYamahaInput(input);
      

      return sendJson(res, 200, {
        success: true,
      });
    }

    return false;

  } catch (err) {
    console.error('[Status] Command failed:', err.message);

    sendJson(res, 500, {
      success: false,
      error: err.message,
    });

    return true;
  }
}
function startStatusServer() {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/api/status' && req.method === 'GET') {
      return sendJson(res, 200, bridgeStatus);
    }
    if (req.url === '/api/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
  });

  res.write(`data: ${JSON.stringify(bridgeStatus)}\n\n`);

  dashboardClients.add(res);

  req.on('close', () => {
    dashboardClients.delete(res);
  });

  return;
}
    if (
      req.url.startsWith('/api/power') ||
      req.url.startsWith('/api/mute') ||
      req.url.startsWith('/api/volume') ||
      req.url.startsWith('/api/input')
    ) {
      const handled = await handleStatusCommand(req, res);

      if (handled !== false) {
        return;
      }
    }

    if (req.url === '/' || req.url === '/index.html') {
      const yamaha = bridgeStatus.yamaha;
      const sinric = bridgeStatus.sinricPro;

      const volumePercent =
        yamaha.volume !== null && yamaha.maxVolume
          ? Math.round(
              (yamaha.volume / yamaha.maxVolume) * 100
            )
          : 'Unknown';

      const lastUpdate = yamaha.lastUpdate
        ? new Date(yamaha.lastUpdate).toLocaleString()
        : 'Never';

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yamaha Alexa Bridge</title>

  <style>

  button {
  padding: 10px 18px;
  margin: 5px;
  border: none;
  border-radius: 6px;
  background: #333;
  color: white;
  cursor: pointer;
  font-size: 15px;
}

button:hover {
  background: #555;
}

select {
  padding: 10px;
  margin: 5px;
  border-radius: 6px;
  font-size: 15px;
}

.control-section {
  margin-bottom: 20px;
}

.control-section h3 {
  margin-bottom: 8px;
}

#commandStatus {
  margin-top: 15px;
  color: #666;
  font-size: 14px;
}

.volume-display {
  text-align: center;
  font-size: 32px;
  font-weight: bold;
  margin: 15px 0;
}

#volumeSlider {
  width: 100%;
  margin: 10px 0 20px 0;
  cursor: pointer;
}

.volume-buttons {
  text-align: center;
}

.volume-buttons button {
  width: 70px;
  font-size: 22px;
}
    body {
      font-family: Arial, sans-serif;
      background: #f2f2f2;
      margin: 0;
      padding: 30px;
      color: #222;
    }

    .container {
      max-width: 700px;
      margin: auto;
    }

    .card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    h1 {
      margin-bottom: 5px;
    }

    .subtitle {
      color: #666;
      margin-bottom: 25px;
    }

    .row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #eee;
    }

    .row:last-child {
      border-bottom: none;
    }

    .label {
      font-weight: bold;
    }

    .connected {
      color: green;
      font-weight: bold;
    }

    .disconnected {
      color: red;
      font-weight: bold;
    }

    .footer {
      text-align: center;
      color: #777;
      font-size: 13px;
    }
    
    #muteButton {
  font-size: 14px;
  text-align: center;
  padding: 10px 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
  </style>
</head>

<body>

<div class="container">

  <h1>Yamaha Alexa Bridge</h1>

  <div class="subtitle">
    Receiver Status Dashboard
  </div>

  <div class="card">
    <h2>Connections</h2>

    <div class="row">
      <span class="label">Yamaha Receiver</span>
      <span id="yamahaConnection" class="${yamaha.connected ? 'connected' : 'disconnected'}">
        ${yamaha.connected ? 'Connected' : 'Disconnected'}
      </span>
    </div>

    <div class="row">
      <span class="label">Sinric Pro</span>
      <span id="sinricConnection" class="${sinric.connected ? 'connected' : 'disconnected'}">
        ${sinric.connected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  </div>

  <div class="card">
    <h2>Receiver Status</h2>

    <div class="row">
      <span class="label">Power</span>
      <span id="powerStatus">${yamaha.power}</span>
    </div>

    <div class="row">
      <span class="label">Volume</span>
      <span id="volumeStatus">
        ${yamaha.volume ?? 'Unknown'}
        /
        ${yamaha.maxVolume ?? 'Unknown'}
        (${volumePercent}%)
      </span>
    </div>
<div class="card">
  <h2>Controls</h2>

  <div class="control-section">
    <h3>Power</h3>

    <button onclick="sendCommand('/api/power?state=on')">
      Power On
    </button>

    <button onclick="sendCommand('/api/power?state=off')">
      Standby
    </button>
  </div>

  <div class="control-section">
    <h3>Volume</h3>

  <div class="volume-display">
    <span id="volumeValue">
      ${volumePercent}%
    </span>
  </div>

  <input
    type="range"
    id="volumeSlider"
    min="0"
    max="100"
    value="${
      yamaha.volume !== null && yamaha.maxVolume
        ? Math.round(
            (yamaha.volume / yamaha.maxVolume) * 100
          )
        : 0
    }"
    oninput="updateVolumeDisplay(this.value)"
    onchange="setVolumeFromSlider(this.value)"
  >

  <div class="volume-buttons">

    <button onclick="adjustVolume(-5)">
      −
    </button>

    <button onclick="adjustVolume(5)">
      +
    </button>

  <button
    id="muteButton"
    onclick="toggleMute()"
  >
    ${String(yamaha.mute).toLowerCase() === 'on'
      ? 'Unmute'
      : 'Mute'}
  </button>

  </div>
</div>

  <div class="control-section">
    <h3>Input</h3>

    <select onchange="changeInput(this.value)">
      <option value="">Select Input</option>

      ${Object.entries(INPUT_MAP)
        .map(([name, id]) =>
          `<option value="${id}" ${
            yamaha.input === id ? 'selected' : ''
          }>${name}</option>`
        )
        .join('')}
    </select>
  </div>

  <div id="commandStatus"></div>
</div>

    <div class="row">
      <span class="label">Mute</span>
      <span id="muteStatus">${yamaha.mute}</span>
    </div>

    <div class="row">
      <span class="label">Input</span>
      <span id="inputStatus">${yamaha.input}</span>
    </div>

    <div class="row">
      <span class="label">Zone</span>
      <span>${YAMAHA_ZONE}</span>
    </div>
  </div>

  <div class="card">
    <h2>Bridge Information</h2>

    <div class="row">
      <span class="label">Yamaha IP</span>
      <span>${YAMAHA_IP}</span>
    </div>

    <div class="row">
      <span class="label">Last Update</span>
      <span>${lastUpdate}</span>
    </div>
  </div>

  <div class="footer">
    Status updates automatically after commands
  </div>

</div>

<script>

let pendingVolumePercent = null;

async function sendCommand(url) {
  console.log('[Dashboard] Button clicked:', url);

  const status = document.getElementById('commandStatus');

  status.textContent = 'Sending command...';
  console.time('[Dashboard] Command');

  try {
    const response = await fetch(url, {
      method: 'POST'
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Command failed');
    }

    status.textContent = 'Command successful';
    console.timeEnd('[Dashboard] Command');

    if (url.startsWith('/api/power')) {
      const powerState =
        new URLSearchParams(url.split('?')[1]).get('state');

      document.getElementById('powerStatus').textContent =
        powerState === 'on' ? 'on' : 'standby';
    }

  } catch (err) {
    status.textContent = 'Error: ' + err.message;
  }
}

async function changeInput(input) {
  if (!input) {
    return;
  }

  await sendCommand(
    '/api/input?input=' + encodeURIComponent(input)
  );

  document.getElementById('inputStatus').textContent = input;
}

async function toggleMute() {
  const currentMute =
    document.getElementById('muteStatus').textContent.toLowerCase() === 'on';

  const newState = currentMute ? 'off' : 'on';

  await sendCommand(
    '/api/mute?state=' + newState
  );

  document.getElementById('muteStatus').textContent =
    newState === 'on' ? 'on' : 'off';

  document.getElementById('muteButton').textContent =
    newState === 'on' ? 'Unmute' : 'Mute';
}
function updateDashboardFromStatus(status) {
  const yamaha = status.yamaha;

  // Power
  document.getElementById('powerStatus').textContent =
    yamaha.power;

  // Volume
  if (
    yamaha.volume !== null &&
    yamaha.maxVolume
  ) {
    const percent =
      (yamaha.volume / yamaha.maxVolume) * 100;

    document.getElementById('volumeStatus').textContent =
      yamaha.volume + ' / ' +
      yamaha.maxVolume + ' (' +
      Math.round(percent) + '%)';

    document.getElementById('volumeValue').textContent =
      Math.round(percent) + '%';

    document.getElementById('volumeSlider').value =
      Math.round(percent);

  } else {
    document.getElementById('volumeStatus').textContent =
      'Unknown';

    document.getElementById('volumeValue').textContent =
      'Unknown';
  }

  // Mute
  document.getElementById('muteStatus').textContent =
    yamaha.mute;

  document.getElementById('muteButton').textContent =
    String(yamaha.mute).toLowerCase() === 'on'
      ? 'Unmute'
      : 'Mute';

  // Input
  document.getElementById('inputStatus').textContent =
    yamaha.input;

  // Yamaha connection
  const yamahaConnection =
    document.getElementById('yamahaConnection');

  yamahaConnection.textContent =
    yamaha.connected ? 'Connected' : 'Disconnected';

  yamahaConnection.className =
    yamaha.connected
      ? 'connected'
      : 'disconnected';

  // Sinric Pro connection
  const sinricConnection =
    document.getElementById('sinricConnection');

  sinricConnection.textContent =
    status.sinricPro.connected
      ? 'Connected'
      : 'Disconnected';

  sinricConnection.className =
    status.sinricPro.connected
      ? 'connected'
      : 'disconnected';
}

async function updateDashboard() {
  try {
    const response = await fetch('/api/status', {
      cache: 'no-store'
    });

    const status = await response.json();

    updateDashboardFromStatus(status);

  } catch (err) {
    console.error(
      '[Dashboard] Status update failed:',
      err
    );
  }
}

updateDashboard();

const events = new EventSource('/api/events');

events.onmessage = (event) => {
  const status = JSON.parse(event.data);
  updateDashboardFromStatus(status);
};

function updateVolumeDisplay(value) {
  document.getElementById('volumeValue').textContent =
    Math.round(value) + '%';
}

async function setVolumeFromSlider(value) {
  const status = document.getElementById('commandStatus');

  status.textContent = 'Setting volume...';

  try {
    const response = await fetch(
      '/api/volume?value=' + encodeURIComponent(value),
      {
        method: 'POST'
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(
        result.error || 'Volume command failed'
      );
    }

    status.textContent =
      'Volume set to ' + Math.round(value) + '%';

    document.getElementById('volumeValue').textContent =
      Math.round(value) + '%';

    document.getElementById('volumeSlider').value =
      Math.round(value);

    document.getElementById('volumeStatus').textContent =
      Math.round(value) + '%';
  } catch (err) {
    status.textContent =
      'Error: ' + err.message;
  }
}

async function adjustVolume(amount) {
console.log('[Dashboard] Adjust volume:', amount);


  try {
    const slider = document.getElementById('volumeSlider');

    if (!slider) {
      throw new Error('Volume slider unavailable');
  }

const currentPercent =
  pendingVolumePercent !== null
    ? pendingVolumePercent
    : Number(slider.value);

if (!Number.isFinite(currentPercent)) {
  throw new Error('Current volume unavailable');
}

    const newPercent = Math.max(
      0,
      Math.min(
        100,
        currentPercent + amount
      )
    );

    pendingVolumePercent = newPercent;

    document.getElementById('volumeSlider').value =
     Math.round(newPercent);

    document.getElementById('volumeValue').textContent =
    Math.round(newPercent) + '%';

setVolumeFromSlider(newPercent).catch(err => {
  console.error('[Dashboard] Volume command failed:', err);
});



  } catch (err) {
    document.getElementById('commandStatus').textContent =
      'Error: ' + err.message;
  }
}

</script>

</body>
</html>`;

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });

      res.end(html);
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  server.listen(STATUS_PORT, '0.0.0.0', () => {
  console.log(
    `[Status] Status page available at http://localhost:${STATUS_PORT}`
  );

  setInterval(pollYamahaStatus, 2000);
});
}
// --- Main ---
async function main() {
  startStatusServer();
  console.log('=== Yamaha Alexa Bridge ===');
  console.log(`[Config] Receiver: ${YAMAHA_IP} (${YAMAHA_ZONE})`);

  // Test Yamaha connection
  try {
const status = await getYamahaStatus();

logYamaha('Connected');
console.log(`  Power:          ${status.power}`);
console.log(`  Volume:         ${status.volume} / ${status.max_volume}`);
console.log(`  Input:          ${status.input} (${status.input_text || 'Unknown'})`);
console.log(`  Mute:           ${status.mute}`);
console.log(`  Sound Program:  ${status.sound_program || 'Unknown'}`);
console.log(`  Decoder:        ${status.surr_decoder_type || 'Unknown'}`);
console.log(`  Pure Direct:    ${status.pure_direct ?? 'Unknown'}`);
console.log(`  Enhancer:       ${status.enhancer ?? 'Unknown'}`);
console.log(`  Extra Bass:     ${status.extra_bass ?? 'Unknown'}`);
console.log(`  Adaptive DRC:   ${status.adaptive_drc ?? 'Unknown'}`);

if (status.tone_control) {
  console.log(
    `  Tone:           Bass ${status.tone_control.bass}, ` +
    `Treble ${status.tone_control.treble}`
  );
}

console.log(`  Subwoofer:      ${status.subwoofer_volume ?? 'Unknown'}`);
  } catch (err) {
    console.error(`[Yamaha] Cannot reach receiver at ${YAMAHA_IP}: ${err.message}`);
    process.exit(1);
  }

  // Create TV device
  const receiver = SinricProTV(DEVICE_ID);

  // Power on/off
  receiver.onPowerState(async (deviceId, state) => {
    logAlexa(`Power: ${state ? 'ON' : 'OFF'}`);
    try {
      await setYamahaPower(state);
      return true;
    } catch (err) {
      logError(`[Alexa] Power failed: ${err.message}`);
      return false;
    }
  });

  // Set volume (0-100)
receiver.onVolume(async (deviceId, volume) => {
  logAlexa(`Set volume: ${volume}%`);

  try {
    await setYamahaVolume(Number(volume));
    return true;
  } catch (err) {
    logError(`[Alexa] Set volume failed: ${err.message}`);
    return false;
  }
});


// Adjust volume (relative)
receiver.onAdjustVolume(async (deviceId, delta) => {
  logAlexa(
    `Volume adjust: ${delta > 0 ? '+' : ''}${delta}`
  );

  try {
    const adjustment = Number(delta);

    if (!Number.isFinite(adjustment)) {
      throw new Error(`Invalid volume adjustment: ${delta}`);
    }

    const status = await getYamahaStatus();

    const currentVolume = Number(status.volume);
    const maxVolume = Number(status.max_volume || 161);

    if (!Number.isFinite(currentVolume)) {
      throw new Error(`Invalid Yamaha volume: ${status.volume}`);
    }

    const newVolume = Math.max(
      0,
      Math.min(maxVolume, currentVolume + adjustment)
    );

    await yamahaGet(
      `/${YAMAHA_ZONE}/setVolume?volume=${newVolume}`
    );

    return true;

  } catch (err) {
    logError(`[Alexa] Volume adjust failed: ${err.message}`);
    return false;
  }
});

  // Mute/unmute
  receiver.onMute(async (deviceId, mute) => {
    logAlexa(`Mute: ${mute}`);
    try {
      await setYamahaMute(mute);
      return true;
    } catch (err) {
      logError(`[Alexa] Mute failed: ${err.message}`);
      return false;
    }
  });

  // Media controls (play, pause, stop, next, previous)
  receiver.onMediaControl(async (deviceId, control) => {
    logAlexa(`Media: ${control}`);
    try {
      const controlMap = {
        'Play':           'play',
        'Pause':          'pause',
        'Stop':           'stop',
        'Next':           'next',
        'Previous':       'previous',
        'FastForward':    'fast_forward',
        'Rewind':         'fast_reverse',
      };
      const action = controlMap[control];
      if (action) {
        await setYamahaPlayback(action);
        return true;
      }
      logError(`[Alexa] Unknown media control: ${control}`);
      return false;
    } catch (err) {
      logError(`[Alexa] Media control failed: ${err.message}`);
      return false;
    }
  });

  // Input selection
  receiver.onSelectInput(async (deviceId, input) => {
    logAlexa(`Input: ${input}`);
    try {
      // Try exact match in input map first, then case-insensitive search
      let yamahaInput = INPUT_MAP[input];
      if (!yamahaInput) {
        const key = Object.keys(INPUT_MAP).find(k => k.toLowerCase() === input.toLowerCase());
        yamahaInput = key ? INPUT_MAP[key] : input.toLowerCase().replace(/\s+/g, '_');
      }
      await setYamahaInput(yamahaInput);
      return true;
    } catch (err) {
      logError(`[Alexa] Input switch failed: ${err.message}`);
      return false;
    }
  });

  // Add device and connect
  SinricPro.add(receiver);

  SinricPro.onConnected(() => {
  bridgeStatus.sinricPro.connected = true;

  broadcastStatus();

  logSinric('Connected. Waiting for Alexa commands...');
});

SinricPro.onDisconnected(() => {
  bridgeStatus.sinricPro.connected = false;

  broadcastStatus();

  logError('[SinricPro] Disconnected. Will reconnect automatically...');
});

  await SinricPro.begin({ appKey: APP_KEY, appSecret: APP_SECRET });
}

main().catch(console.error);
