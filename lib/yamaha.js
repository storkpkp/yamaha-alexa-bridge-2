const http = require('http');

class YamahaController {
  constructor({ ip, zone = 'main', requestTimeoutMs = 5000 }) {
    if (!ip) {
      throw new Error('Yamaha receiver IP address is required.');
    }

    this.ip = ip;
    this.zone = zone;
    this.maxVolume = 161;
    this.requestTimeoutMs = requestTimeoutMs;
    this.statusRequest = null;
  }

  request(apiPath) {
    const url =
      `http://${this.ip}/YamahaExtendedControl/v1${apiPath}`;

    return new Promise((resolve, reject) => {
      const request = http.get(url, (res) => {
        let data = '';

        res.setEncoding('utf8');

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(
              new Error(
                `Yamaha API returned HTTP ${res.statusCode} for ${apiPath}`
              )
            );
            return;
          }

          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (err) {
            reject(
              new Error(`Bad response from Yamaha receiver: ${data}`)
            );
          }
        });
      });

      request.setTimeout(this.requestTimeoutMs, () => {
        request.destroy(
          new Error(
            `Yamaha API request timed out after ${this.requestTimeoutMs}ms (${apiPath})`
          )
        );
      });

      request.on('error', reject);
    });
  }

  getStatus() {
    if (this.statusRequest) {
      return this.statusRequest;
    }

    const statusRequest = this.request(
      `/${this.zone}/getStatus`
    ).then((status) => {
      if (Number.isFinite(Number(status.max_volume))) {
        this.maxVolume = Number(status.max_volume);
      }

      return status;
    }).finally(() => {
      if (this.statusRequest === statusRequest) {
        this.statusRequest = null;
      }
    });

    this.statusRequest = statusRequest;
    return statusRequest;
  }

  async setPower(on) {
    const state = on ? 'on' : 'standby';

    return this.request(
      `/${this.zone}/setPower?power=${state}`
    );
  }

  async setVolume(percent) {
    const numericPercent = Number(percent);

    if (
      !Number.isFinite(numericPercent) ||
      numericPercent < 0 ||
      numericPercent > 100
    ) {
      throw new Error('Volume percentage must be between 0 and 100');
    }

    const volume = Math.round(
      (numericPercent * this.maxVolume) / 100
    );

    return this.request(
      `/${this.zone}/setVolume?volume=${volume}`
    );
  }

  async setRawVolume(volume) {
    const numericVolume = Number(volume);

    if (!Number.isFinite(numericVolume)) {
      throw new Error(`Invalid Yamaha volume: ${volume}`);
    }

    return this.request(
      `/${this.zone}/setVolume?volume=${numericVolume}`
    );
  }

  async setMute(mute) {
    return this.request(
      `/${this.zone}/setMute?enable=${Boolean(mute)}`
    );
  }

  async adjustVolume(delta) {
    const adjustment = Number(delta);

    if (!Number.isFinite(adjustment)) {
      throw new Error(`Invalid volume adjustment: ${delta}`);
    }

    const status = await this.getStatus();

    const currentVolume = Number(status.volume);
    const maxVolume = Number(status.max_volume || this.maxVolume);

    if (!Number.isFinite(currentVolume)) {
      throw new Error(`Invalid Yamaha volume: ${status.volume}`);
    }

    const newVolume = Math.max(
      0,
      Math.min(maxVolume, currentVolume + adjustment)
    );

    return this.setRawVolume(newVolume);
  }
  
  async setInput(inputId) {
    return this.request(
      `/${this.zone}/setInput?input=${inputId}`
    );
  }

  async setPlayback(action) {
    return this.request(
      `/netusb/setPlayback?playback=${action}`
    );
  }
}

module.exports = YamahaController;
