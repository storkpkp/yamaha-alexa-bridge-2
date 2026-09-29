'use strict';

module.exports = (api) => {
  api.registerPlatform(
    'homebridge-yamaha-alexa-bridge',
    'YamahaAlexaBridge',
    require('./platform')
  );
};
