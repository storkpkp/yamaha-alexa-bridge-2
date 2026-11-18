# Yamaha Alexa Bridge

[![npm version](https://img.shields.io/npm/v/homebridge-yamaha-alexa-bridge.svg)](https://www.npmjs.com/package/homebridge-yamaha-alexa-bridge)
[![Homebridge](https://img.shields.io/badge/Homebridge-2.x-blue)](https://homebridge.io/)

Yamaha Alexa Bridge is a Homebridge platform plugin for controlling a compatible Yamaha network receiver from Apple Home and Siri, Amazon Alexa, or a web browser. It communicates with the receiver over Yamaha's local Yamaha Extended Control (YXC) API. Alexa control uses Sinric Pro.

![Yamaha Alexa Bridge architecture](docs/architecture.png)

Homebridge hosts the plugin. HomeKit uses the Homebridge accessory, Alexa connects through Sinric Pro, and the dashboard provides browser controls. These paths communicate with the configured receiver and zone.

## Features

- HomeKit and Siri power and volume control, with receiver power and volume status synchronization.
- Alexa power, absolute and relative volume, mute, media controls, and input selection through Sinric Pro.
- Built-in dashboard for receiver and Sinric Pro status, power, volume, mute, and input controls.
- Configurable Yamaha zone and input-name mapping.
- Volume conversion between a 0–100 percentage and the receiver's native volume scale.

## Requirements

- Homebridge 2.x and Node.js 22 or later.
- A Yamaha receiver that supports the YXC API and the configured controls for its model and zone.
- A Sinric Pro account, app credentials, and a TV device for Alexa integration.

The plugin is configured as one Homebridge platform. The configured Yamaha zone is used for the HomeKit accessory, Alexa commands, and dashboard. Yamaha models differ in supported zones, inputs, and playback capabilities; use the receiver's documentation to confirm support.

## Install

In Homebridge UI, open **Plugins**, search for **Yamaha Alexa Bridge**, and install `homebridge-yamaha-alexa-bridge`. Add the platform configuration below, save, and restart Homebridge. Alternatively, install on the Homebridge host with:

```sh
npm install -g homebridge-yamaha-alexa-bridge
```

## Configure

Create a Sinric Pro TV device and use its App Key, App Secret, and Device ID below. The `inputMap` keys are the input names exposed to Alexa; values are Yamaha input identifiers. Adjust them for the inputs supported by your receiver.

```json
{
  "platform": "YamahaAlexaBridge",
  "name": "Yamaha Receiver",
  "ip": "192.168.1.100",
  "zone": "main",
  "inputMap": {
    "HDMI 1": "hdmi1",
    "HDMI 2": "hdmi2",
    "Bluetooth": "bluetooth",
    "Spotify": "spotify"
  },
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

Keep Sinric Pro credentials private. Do not commit a live Homebridge configuration or credentials to source control.

### Keep the receiver address stable

The plugin connects to the receiver by its local IP address. Create a DHCP reservation for the receiver in your router and use that reserved address in the Homebridge configuration. If the receiver's address changes, update the configuration and restart Homebridge.

## HomeKit and Siri

Homebridge publishes a television accessory for the configured receiver and zone. HomeKit exposes power and speaker volume, including relative volume adjustment; the plugin polls the receiver to keep those states synchronized. Add the accessory through Homebridge's normal bridge pairing flow, then use the Home app or Siri to control it.

## Alexa and Sinric Pro

The plugin connects to Sinric Pro using the configured credentials and registers a Sinric Pro TV device. Link the Sinric Pro Alexa skill to your account and discover the device in Alexa. Supported callbacks include power, setting or adjusting volume, mute, media play/pause/stop/next/previous/fast forward/rewind, and input selection. Actual behavior depends on the Yamaha receiver, selected zone, source, and Alexa/Sinric Pro support.

## Web dashboard

The dashboard is enabled by default on port **8080**. Open `http://<homebridge-host>:8080` from a device that can reach the Homebridge host. Change `dashboard.port` to use another port, or set `dashboard.enabled` to `false` to disable it.

![Yamaha Alexa Bridge web dashboard](docs/dashboard.png)

The dashboard has no separate authentication. Keep it on a trusted local network and do not expose its port to the public internet.

## Yamaha compatibility

The receiver must expose the Yamaha Extended Control API on the local network. You can check basic connectivity by opening this URL from a device on the same network, replacing the address with your receiver's IP:

```text
http://<receiver-ip>/YamahaExtendedControl/v1/main/getStatus
```

A JSON status response indicates that the endpoint is reachable. Zone names, input identifiers, and available commands vary by model. For another zone, use a supported zone value in `zone`; configure `inputMap` to match the receiver's input identifiers.

## Troubleshooting

### The receiver is unreachable

- Confirm the receiver and Homebridge host are on the same local network.
- Check the receiver IP and zone in the Homebridge platform configuration.
- Open the YXC status URL above from the Homebridge host's network.
- Reserve the receiver's address in the router so it does not change.

### HomeKit shows stale status or cannot control the receiver

- Confirm the receiver is reachable and supports the selected zone.
- Check the Homebridge log for Yamaha request errors, then restart Homebridge after correcting the configuration.

### Alexa cannot control the receiver

- Check the Sinric Pro App Key, App Secret, and Device ID.
- Confirm the device is online in Sinric Pro and the Sinric Pro Alexa skill is linked; then rediscover devices in Alexa.
- Check the Homebridge log for Sinric Pro connection errors.

### The dashboard does not open

- Confirm the dashboard is enabled and use `http://<homebridge-host>:<configured-port>`.
- Check that the port is not already in use and that the viewing device can reach the Homebridge host.

## Development

```sh
git clone https://github.com/storkpkp/yamaha-alexa-bridge-2.git
cd yamaha-alexa-bridge-2
npm install
```

The Homebridge entry point is `homebridge/index.js`. Platform and accessory code are in `homebridge/`; the Yamaha controller, Sinric Pro integration, and dashboard are in `lib/`.

## License

MIT
