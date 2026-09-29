'use strict';

const YamahaAccessory = require('./accessory');

class YamahaAlexaBridgePlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config || {};
    this.api = api;
  }

  accessories(callback) {
    const accessory = new YamahaAccessory(
      this.log,
      this.config,
      this.api
    );

    callback([accessory]);
  }
}

module.exports = YamahaAlexaBridgePlatform;
