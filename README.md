# Yamaha Alexa Bridge

Control compatible Yamaha network receivers with Amazon Alexa voice commands using [Sinric Pro](https://sinric.pro/).

This project provides a bridge between Alexa, Sinric Pro, and the Yamaha Extended Control (YXC) API. It was created as an alternative for controlling Yamaha receivers after Yamaha's native Alexa integration was deprecated.

## Features

- Power on/off
- Absolute volume control
- Relative volume adjustments
- Mute/unmute
- Play, pause, stop, next, and previous
- Input/source selection
- Support for Yamaha zones
- Automatic Yamaha volume-scale conversion
- Live receiver status dashboard
- Automatic macOS startup using a LaunchAgent installer
- Optional Windows service installation
- Runs on Windows, macOS, and Linux

### Alexa Volume Commands

Examples:

- "Alexa, set Receiver volume to 50"
- "Alexa, turn Receiver up"
- "Alexa, turn Receiver down"
- "Alexa, turn Receiver down 5"
- "Alexa, turn Receiver up 5"

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

- RX-V series
- RX-A series
- Other Yamaha receivers supporting the Yamaha Extended Control API

### Check Compatibility

Find your receiver's IP address and open:

```text
http://YOUR_RECEIVER_IP/YamahaExtendedControl/v1/main/getStatus
```

For example:

```text
http://192.168.1.100/YamahaExtendedControl/v1/main/getStatus
```

If the receiver returns JSON containing power, volume, and input information, the receiver is likely compatible with the bridge.

## Prerequisites

- **Node.js 18 or later**
- **A computer that stays on** — Windows, macOS, or Linux
- **Receiver and computer on the same local network**
- **Sinric Pro account**
- **Amazon Alexa** with the Sinric Pro skill

## Setup

### Step 1: Create a Sinric Pro Device

1. Sign in to Sinric Pro.
2. Go to **Devices** and select **Add Device**.
3. Set the device type to **TV**.
4. Give the device a name Alexa will use, such as `Receiver`, `Stereo`, or `Yamaha`.
5. Save the device and copy the **Device ID**.
6. Go to **Credentials** and create or retrieve your **App Key** and **App Secret**.

### Step 2: Link Sinric Pro to Alexa

1. Open the Alexa app.
2. Go to **More → Skills & Games**.
3. Search for **Sinric Pro**.
4. Enable the skill and sign in with your Sinric Pro account.
5. Say:

```text
Alexa, discover my devices
```

Alexa should discover the Sinric Pro device you created.

### Step 3: Find Your Receiver's IP Address

Check your router's admin page for connected devices, or look in your receiver's network settings menu.

**Important:** Assign a static IP or DHCP reservation for your receiver so its IP address does not change.

### Step 4: Install the Bridge

1. Download or clone this repository.
2. Open Terminal or Command Prompt in the project directory.
3. Install dependencies:

```bash
npm install
```

4. Copy the example configuration:

macOS/Linux:

```bash
cp config.example.json config.json
```

Windows:

```cmd
copy config.example.json config.json
```

5. Edit `config.json` with your settings:

```json
{
  "yamaha": {
    "ip": "192.168.0.75",
    "zone": "main"
  },
  "sinricpro": {
    "appKey": "your-app-key-here",
    "appSecret": "your-app-secret-here",
    "deviceId": "your-device-id-here"
  }
}
```

6. Start the bridge:

```bash
npm start
```

A successful startup should look similar to:

```text
=== Yamaha Alexa Bridge ===
[Config] Receiver: 192.168.1.100 (main)
[Yamaha] Connected. Power: on, Volume: 53/161, Input: hdmi1
[SinricPro] Connected. Waiting for Alexa commands...
```

The exact IP address, volume, and input will depend on your receiver.

7. Try a voice command:

```text
Alexa, turn on Receiver
```

## macOS Automatic Startup

The repository includes an installer that configures the bridge to start automatically when you log in to macOS and restart automatically if the process exits unexpectedly. It uses a macOS `LaunchAgent`, so no third-party service manager is required.

### Automatic Installation

From the project directory:

```bash
chmod +x install-macos-service.sh
./install-macos-service.sh
```

The installer automatically:

- Detects the project directory
- Detects the installed `npm` path
- Creates the LaunchAgent configuration
- Validates the generated plist
- Loads the LaunchAgent for your user account
- Configures the bridge to start automatically at login
- Configures `KeepAlive` so the bridge is restarted if it stops unexpectedly
- Creates log files under `~/Library/Logs/YamahaAlexaBridge/`

### Verify the Service

Check the LaunchAgent status with:

```bash
launchctl print gui/$(id -u)/com.yamaha-alexa-bridge
```

You can also check the process with:

```bash
launchctl list | grep yamaha
```

### View Logs

Bridge output:

```bash
tail -f ~/Library/Logs/YamahaAlexaBridge/bridge.log
```

Error output:

```bash
tail -f ~/Library/Logs/YamahaAlexaBridge/error.log
```

### Manual LaunchAgent Installation

If you prefer to configure the service manually, create:

```text
~/Library/LaunchAgents/com.yamaha-alexa-bridge.plist
```

Use absolute paths for both the project directory and `npm`. You can find them with:

```bash
pwd
which npm
```

Example:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.yamaha-alexa-bridge</string>

    <key>WorkingDirectory</key>
    <string>/PATH/TO/yamaha-alexa-bridge</string>

    <key>ProgramArguments</key>
    <array>
        <string>/PATH/TO/npm</string>
        <string>start</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>/Users/YOUR_USERNAME/Library/Logs/YamahaAlexaBridge/bridge.log</string>

    <key>StandardErrorPath</key>
    <string>/Users/YOUR_USERNAME/Library/Logs/YamahaAlexaBridge/error.log</string>
</dict>
</plist>
```

Create the log directory before loading the agent:

```bash
mkdir -p ~/Library/Logs/YamahaAlexaBridge
```

Validate the plist:

```bash
plutil -lint ~/Library/LaunchAgents/com.yamaha-alexa-bridge.plist
```

Load it:

```bash
launchctl load ~/Library/LaunchAgents/com.yamaha-alexa-bridge.plist
```

To stop and unload it:

```bash
launchctl unload ~/Library/LaunchAgents/com.yamaha-alexa-bridge.plist
```

`launchd` does not expand `~` inside plist paths, so use full absolute paths in the plist.

## Voice Commands

| Alexa Command | Function |
|---|---|
| "Alexa, turn on Receiver" | Powers on the receiver |
| "Alexa, turn off Receiver" | Puts the receiver in standby |
| "Alexa, set Receiver volume to 30" | Sets volume to 30% |
| "Alexa, turn up Receiver" | Increases volume |
| "Alexa, turn down Receiver" | Decreases volume |
| "Alexa, turn Receiver up 5" | Increases volume by 5 steps |
| "Alexa, turn Receiver down 5" | Decreases volume by 5 steps |
| "Alexa, mute Receiver" | Mutes the receiver |
| "Alexa, unmute Receiver" | Unmutes the receiver |
| "Alexa, pause Receiver" | Pauses playback |
| "Alexa, resume Receiver" | Resumes playback |
| "Alexa, stop Receiver" | Stops playback |
| "Alexa, next on Receiver" | Next track |
| "Alexa, previous on Receiver" | Previous track |
| "Alexa, switch Receiver input to HDMI 1" | Switches to HDMI 1 |
| "Alexa, switch Receiver input to Spotify" | Switches to Spotify |
| "Alexa, switch Receiver input to Bluetooth" | Switches to Bluetooth |

## Volume Mapping

Yamaha receivers use an internal volume scale, typically `0-161`. The bridge reads the receiver's reported maximum volume and converts Alexa's percentage to the Yamaha scale.

| Alexa Volume | Approx. Yamaha Volume |
|---:|---:|
| 20% | 32/161 |
| 30% | 48/161 |
| 50% | 81/161 |
| 100% | 161/161 |

### Relative Volume

Relative commands use the receiver's current volume and apply the requested adjustment.

For example:

```text
Alexa, turn Receiver down 5
```

If the receiver is currently at `50/161`, the bridge sends `45/161`. The volume is automatically limited to the receiver's valid range.

## Sinric Pro 5.1.0 Volume Compatibility

This project includes a `patch-package` patch for Sinric Pro 5.1.0.

The patch is located at:

```text
patches/sinricpro+5.1.0.patch
```

The patch corrects volume request handling so Alexa volume commands are passed correctly to the bridge.

It supports both:

- Absolute volume commands (`setVolume`)
- Relative volume commands (`adjustVolume`)

The patch is automatically applied when dependencies are installed:

```bash
npm install
```

The patch specifically targets **Sinric Pro 5.1.0**. Do not upgrade that package without checking whether the patch is still required and compatible.

## Receiver Status Dashboard

The bridge includes a built-in web dashboard for monitoring and controlling the receiver.

By default, the dashboard is available at:

```text
http://localhost:3000
```

The port can be changed with the optional `statusPort` setting in `config.json`.

The dashboard provides:

- Yamaha connection status
- Sinric Pro connection status
- Receiver power state
- Current volume and maximum volume
- Current input
- Mute state
- Power controls
- Volume slider and volume adjustment buttons
- Mute control
- Input selection

The dashboard receives live receiver status updates without requiring a browser refresh. Physical remote-control changes are reflected automatically.

## Configuration

The bridge is configured through `config.json`. Do not commit this file because it contains your Sinric Pro credentials and local network information.

| Setting | Description |
|---|---|
| `yamaha.ip` | IP address of the Yamaha receiver |
| `yamaha.zone` | Yamaha zone to control (`main`, `zone2`, `zone3`, or `zone4`) |
| `yamaha.inputMap` | Optional custom Alexa-to-Yamaha input mapping |
| `sinricpro.appKey` | Sinric Pro App Key |
| `sinricpro.appSecret` | Sinric Pro App Secret |
| `sinricpro.deviceId` | Sinric Pro device ID |

Example configuration:

```json
{
  "yamaha": {
    "ip": "192.168.0.75",
    "zone": "main",
    "inputMap": {
      "Chromecast": "hdmi1"
    }
  },
  "sinricpro": {
    "appKey": "your-app-key-here",
    "appSecret": "your-app-secret-here",
    "deviceId": "your-device-id-here"
  }
}
```

## Input Mapping

The bridge maps Alexa input names to Yamaha input IDs. The default map covers common inputs. To customize, add an `inputMap` to your `config.json`:

```json
{
  "yamaha": {
    "ip": "192.168.0.75",
    "zone": "main",
    "inputMap": {
      "Chromecast": "hdmi1"
    }
  }
}
```

Then say: "Alexa, switch Receiver input to Chromecast"

## Troubleshooting

### Cannot Reach the Receiver

Check:

- The IP address in `config.json`
- The receiver is connected to the network
- The computer running the bridge is on the same network

Test the Yamaha API directly:

```text
http://YOUR_RECEIVER_IP/YamahaExtendedControl/v1/main/getStatus
```

### `config.json` Not Found

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

### Alexa Says the Device Is Not Responding

Check:

1. The bridge is running.
2. Sinric Pro shows the device as connected.
3. The App Key and App Secret are correct.
4. The Device ID is correct.
5. The Sinric Pro Alexa skill is enabled.
6. Alexa has discovered the correct device.

### Volume Commands Do Not Work

Make sure the project dependencies were installed from the repository:

```bash
npm install
```

The Sinric Pro 5.1.0 compatibility patch should be automatically applied during installation.

Verify that the patch exists:

```text
patches/sinricpro+5.1.0.patch
```

### Input Switching Does Not Work

Check your `inputMap` and make sure the Alexa input name matches the configured mapping.

The Yamaha API can be queried for available input names using:

```text
http://YOUR_RECEIVER_IP/YamahaExtendedControl/v1/system/getNameText
```

### Zone 2 / Zone 3 / Zone 4

Change the zone in `config.json`:

```json
{
  "yamaha": {
    "ip": "192.168.1.100",
    "zone": "zone2"
  }
}
```

The supported zone names depend on the receiver.

## Running as a Windows Service

The repository includes Windows service installation scripts for users who want the bridge to run automatically in the background.

### Requirements

The included service scripts use **NSSM (Non-Sucking Service Manager)**.

1. Download NSSM.
2. Extract `nssm.exe`.
3. Place `nssm.exe` in the project directory or add it to your system PATH.
4. Right-click `install-service.bat`.
5. Select **Run as Administrator**.

The service will run the Yamaha Alexa Bridge automatically.

To remove the service, right-click `uninstall-service.bat` and select **Run as Administrator**.

Service output is written to:

```text
service.log
```

## Security

**Never commit your real `config.json` to GitHub.**

It contains your Sinric Pro credentials and local network information. The repository's `.gitignore` is configured to exclude this file.

## Project Structure

```text
yamaha-alexa-bridge/
├── index.js
├── config.example.json
├── package.json
├── patches/
│   └── sinricpro+5.1.0.patch
├── install-macos-service.sh
├── install-service.bat
├── uninstall-service.bat
└── README.md
```

`node_modules` is intentionally excluded from the repository and is created automatically by `npm install`.

## Credits

- Yamaha Extended Control API for receiver control
- Sinric Pro for Alexa device integration
- `patch-package` for maintaining the Sinric Pro 5.1.0 compatibility patch

## License

See the repository for licensing information.
