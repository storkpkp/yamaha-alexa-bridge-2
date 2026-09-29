'use strict';

const YamahaController = require('../lib/yamaha');

class YamahaAccessory {
  constructor(log, config, api) {
    this.log = log;
    this.config = config || {};
    this.api = api;

    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.name = this.config.name || 'Yamaha Receiver';

    this.yamaha = new YamahaController({
      ip: this.config.ip,
      zone: this.config.zone || 'main',
    });

    this.informationService = new this.Service.AccessoryInformation()
      .setCharacteristic(
        this.Characteristic.Manufacturer,
        'Yamaha'
      )
      .setCharacteristic(
        this.Characteristic.Model,
        'MusicCast Receiver'
      );

    this.televisionService = new this.Service.Television(
      this.name,
      'YamahaTelevision'
    );

    this.televisionService.setCharacteristic(
      this.Characteristic.ConfiguredName,
      this.name
    );

    this.televisionService
      .getCharacteristic(this.Characteristic.Active)
      .onGet(async () => {
        const status = await this.yamaha.getStatus();

        return status.power === 'on'
          ? this.Characteristic.Active.ACTIVE
          : this.Characteristic.Active.INACTIVE;
      });

    this.televisionService
      .getCharacteristic(this.Characteristic.Active)
      .onSet(async (value) => {
        const isOn =
          value === this.Characteristic.Active.ACTIVE;

        this.log.info(
          `Power: ${isOn ? 'ON' : 'OFF'}`
        );

        await this.yamaha.setPower(isOn);

        const status = await this.yamaha.getStatus();

        const actualState =
          status.power === 'on'
            ? this.Characteristic.Active.ACTIVE
            : this.Characteristic.Active.INACTIVE;

        this.televisionService
          .getCharacteristic(this.Characteristic.Active)
          .updateValue(actualState);
      });

    this.log.info(`Yamaha receiver configured: ${this.name}`);
  }

  getServices() {
    return [
      this.informationService,
      this.televisionService,
    ];
  }
}

module.exports = YamahaAccessory;
