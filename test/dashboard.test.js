'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const createDashboard = require('../lib/dashboard');

const authHeader = (username, password) =>
  `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

test('protects the dashboard page and control routes with Basic Auth', async () => {
  let powerChanges = 0;
  const status = {
    power: 'on',
    volume: 80,
    max_volume: 160,
    input: 'hdmi1',
    mute: 'off',
  };
  const dashboard = createDashboard({
    yamaha: {
      async getStatus() {
        return status;
      },
      async setPower() {
        powerChanges += 1;
        return { response_code: 0 };
      },
      async setMute() {
        return { response_code: 0 };
      },
      async setVolume() {
        return { response_code: 0 };
      },
      async setInput() {
        return { response_code: 0 };
      },
    },
    bridgeStatus: {
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
      sinricPro: { connected: false },
    },
    log: {
      info() {},
      warn() {},
      error() {},
    },
    port: 0,
    auth: {
      username: 'receiver-admin',
      password: 'local-secret',
    },
    inputMap: { 'HDMI 1': 'hdmi1' },
    yamahaIp: '192.168.1.100',
    yamahaZone: 'main',
  });

  await dashboard.start();

  try {
    const address = dashboard.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const blockedPage = await fetch(`${baseUrl}/`);
    assert.equal(blockedPage.status, 401);
    assert.match(
      blockedPage.headers.get('www-authenticate'),
      /^Basic realm=/
    );

    const blockedCommand = await fetch(
      `${baseUrl}/api/power?state=off`,
      { method: 'POST' }
    );
    assert.equal(blockedCommand.status, 401);
    assert.equal(powerChanges, 0);

    const allowedStatus = await fetch(`${baseUrl}/api/status`, {
      headers: {
        Authorization: authHeader('receiver-admin', 'local-secret'),
      },
    });
    assert.equal(allowedStatus.status, 200);
    assert.equal((await allowedStatus.json()).yamaha.power, 'on');

    const allowedCommand = await fetch(
      `${baseUrl}/api/power?state=off`,
      {
        method: 'POST',
        headers: {
          Authorization: authHeader('receiver-admin', 'local-secret'),
        },
      }
    );
    assert.equal(allowedCommand.status, 200);
    assert.equal(powerChanges, 1);
  } finally {
    await dashboard.stop();
  }
});

test('requires both dashboard authentication fields', async () => {
  const dashboard = createDashboard({
    auth: { username: 'receiver-admin' },
    port: 0,
  });

  await assert.rejects(
    dashboard.start(),
    /requires both a username and password/
  );
});
