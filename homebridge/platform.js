'use strict';

const YamahaAccessory = require('./accessory');

class YamahaAlexaBridgePlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config || {};
    this.api = api;

    if (!api) {
      return;
    }

    this.api.on('didFinishLaunching', () => {
      this.addAccessory();
    });
  }

  addAccessory() {
    const accessory = new YamahaAccessory(
      this.log,
      this.config,
      this.api
    );

    this.api.publishExternalAccessories(
      'YamahaAlexaBridge',
      [accessory]
    );
  }
}

module.exports = YamahaAlexaBridgePlatform;
