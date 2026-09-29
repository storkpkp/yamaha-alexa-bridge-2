'use strict';

const YamahaController = require('../lib/yamaha');

class YamahaAccessory {
  constructor(platform, accessory) {
    this.log = platform.log;
    this.api = platform.api;
    this.Service = platform.Service;
    this.Characteristic = platform.Characteristic;

    this.accessory = accessory;
    this.name = accessory.context.device.name;

    this.yamaha = new YamahaController({
      ip: accessory.context.device.ip,
      zone: accessory.context.device.zone,
    });

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

    this.televisionService =
      this.accessory.getService(this.Service.Television) ||
      this.accessory.addService(
        this.Service.Television,
        this.name
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
      });

    this.log.info(`Yamaha receiver configured: ${this.name}`);
  }
}

module.exports = YamahaAccessory;
