'use strict';

const {
  SinricPro: SinricProClass,
  SinricProTV,
} = require('sinricpro');

const SinricPro = SinricProClass.getInstance();

function createSinricPro({
  deviceId,
  appKey,
  appSecret,
  inputMap,
  bridgeStatus,
  broadcastStatus,
  logAlexa,
  logSinric,
  logError,
  setYamahaPower,
  setYamahaVolume,
  getYamahaStatus,
  yamahaGet,
  setYamahaMute,
  setYamahaPlayback,
  setYamahaInput,
  yamahaZone,
}) {
  const receiver = SinricProTV(deviceId);

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
        `/${yamahaZone}/setVolume?volume=${newVolume}`
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

  // Media controls
  receiver.onMediaControl(async (deviceId, control) => {
    logAlexa(`Media: ${control}`);

    try {
      const controlMap = {
        Play: 'play',
        Pause: 'pause',
        Stop: 'stop',
        Next: 'next',
        Previous: 'previous',
        FastForward: 'fast_forward',
        Rewind: 'fast_reverse',
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
      let yamahaInput = inputMap[input];

      if (!yamahaInput) {
        const key = Object.keys(inputMap).find(
          (k) => k.toLowerCase() === input.toLowerCase()
        );

        yamahaInput = key
          ? inputMap[key]
          : input.toLowerCase().replace(/\s+/g, '_');
      }

      await setYamahaInput(yamahaInput);
      return true;

    } catch (err) {
      logError(`[Alexa] Input switch failed: ${err.message}`);
      return false;
    }
  });

  // Add device
  SinricPro.add(receiver);

  // Connection events
  SinricPro.onConnected(() => {
    bridgeStatus.sinricPro.connected = true;

    broadcastStatus();

    logSinric('Connected. Waiting for Alexa commands...');
  });

  SinricPro.onDisconnected(() => {
    bridgeStatus.sinricPro.connected = false;

    broadcastStatus();

    logError(
      '[SinricPro] Disconnected. Will reconnect automatically...'
    );
  });

  return {
    async start() {
      await SinricPro.begin({
        appKey,
        appSecret,
      });
    },

    stop() {
      // SinricPro handles its own reconnect lifecycle.
      // No explicit shutdown is required here yet.
    },
  };
}

module.exports = createSinricPro;
