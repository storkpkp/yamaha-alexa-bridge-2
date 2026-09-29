'use strict';

const YamahaAccessory = require('./accessory');

class YamahaAlexaBridgePlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config || {};
    this.api = api;

    this.cachedAccessories = [];
  }

  configureAccessory(accessory) {
    this.log.info(
      `Restoring cached accessory: ${accessory.displayName}`
    );

    this.cachedAccessories.push(accessory);
  }

  didFinishLaunching() {
    const uuid = this.api.hap.uuid.generate(
      `yamaha:${this.config.ip}:${this.config.zone || 'main'}`
    );

    let accessory = this.cachedAccessories.find(
      (cached) => cached.UUID === uuid
    );

    if (!accessory) {
      accessory = new this.api.platformAccessory(
        this.config.name || 'Yamaha Receiver',
        uuid
      );

      accessory.context.device = {
        ip: this.config.ip,
        zone: this.config.zone || 'main',
        name: this.config.name || 'Yamaha Receiver',
      };

      this.api.registerPlatformAccessories(
        'homebridge-yamaha-alexa-bridge',
        'YamahaAlexaBridge',
        [accessory]
      );
    }

    new YamahaAccessory(this, accessory);
  }
}

module.exports = YamahaAlexaBridgePlatform;
