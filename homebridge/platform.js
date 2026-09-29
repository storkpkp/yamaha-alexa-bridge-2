'use strict';

const YamahaAccessory = require('./accessory');

class YamahaAlexaBridgePlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config || {};
    this.api = api;

    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.api.on('didFinishLaunching', () => {
      this.addAccessory();
    });
  }

  addAccessory() {
    const uuid = this.api.hap.uuid.generate(
      `yamaha:${this.config.ip}:${this.config.zone || 'main'}`
    );

    const accessory = new this.api.platformAccessory(
      this.config.name || 'Yamaha Receiver',
      uuid
    );

    accessory.context.device = {
      ip: this.config.ip,
      zone: this.config.zone || 'main',
      name: this.config.name || 'Yamaha Receiver',
    };

    new YamahaAccessory(this, accessory);

    this.api.registerPlatformAccessories(
      'homebridge-yamaha-alexa-bridge',
      'YamahaAlexaBridge',
      [accessory]
    );
  }
}

module.exports = YamahaAlexaBridgePlatform;
