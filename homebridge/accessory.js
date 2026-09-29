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

    this.activeCharacteristic =
      this.televisionService.getCharacteristic(
        this.Characteristic.Active
      );

    this.activeCharacteristic.onGet(async () => {
      const status = await this.yamaha.getStatus();

      return status.power === 'on'
        ? this.Characteristic.Active.ACTIVE
        : this.Characteristic.Active.INACTIVE;
    });

    this.activeCharacteristic.onSet(async (value) => {
      const isOn =
        value === this.Characteristic.Active.ACTIVE;

      this.log.info(
        `Power: ${isOn ? 'ON' : 'OFF'}`
      );

      await this.yamaha.setPower(isOn);

      await this.syncPowerState();
    });

    this.syncPowerState();

    this.pollTimer = setInterval(
      () => this.syncPowerState(),
      5000
    );

    this.log.info(
      `Yamaha receiver configured: ${this.name}`
    );
  }

  async syncPowerState() {
    try {
      const status = await this.yamaha.getStatus();

      const actualState =
        status.power === 'on'
          ? this.Characteristic.Active.ACTIVE
          : this.Characteristic.Active.INACTIVE;

      const currentState =
        this.activeCharacteristic.value;

      if (currentState !== actualState) {
        this.log.info(
          `Power state sync: ${
            actualState === this.Characteristic.Active.ACTIVE
              ? 'ON'
              : 'OFF'
          }`
        );

        this.activeCharacteristic.updateValue(actualState);
      }
    } catch (error) {
      this.log.warn(
        `Power state sync failed: ${error.message}`
      );
    }
  }

  shutdown() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

module.exports = YamahaAccessory;
