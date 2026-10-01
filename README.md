# Yamaha Alexa Bridge

[![npm version](https://img.shields.io/npm/v/homebridge-yamaha-alexa-bridge.svg)](https://www.npmjs.com/package/homebridge-yamaha-alexa-bridge)
[![Homebridge](https://img.shields.io/badge/Homebridge-plugin-blue)](https://homebridge.io/)

Control compatible Yamaha network receivers with **Apple Home, Siri, Amazon Alexa, and the Yamaha Extended Control (YXC) API**. Yamaha Alexa Bridge runs inside Homebridge and shares one receiver controller across HomeKit, Sinric Pro, and the web dashboard.

## Architecture

![Yamaha Alexa Bridge architecture](https://raw.githubusercontent.com/storkpkp/yamaha-alexa-bridge-2/aad42d8232d401fa8319cdded9cb0bac2588b42a/docs/architecture.png)

Homebridge hosts the plugin. HomeKit communicates through Homebridge, Alexa connects through Sinric Pro, and the built-in dashboard provides browser controls. Each control path uses the shared Yamaha controller to communicate with the receiver over the YXC API.

## Features

- HomeKit and Siri power, volume, and receiver status controls
- Amazon Alexa control through Sinric Pro
- Built-in web dashboard for receiver status and controls
- Yamaha receiver power, volume, mute, input, and playback controls where supported
- Main, Zone 2, Zone 3, and Zone 4 support where available
- Live status synchronization across HomeKit, Alexa, and the dashboard
- Automatic conversion between percentage volume and the receiver's native scale
- Homebridge UI configuration

## Dashboard

The dashboard is enabled by default and listens on port **8080**. Open `http://<homebridge-host>:8080` from a device on your network. Set `dashboard.enabled` to `false` to disable it, or choose another port in the Homebridge configuration.

![Yamaha Alexa Bridge web dashboard](https://raw.githubusercontent.com/storkpkp/yamaha-alexa-bridge-2/aad42d8232d401fa8319cdded9cb0bac2588b42a/docs/dashboard.png)

## Requirements

- Homebridge 2.x
- Node.js 22 or later
- A Yamaha receiver that supports the Yamaha Extended Control API
- A Sinric Pro account and device for Alexa control

## Installation

In Homebridge UI:

1. Open **Plugins** and search for **Yamaha Alexa Bridge**.
2. Install `homebridge-yamaha-alexa-bridge`.
3. Add the Yamaha Alexa Bridge platform and enter the receiver and Sinric Pro details.
4. Save the configuration and restart Homebridge.

You can also install it from the Homebridge host with:

```sh
npm install -g homebridge-yamaha-alexa-bridge
```

## Configuration

The Homebridge UI provides fields for the platform configuration. A JSON configuration looks like this:

```json
{
  "platform": "YamahaAlexaBridge",
  "name": "Yamaha Receiver",
  "ip": "192.168.1.100",
  "zone": "main",
  "sinricpro": {
    "appKey": "YOUR_APP_KEY",
    "appSecret": "YOUR_APP_SECRET",
    "deviceId": "YOUR_DEVICE_ID"
  },
  "dashboard": {
    "enabled": true,
    "port": 8080
  }
}
```

Keep the Sinric Pro credentials private. Do not commit a live Homebridge configuration or credentials to source control.

## Receiver compatibility

The receiver must support the Yamaha Extended Control (YXC) API. To check connectivity, open this URL with your receiver's IP address:

```text
http://<receiver-ip>/YamahaExtendedControl/v1/main/getStatus
```

A JSON response containing receiver status indicates that the API is reachable. Supported inputs and zones vary by receiver model.

## Troubleshooting

### The receiver is unreachable

- Confirm the receiver and Homebridge host are on the same network.
- Check the receiver IP address and selected zone.
- Open the YXC status URL above from the Homebridge host's network.

### Alexa cannot control the receiver

- Confirm the Sinric Pro App Key, App Secret, and Device ID are correct.
- Check that the Sinric Pro device is online and linked to the Alexa skill.
- Review the Homebridge log for connection errors.

### The dashboard does not open

- Confirm the dashboard is enabled in the platform configuration.
- Open `http://<homebridge-host>:<port>` and check that the port is not already in use.
- Make sure the device viewing the dashboard can reach the Homebridge host on your network.

## Development

```sh
git clone https://github.com/storkpkp/yamaha-alexa-bridge-2.git
cd yamaha-alexa-bridge-2
npm install
```

The Homebridge plugin entry point is `homebridge/index.js`. The platform and accessory implementation are in `homebridge/`, and the shared Yamaha and Sinric Pro integrations are in `lib/`.

## License

MIT
