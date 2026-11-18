'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { after, before, test } = require('node:test');
const YamahaController = require('../lib/yamaha');

let server;
let receiverAddress;
let responseCode = 200;
let responseBody = {
  power: 'on',
  volume: 80,
  max_volume: 160,
};
let responseDelay = 0;
let holdResponses = false;
let requests = [];

before(async () => {
  server = http.createServer((req, res) => {
    requests.push(req.url);

    if (holdResponses) {
      return;
    }

    setTimeout(() => {
      res.statusCode = responseCode;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(responseBody));
    }, responseDelay);
  });

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  receiverAddress = `127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test('coalesces simultaneous status requests', async () => {
  requests = [];
  responseCode = 200;
  responseDelay = 25;
  holdResponses = false;

  const controller = new YamahaController({ ip: receiverAddress });
  const [first, second] = await Promise.all([
    controller.getStatus(),
    controller.getStatus(),
  ]);

  assert.equal(first, second);
  assert.equal(
    requests.filter((path) => path.endsWith('/main/getStatus')).length,
    1
  );
});

test('converts a percentage using the receiver-reported maximum', async () => {
  requests = [];
  responseCode = 200;
  responseDelay = 0;
  responseBody = {
    power: 'on',
    volume: 80,
    max_volume: 200,
  };

  const controller = new YamahaController({ ip: receiverAddress });
  await controller.getStatus();
  await controller.setVolume(50);

  assert.ok(
    requests.includes('/YamahaExtendedControl/v1/main/setVolume?volume=100')
  );
});

test('rejects a volume outside the supported percentage range', async () => {
  const controller = new YamahaController({ ip: receiverAddress });

  await assert.rejects(
    controller.setVolume(101),
    /between 0 and 100/
  );
});

test('rejects unsuccessful HTTP responses', async () => {
  responseCode = 503;
  responseDelay = 0;
  holdResponses = false;

  const controller = new YamahaController({ ip: receiverAddress });

  await assert.rejects(
    controller.getStatus(),
    /HTTP 503/
  );

  responseCode = 200;
});

test('times out a receiver request that does not respond', async () => {
  holdResponses = true;

  const controller = new YamahaController({
    ip: receiverAddress,
    requestTimeoutMs: 30,
  });

  await assert.rejects(
    controller.getStatus(),
    /timed out after 30ms/
  );

  holdResponses = false;
});
