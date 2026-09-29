'use strict';

const YamahaController = require('../lib/yamaha');

class YamahaAccessory {
  constructor(log, config, api) {
    this.log = log;
    this.config = config || {};
    this.api = api;

    this.name = this.config.name || 'Yamaha Receiver';

    this.yamaha = new YamahaController({
      ip: this.config.ip,
      zone: this.config.zone || 'main',
    });

    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.accessory = new api.platformAccessory(
      this.name,
      api.hap.uuid.generate(`yamaha:${this.name}`)
    );

    this.informationService = this.accessory.getService(
      this.Service.AccessoryInformation
    );

    this.informationService
      .setCharacteristic(
        this.Characteristic.Manufacturer,
        'Yamaha'
      )
      .setCharacteristic(
        this.Characteristic.Model,
        'MusicCast Receiver'
      );

    this.log.info(`Yamaha receiver configured: ${this.name}`);
  }
}

module.exports = YamahaAccessory;
