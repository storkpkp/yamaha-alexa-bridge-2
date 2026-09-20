# Yamaha Alexa Bridge

Control compatible Yamaha network receivers with Amazon Alexa voice commands using [Sinric Pro](https://sinric.pro/).

This project provides a bridge between Alexa, Sinric Pro, and the Yamaha Extended Control (YXC) API. It was created as an alternative for controlling Yamaha receivers after Yamaha's native Alexa integration was deprecated.

## Features

* Power on/off
* Absolute volume control
* Relative volume adjustments
* Mute/unmute
* Play, pause, stop, next, and previous
* Input/source selection
* Support for Yamaha zones
* Automatic Yamaha volume-scale conversion
* Web-based receiver status dashboard
* Optional Windows service installation
* Runs on Windows, macOS, and Linux

### Alexa Volume Commands

Examples:

* "Alexa, set Receiver volume to 50"
* "Alexa, turn Receiver up"
* "Alexa, turn Receiver down"
* "Alexa, turn Receiver down 5"
* "Alexa, turn Receiver up 5"

## How It Works

```text
Alexa
   |
   v
Sinric Pro Cloud
   |
   | WebSocket
   v
Yamaha Alexa Bridge
   |
   | HTTP / Yamaha Extended Control API
   v
Yamaha Receiver
```

The bridge runs as a Node.js application on a computer on your local network.

Alexa sends commands through Sinric Pro. The bridge receives those commands and translates them into commands understood by the Yamaha receiver through the Yamaha Extended Control API.

The computer running the bridge must remain powered on and connected to the Internet for Alexa commands to work.

## Compatibility

The bridge is designed for Yamaha network receivers that support the Yamaha Extended Control (YXC) API.

Many MusicCast-enabled Yamaha receivers are compatible, including network-enabled models in the following families:

* RX-V series
* RX-A series
* Other Yamaha receivers supporting the Yamaha Extended Control API

### Check Compatibility

Find your receiver's IP address and open:

```text
http://YOUR_RECEIVER_IP/YamahaExtendedControl/v1/main/getStatus
```

If the receiver returns JSON containing fields such as `power`, `volume`, and `input`, it is likely compatible with this bridge.

## Requirements

* Node.js 18 or later
* Yamaha receiver supporting the Yamaha Extended Control API
* Computer running Windows, macOS, or Linux
* Receiver and computer connected to the same local network
* Sinric Pro account
* Amazon Alexa
* Sinric Pro Alexa skill

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/storkpkp/yamaha-alexa-bridge-2.git
cd yamaha-alexa-bridge-2
```

You can also download the repository as a ZIP file from GitHub.

### 2. Install Dependencies

```bash
npm install
```

The project uses `patch-package` to automatically apply the included Sinric Pro compatibility patch during installation.

### 3. Create Your Configuration

macOS/Linux:

```bash
cp config.example.json config.json
```

Windows Command Prompt:

```cmd
copy config.example.json config.json
```

Windows PowerShell:

```powershell
Copy-Item config.example.json config.json
```

### 4. Configure the Bridge

Open `config.json` and enter your own Yamaha and Sinric Pro information.

Example:

```json
{
  "yamaha": {
    "ip": "YOUR_RECEIVER_IP",
    "zone": "main"
  },
  "sinricpro": {
    "appKey": "YOUR_APP_KEY",
    "appSecret": "YOUR_APP_SECRET",
    "deviceId": "YOUR_DEVICE_ID"
  }
}
```

**Do not share or commit your `config.json`.**

It contains your Sinric Pro credentials and local network information. The repository's `.gitignore` is configured to exclude this file.

## Sinric Pro Setup

### Create a Device

1. Sign in to Sinric Pro.
2. Create a new device.
3. Select **TV** as the device type.
4. Give the device a name, such as:

   * Receiver
   * Stereo
   * Yamaha
5. Save the device.
6. Copy the device ID.

### Obtain Credentials

From the Sinric Pro credentials section, obtain:

* App Key
* App Secret

Put these values into your `config.json`.

## Alexa Setup

1. Open the Alexa app.
2. Go to **More → Skills & Games**.
3. Search for **Sinric Pro**.
4. Enable the Sinric Pro skill.
5. Sign in using your Sinric Pro account.
6. Discover your devices.

You can also say:

```text
Alexa, discover my devices
```

Alexa should discover the Sinric Pro TV device you created.

## Test the Bridge

Start the bridge:

```bash
npm start
```

A successful startup should look similar to:

```text
=== Yamaha Alexa Bridge ===

[Config] Receiver: YOUR_RECEIVER_IP (main)

[Yamaha] Connected. Power: on, Volume: 53/161, Input: hdmi1

[SinricPro] Connected. Waiting for Alexa commands...
```

The exact IP address, volume, and input will depend on your receiver.

## Web Status Dashboard

The bridge includes a built-in web dashboard for monitoring and controlling the Yamaha receiver.

After starting the bridge, open:

```text
http://localhost:3000
```

The dashboard provides:

* Yamaha connection status
* Sinric Pro connection status
* Receiver power status
* Current volume
* Volume slider
* Volume increase/decrease controls
* Mute control
* Current input
* Input selection
* Command status

The default dashboard port is `3000`. A different port can be configured using `statusPort` in `config.json`.

## Voice Commands

| Alexa Command                               | Function                   |
| ------------------------------------------- | -------------------------- |
| "Alexa, turn on Receiver"                   | Powers on the receiver     |
| "Alexa, turn off Receiver"                  | Places receiver in standby |
| "Alexa, set Receiver volume to 30"          | Sets volume to 30%         |
| "Alexa, turn Receiver up"                   | Increases volume           |
| "Alexa, turn Receiver down"                 | Decreases volume           |
| "Alexa, turn Receiver up 5"                 | Increases volume by 5      |
| "Alexa, turn Receiver down 5"               | Decreases volume by 5      |
| "Alexa, mute Receiver"                      | Mutes the receiver         |
| "Alexa, unmute Receiver"                    | Unmutes the receiver       |
| "Alexa, pause Receiver"                     | Pauses playback            |
| "Alexa, resume Receiver"                    | Resumes playback           |
| "Alexa, stop Receiver"                      | Stops playback             |
| "Alexa, next on Receiver"                   | Next track                 |
| "Alexa, previous on Receiver"               | Previous track             |
| "Alexa, switch Receiver input to HDMI 1"    | Selects HDMI 1             |
| "Alexa, switch Receiver input to Spotify"   | Selects Spotify            |
| "Alexa, switch Receiver input to Bluetooth" | Selects Bluetooth          |

The exact Alexa phrasing may vary depending on the device name and Alexa's interpretation of the command.

## Volume Handling

Yamaha receivers use their own internal volume scale rather than Alexa's 0–100 percentage scale.

The bridge reads the receiver's reported maximum volume and converts Alexa's percentage to the Yamaha scale.

For a receiver reporting a maximum volume of 161:

| Alexa Volume | Yamaha Volume |
| -----------: | ------------: |
|          20% |        32/161 |
|          30% |        48/161 |
|          50% |        81/161 |
|         100% |       161/161 |

The actual maximum is read from the receiver rather than hard-coded.

### Relative Volume

Relative commands use the receiver's current volume and apply the requested adjustment.

For example:

```text
Alexa, turn Receiver down 5
```

If the receiver is currently at 50/161, the bridge sends:

```text
45/161
```

The volume is automatically limited to the receiver's valid range.

## Sinric Pro 5.1.0 Volume Compatibility

This project includes a `patch-package` patch for Sinric Pro 5.1.0.

The patch is located at:

```text
patches/sinricpro+5.1.0.patch
```

The patch corrects volume request handling so Alexa volume commands are passed correctly to the bridge.

It supports both:

* Absolute volume commands (`setVolume`)
* Relative volume commands (`adjustVolume`)

The patch is automatically applied when dependencies are installed:

```bash
npm install
```

The project specifically uses Sinric Pro 5.1.0 because the included patch targets that version.

## Configuration

| Setting               | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| `yamaha.ip`           | IP address of the Yamaha receiver                             |
| `yamaha.zone`         | Yamaha zone to control (`main`, `zone2`, `zone3`, or `zone4`) |
| `yamaha.inputMap`     | Optional custom Alexa-to-Yamaha input mapping                 |
| `statusPort`          | Optional web dashboard port; defaults to `3000`               |
| `sinricpro.appKey`    | Sinric Pro App Key                                            |
| `sinricpro.appSecret` | Sinric Pro App Secret                                         |
| `sinricpro.deviceId`  | Sinric Pro device ID                                          |

### Input Mapping

The bridge includes default mappings for common Yamaha inputs.

You can override them in `config.json`.

Example:

```json
{
  "yamaha": {
    "ip": "YOUR_RECEIVER_IP",
    "zone": "main",
    "inputMap": {
      "Chromecast": "hdmi1",
      "PlayStation": "hdmi2",
      "Turntable": "audio1"
    }
  }
}
```

You could then say:

```text
Alexa, switch Receiver input to Chromecast
```

The bridge will send the corresponding Yamaha input command.

## Running as a Windows Service

The repository includes Windows service installation scripts.

### Requirements

The included service scripts use NSSM (Non-Sucking Service Manager).

1. Download NSSM.
2. Extract `nssm.exe`.
3. Place `nssm.exe` in the project directory or add it to your system PATH.
4. Right-click:

```text
install-service.bat
```

5. Select **Run as Administrator**.

The service will run the Yamaha Alexa Bridge automatically.

To remove the service, right-click:

```text
uninstall-service.bat
```

and select **Run as Administrator**.

Service output is written to:

```text
service.log
```

## Troubleshooting

### "Cannot reach receiver"

Check:

* The IP address in `config.json`
* The receiver is connected to the network
* The computer running the bridge is on the same network

Test the Yamaha API directly:

```text
http://YOUR_RECEIVER_IP/YamahaExtendedControl/v1/main/getStatus
```

### "config.json not found"

Create it from the example:

macOS/Linux:

```bash
cp config.example.json config.json
```

Windows:

```cmd
copy config.example.json config.json
```

Then enter your Yamaha and Sinric Pro settings.

### Alexa says the device is not responding

Check:

1. The bridge is running.
2. Sinric Pro shows the device as connected.
3. The App Key and App Secret are correct.
4. The Device ID is correct.
5. The Sinric Pro Alexa skill is enabled.
6. Alexa has discovered the correct device.

### Volume commands do not work

Make sure you installed the project dependencies from the repository:

```bash
npm install
```

The Sinric Pro 5.1.0 compatibility patch should be automatically applied during installation.

You can verify that the patch exists:

```text
patches/sinricpro+5.1.0.patch
```

### Input switching does not work

Check your `inputMap` and make sure the Alexa name matches the configured mapping.

The Yamaha API can be queried for available input names using:

```text
http://YOUR_RECEIVER_IP/YamahaExtendedControl/v1/system/getNameText
```

### Zone 2 / Zone 3 / Zone 4

Change the zone in `config.json`:

```json
{
  "yamaha": {
    "ip": "YOUR_RECEIVER_IP",
    "zone": "zone2"
  }
}
```

The supported zone names depend on the receiver.

## Security

**Never commit your real `config.json` to GitHub.**

Your configuration contains your Sinric Pro credentials and local network information.

The repository includes:

```text
config.example.json
```

for sharing the required configuration format without exposing your credentials.

The `.gitignore` file excludes:

```text
config.json
node_modules/
```

## Project Structure

```text
yamaha-alexa-bridge-2/
├── index.js
├── package.json
├── package-lock.json
├── config.example.json
├── .gitignore
├── install-service.bat
├── uninstall-service.bat
├── patches/
│   └── sinricpro+5.1.0.patch
└── README.md
```

`node_modules` is intentionally not included in the repository. It is created automatically by:

```bash
npm install
```

## Credits

This project is based on the original Yamaha Alexa Bridge project by `afarmerinjapan`.

This version includes additional functionality and fixes, including improved volume handling, a web-based receiver dashboard, and compatibility with Sinric Pro 5.1.0.

## License

MIT License

See the repository for the complete license text.
