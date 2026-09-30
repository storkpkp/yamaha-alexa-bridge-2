'use strict';

const http = require('http');

function createDashboard({
  yamaha,
  bridgeStatus,
  log,
  port = 8080,
  inputMap = {},
  yamahaIp,
  yamahaZone = 'main',
}) {
  const dashboardClients = new Set();
  let lastBroadcastStatus = '';
  let statusPollInProgress = false;
  let statusInterval = null;

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
        lastUpdate: y.lastUpdate,
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

  async function getYamahaStatus() {
    try {
      const status = await yamaha.getStatus();

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
    } catch (err) {
      bridgeStatus.yamaha.connected = false;
      bridgeStatus.yamaha.error = err.message;

      broadcastStatus();

      throw err;
    }
  }

  async function pollYamahaStatus() {
    if (statusPollInProgress) {
      return;
    }

    statusPollInProgress = true;

    try {
      await getYamahaStatus();
    } catch (err) {
      // Connection state is already updated above.
    } finally {
      statusPollInProgress = false;
    }
  }

  async function setYamahaPower(on) {
    const result = await yamaha.setPower(on);

    bridgeStatus.yamaha.power = on ? 'on' : 'standby';
    bridgeStatus.yamaha.lastUpdate = new Date().toISOString();

    broadcastStatus();

    return result;
  }

  async function setYamahaVolume(percent) {
    const numericPercent = Number(percent);

    if (
      !Number.isFinite(numericPercent) ||
      numericPercent < 0 ||
      numericPercent > 100
    ) {
      throw new Error('Volume must be between 0 and 100');
    }

    const result = await yamaha.setVolume(numericPercent);

    const maxVolume = bridgeStatus.yamaha.maxVolume || 161;
    const volume = Math.round(
      (numericPercent * maxVolume) / 100
    );

    bridgeStatus.yamaha.volume = volume;
    bridgeStatus.yamaha.maxVolume = maxVolume;
    bridgeStatus.yamaha.lastUpdate = new Date().toISOString();

    broadcastStatus();

    return result;
  }

  async function setYamahaMute(mute) {
    const result = await yamaha.setMute(mute);

    bridgeStatus.yamaha.mute = mute ? 'on' : 'off';
    bridgeStatus.yamaha.lastUpdate = new Date().toISOString();

    broadcastStatus();

    return result;
  }

  async function setYamahaInput(inputId) {
    const result = await yamaha.setInput(inputId);

    bridgeStatus.yamaha.input = inputId;
    bridgeStatus.yamaha.lastUpdate = new Date().toISOString();

    broadcastStatus();

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
      const url = new URL(
        req.url,
        `http://${req.headers.host}`
      );

      if (
        url.pathname === '/api/power' &&
        req.method === 'POST'
      ) {
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

      if (
        url.pathname === '/api/mute' &&
        req.method === 'POST'
      ) {
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

      if (
        url.pathname === '/api/volume' &&
        req.method === 'POST'
      ) {
        const volume = Number(
          url.searchParams.get('value')
        );

        if (
          !Number.isFinite(volume) ||
          volume < 0 ||
          volume > 100
        ) {
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

      if (
        url.pathname === '/api/input' &&
        req.method === 'POST'
      ) {
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
      log.error(
        `[Dashboard] Command failed: ${err.message}`
      );

      sendJson(res, 500, {
        success: false,
        error: err.message,
      });

      return true;
    }
  }

  function buildHtml() {
    const yamahaStatus = bridgeStatus.yamaha;
    const sinric = bridgeStatus.sinricPro;

    const volumePercent =
      yamahaStatus.volume !== null &&
      yamahaStatus.maxVolume
        ? Math.round(
            (yamahaStatus.volume /
              yamahaStatus.maxVolume) *
              100
          )
        : 'Unknown';

    const lastUpdate = yamahaStatus.lastUpdate
      ? new Date(
          yamahaStatus.lastUpdate
        ).toLocaleString()
      : 'Never';

    const inputOptions = Object.entries(inputMap)
      .map(
        ([name, id]) =>
          `<option value="${id}" ${
            yamahaStatus.input === id
              ? 'selected'
              : ''
          }>${name}</option>`
      )
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport"
        content="width=device-width, initial-scale=1.0">
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
      <span id="yamahaConnection"
        class="${
          yamahaStatus.connected
            ? 'connected'
            : 'disconnected'
        }">
        ${
          yamahaStatus.connected
            ? 'Connected'
            : 'Disconnected'
        }
      </span>
    </div>

    <div class="row">
      <span class="label">Sinric Pro</span>
      <span id="sinricConnection"
        class="${
          sinric.connected
            ? 'connected'
            : 'disconnected'
        }">
        ${
          sinric.connected
            ? 'Connected'
            : 'Disconnected'
        }
      </span>
    </div>
  </div>

  <div class="card">
    <h2>Receiver Status</h2>

    <div class="row">
      <span class="label">Power</span>
      <span id="powerStatus">
        ${yamahaStatus.power}
      </span>
    </div>

    <div class="row">
      <span class="label">Volume</span>
      <span id="volumeStatus">
        ${yamahaStatus.volume ?? 'Unknown'}
        /
        ${yamahaStatus.maxVolume ?? 'Unknown'}
        (${volumePercent}%)
      </span>
    </div>

    <div class="row">
      <span class="label">Mute</span>
      <span id="muteStatus">
        ${yamahaStatus.mute}
      </span>
    </div>

    <div class="row">
      <span class="label">Input</span>
      <span id="inputStatus">
        ${yamahaStatus.input}
      </span>
    </div>

    <div class="row">
      <span class="label">Zone</span>
      <span>${yamahaZone}</span>
    </div>
  </div>

  <div class="card">
    <h2>Controls</h2>

    <div class="control-section">
      <h3>Power</h3>

      <button
        onclick="sendCommand('/api/power?state=on')">
        Power On
      </button>

      <button
        onclick="sendCommand('/api/power?state=off')">
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
          yamahaStatus.volume !== null &&
          yamahaStatus.maxVolume
            ? Math.round(
                (yamahaStatus.volume /
                  yamahaStatus.maxVolume) *
                  100
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
          ${
            String(yamahaStatus.mute).toLowerCase() === 'on'
              ? 'Unmute'
              : 'Mute'
          }
        </button>

      </div>
    </div>

    <div class="control-section">
      <h3>Input</h3>

      <select onchange="changeInput(this.value)">
        <option value="">Select Input</option>
        ${inputOptions}
      </select>
    </div>

    <div id="commandStatus"></div>
  </div>

  <div class="card">
    <h2>Bridge Information</h2>

    <div class="row">
      <span class="label">Yamaha IP</span>
      <span>${yamahaIp}</span>
    </div>

    <div class="row">
      <span class="label">Last Update</span>
      <span id="lastUpdate">${lastUpdate}</span>
    </div>
  </div>

  <div class="footer">
    Status updates automatically after commands
  </div>

</div>

<script>

let pendingVolumePercent = null;

async function sendCommand(url) {
  const status =
    document.getElementById('commandStatus');

  status.textContent = 'Sending command...';

  try {
    const response = await fetch(url, {
      method: 'POST'
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(
        result.error || 'Command failed'
      );
    }

    status.textContent = 'Command successful';

    if (url.startsWith('/api/power')) {
      const powerState =
        new URLSearchParams(
          url.split('?')[1]
        ).get('state');

      document.getElementById(
        'powerStatus'
      ).textContent =
        powerState === 'on'
          ? 'on'
          : 'standby';
    }

  } catch (err) {
    status.textContent =
      'Error: ' + err.message;
  }
}

async function changeInput(input) {
  if (!input) {
    return;
  }

  await sendCommand(
    '/api/input?input=' +
    encodeURIComponent(input)
  );

  document.getElementById(
    'inputStatus'
  ).textContent = input;
}

async function toggleMute() {
  const muteStatus =
    document.getElementById(
      'muteStatus'
    ).textContent.toLowerCase();

  const currentMute =
    muteStatus === 'true' || muteStatus === 'on';

  const newState =
    currentMute ? 'off' : 'on';

  // Update the UI immediately for a responsive feel.
  document.getElementById(
    'muteStatus'
  ).textContent =
    newState === 'on'
      ? 'true'
      : 'false';

  document.getElementById(
    'muteButton'
  ).textContent =
    newState === 'on'
      ? 'Unmute'
      : 'Mute';

  // Send the command; normal status polling will reconcile
  // the UI with the receiver's actual state.
  await sendCommand(
    '/api/mute?state=' + newState
  );
}

function updateDashboardFromStatus(status) {
  const yamaha = status.yamaha;

  document.getElementById(
    'powerStatus'
  ).textContent = yamaha.power;

  if (
    yamaha.volume !== null &&
    yamaha.maxVolume
  ) {
    const percent =
      (yamaha.volume /
        yamaha.maxVolume) * 100;

    document.getElementById(
      'volumeStatus'
    ).textContent =
      yamaha.volume + ' / ' +
      yamaha.maxVolume + ' (' +
      Math.round(percent) + '%)';

    document.getElementById(
      'volumeValue'
    ).textContent =
      Math.round(percent) + '%';

    document.getElementById(
      'volumeSlider'
    ).value =
      Math.round(percent);

  } else {
    document.getElementById(
      'volumeStatus'
    ).textContent = 'Unknown';

    document.getElementById(
      'volumeValue'
    ).textContent = 'Unknown';
  }

  document.getElementById(
    'muteStatus'
  ).textContent =
    Boolean(yamaha.mute)
      ? 'on'
      : 'off';

  document.getElementById(
    'muteButton'
  ).textContent =
    Boolean(yamaha.mute)
      ? 'Unmute'
      : 'Mute';

  document.getElementById(
    'inputStatus'
  ).textContent = yamaha.input;

  const yamahaConnection =
    document.getElementById(
      'yamahaConnection'
    );

  yamahaConnection.textContent =
    yamaha.connected
      ? 'Connected'
      : 'Disconnected';

  yamahaConnection.className =
    yamaha.connected
      ? 'connected'
      : 'disconnected';

  const sinricConnection =
    document.getElementById(
      'sinricConnection'
    );

  sinricConnection.textContent =
    status.sinricPro.connected
      ? 'Connected'
      : 'Disconnected';

  sinricConnection.className =
    status.sinricPro.connected
      ? 'connected'
      : 'disconnected';

  if (yamaha.lastUpdate) {
    document.getElementById(
      'lastUpdate'
    ).textContent =
      new Date(
        yamaha.lastUpdate
      ).toLocaleString();
  }
}

async function updateDashboard() {
  try {
    const response =
      await fetch('/api/status', {
        cache: 'no-store'
      });

    const status =
      await response.json();

    updateDashboardFromStatus(status);

  } catch (err) {
    console.error(
      '[Dashboard] Status update failed:',
      err
    );
  }
}

updateDashboard();

const events =
  new EventSource('/api/events');

events.onmessage = (event) => {
  const status =
    JSON.parse(event.data);

  updateDashboardFromStatus(status);
};

function updateVolumeDisplay(value) {
  document.getElementById(
    'volumeValue'
  ).textContent =
    Math.round(value) + '%';
}

async function setVolumeFromSlider(value) {
  const status =
    document.getElementById(
      'commandStatus'
    );

  status.textContent =
    'Setting volume...';

  try {
    const response = await fetch(
      '/api/volume?value=' +
      encodeURIComponent(value),
      {
        method: 'POST'
      }
    );

    const result =
      await response.json();

    if (!result.success) {
      throw new Error(
        result.error ||
        'Volume command failed'
      );
    }

    status.textContent =
      'Volume set to ' +
      Math.round(value) + '%';

    document.getElementById(
      'volumeValue'
    ).textContent =
      Math.round(value) + '%';

    document.getElementById(
      'volumeSlider'
    ).value =
      Math.round(value);

    pendingVolumePercent = null;

  } catch (err) {
    status.textContent =
      'Error: ' + err.message;
  }
}

async function adjustVolume(amount) {
  try {
    const slider =
      document.getElementById(
        'volumeSlider'
      );

    if (!slider) {
      throw new Error(
        'Volume slider unavailable'
      );
    }

    const currentPercent =
      pendingVolumePercent !== null
        ? pendingVolumePercent
        : Number(slider.value);

    if (!Number.isFinite(currentPercent)) {
      throw new Error(
        'Current volume unavailable'
      );
    }

    const newPercent =
      Math.max(
        0,
        Math.min(
          100,
          currentPercent + amount
        )
      );

    pendingVolumePercent =
      newPercent;

    document.getElementById(
      'volumeSlider'
    ).value =
      Math.round(newPercent);

    document.getElementById(
      'volumeValue'
    ).textContent =
      Math.round(newPercent) + '%';

    setVolumeFromSlider(
      newPercent
    ).catch(err => {
      console.error(
        '[Dashboard] Volume command failed:',
        err
      );
    });

  } catch (err) {
    document.getElementById(
      'commandStatus'
    ).textContent =
      'Error: ' + err.message;
  }
}

</script>

</body>
</html>`;
  }

  const server = http.createServer(
    async (req, res) => {
      if (
        req.url === '/api/status' &&
        req.method === 'GET'
      ) {
        return sendJson(
          res,
          200,
          getDashboardSnapshot()
        );
      }

      if (
        req.url === '/api/events' &&
        req.method === 'GET'
      ) {
        res.writeHead(200, {
          'Content-Type':
            'text/event-stream',
          'Cache-Control':
            'no-cache',
          'Connection':
            'keep-alive',
        });

        res.write(
          `data: ${JSON.stringify(
            getDashboardSnapshot()
          )}\n\n`
        );

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
        const handled =
          await handleStatusCommand(
            req,
            res
          );

        if (handled !== false) {
          return;
        }
      }

      if (
        req.url === '/' ||
        req.url === '/index.html'
      ) {
        res.writeHead(200, {
          'Content-Type':
            'text/html; charset=utf-8',
          'Cache-Control':
            'no-store',
        });

        res.end(buildHtml());
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    }
  );

  return {
    broadcastStatus,

    start() {
      return new Promise(
        (resolve, reject) => {
          server.once(
            'error',
            reject
          );

          server.listen(
            port,
            '0.0.0.0',
            () => {
              log.info(
                `Dashboard available at http://0.0.0.0:${port}`
              );

              statusInterval =
                setInterval(
                  pollYamahaStatus,
                  2000
                );

              pollYamahaStatus();

              resolve();
            }
          );
        }
      );
    },

    async stop() {
      if (statusInterval) {
        clearInterval(
          statusInterval
        );

        statusInterval = null;
      }

      for (const client of dashboardClients) {
        try {
          client.end();
        } catch (err) {
          // Ignore closed clients.
        }
      }

      dashboardClients.clear();

      return new Promise(
        (resolve) => {
          if (!server.listening) {
            resolve();
            return;
          }

          server.close(
            () => resolve()
          );
        }
      );
    },
  };
}

module.exports = createDashboard;
