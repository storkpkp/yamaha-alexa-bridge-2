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

    this.televisionSpeakerService =
      this.accessory.getService(this.Service.TelevisionSpeaker) ||
      this.accessory.addService(
        this.Service.TelevisionSpeaker,
        `${this.name} Volume`
      );

    this.televisionService.addLinkedService(
      this.televisionSpeakerService
    );

    this.televisionSpeakerService.addOptionalCharacteristic(
      this.Characteristic.Volume
    );

    this.televisionSpeakerService.addOptionalCharacteristic(
      this.Characteristic.VolumeSelector
    );

    this.televisionSpeakerService.addOptionalCharacteristic(
      this.Characteristic.VolumeControlType
    );

    this.volumeCharacteristic =
      this.televisionSpeakerService.getCharacteristic(
        this.Characteristic.Volume
      );

    this.volumeCharacteristic.onGet(async () => {
      const status = await this.yamaha.getStatus();

      const volume = Number(status.volume);
      const maxVolume = Number(
        status.max_volume || this.yamaha.maxVolume
      );

      if (!Number.isFinite(volume) || !Number.isFinite(maxVolume) || maxVolume <= 0) {
        throw new Error('Invalid Yamaha volume status');
      }

      return Math.round((volume / maxVolume) * 100);
    });

    this.volumeCharacteristic.onSet(async (value) => {
      const volume = Number(value);

      if (!Number.isFinite(volume)) {
        throw new Error(`Invalid HomeKit volume: ${value}`);
      }

      this.log.info(
        `Volume: ${Math.round(volume)}%`
      );

      await this.yamaha.setVolume(volume);
    });

    this.volumeSelectorCharacteristic =
      this.televisionSpeakerService.getCharacteristic(
        this.Characteristic.VolumeSelector
      );

    this.volumeSelectorCharacteristic.onSet(async (value) => {
      const direction =
        Number(value) === 0 ? 5 : -5;

      this.log.info(
        `Volume: ${direction > 0 ? '+' : ''}${direction}`
      );

      await this.yamaha.adjustVolume(direction);

      await this.syncVolumeState();
    });

    this.volumeControlTypeCharacteristic =
      this.televisionSpeakerService.getCharacteristic(
        this.Characteristic.VolumeControlType
      );

    this.volumeControlTypeCharacteristic.updateValue(
      this.Characteristic.VolumeControlType.ABSOLUTE
    );

    this.syncPowerState();
    this.syncVolumeState();

    this.pollTimer = setInterval(
      () => {
        this.syncPowerState();
        this.syncVolumeState();
      },
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

  async syncVolumeState() {
    try {
      const status = await this.yamaha.getStatus();

      const volume = Number(status.volume);
      const maxVolume = Number(
        status.max_volume || this.yamaha.maxVolume
      );

      if (!Number.isFinite(volume) || !Number.isFinite(maxVolume) || maxVolume <= 0) {
        throw new Error('Invalid Yamaha volume status');
      }

      const actualVolume = Math.round(
        (volume / maxVolume) * 100
      );

      if (this.volumeCharacteristic.value !== actualVolume) {
        this.volumeCharacteristic.updateValue(actualVolume);
      }
    } catch (error) {
      this.log.warn(
        `Volume state sync failed: ${error.message}`
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
