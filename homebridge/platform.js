'use strict';

const YamahaAccessory = require('./accessory');
const YamahaController = require('../lib/yamaha');
const createSinricPro = require('../lib/sinricpro');

class YamahaAlexaBridgePlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config || {};
    this.api = api;
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.cachedAccessories = [];
    this.yamaha = null;
    this.sinricPro = null;

    this.api.on('didFinishLaunching', () => {
      this.didFinishLaunching();
    });
  }

  configureAccessory(accessory) {
    this.log.info(
      `Restoring cached accessory: ${accessory.displayName}`
    );

    this.cachedAccessories.push(accessory);
  }

  didFinishLaunching() {
    const zone = this.config.zone || 'main';

    // Shared Yamaha controller used by HomeKit and SinricPro.
    this.yamaha = new YamahaController({
      ip: this.config.ip,
      zone,
    });

    const uuid = this.api.hap.uuid.generate(
      `yamaha:${this.config.ip}:${zone}`
    );

    let accessory = this.cachedAccessories.find(
      (cached) => cached.UUID === uuid
    );

    const isNewAccessory = !accessory;

    if (!accessory) {
      accessory = new this.api.platformAccessory(
        this.config.name || 'Yamaha Receiver',
        uuid
      );

      accessory.context.device = {
        ip: this.config.ip,
        zone,
        name: this.config.name || 'Yamaha Receiver',
      };
    }

    new YamahaAccessory(this, accessory);

    if (isNewAccessory) {
      this.api.registerPlatformAccessories(
        'homebridge-yamaha-alexa-bridge',
        'YamahaAlexaBridge',
        [accessory]
      );
    }

    if (this.config.sinricpro) {
      this.log.info('Initializing SinricPro...');

      const bridgeStatus = {
        sinricPro: {
          connected: false,
        },
      };

      this.sinricPro = createSinricPro({
        deviceId: this.config.sinricpro.deviceId,
        appKey: this.config.sinricpro.appKey,
        appSecret: this.config.sinricpro.appSecret,

        inputMap: this.config.inputMap || {},

        bridgeStatus,

        broadcastStatus: () => {},

        logAlexa: (message) => {
          this.log.info(message);
        },

        logSinric: (message) => {
          this.log.info(message);
        },

        logError: (message) => {
          this.log.error(message);
        },

        setYamahaPower: async (state) => {
          return this.yamaha.setPower(state);
        },

        setYamahaVolume: async (volume) => {
          return this.yamaha.setVolume(volume);
        },

        getYamahaStatus: async () => {
          return this.yamaha.getStatus();
        },

        yamahaGet: async (apiPath) => {
          return this.yamaha.request(apiPath);
        },

        setYamahaMute: async (mute) => {
          return this.yamaha.setMute(mute);
        },

        setYamahaPlayback: async (action) => {
          return this.yamaha.setPlayback(action);
        },

        setYamahaInput: async (input) => {
          return this.yamaha.setInput(input);
        },

        yamahaZone: zone,
      });

      this.sinricPro.start().catch((error) => {
        this.log.error(
          `SinricPro startup failed: ${error.message}`
        );
      });
    }
  }
}

module.exports = YamahaAlexaBridgePlatform;
