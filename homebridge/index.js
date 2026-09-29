'use strict';

module.exports = (api) => {
  api.registerPlatform('YamahaAlexaBridge', require('./platform'));
};
