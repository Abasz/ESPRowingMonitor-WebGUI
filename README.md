# ESP Rowing Monitor WebGUI

The purpose of this project is to provide a WebGUI for [ESP Rowing Monitor](https://github.com/Abasz/ESPRowingMonitor)

![ESP Rowing Monitor WebGUI](docs/imgs/ESP-Rowing-Monitor-WebGUI.jpg)

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

After running the web server under settings (cog icon on the toolbar) it is possible to set the WebSocket address of ESP Rowing Monitor. Once the WebGUI connects to the websocket server it will receive updates automatically and show the available metrics.

## Build/Install

It is possible to serve the WebGUI directly from the ESP Rowing Monitor server. In order to do this, this project needs to be built and than the files under the `dist/esp-rowing-monitor-client` folder needs to be copied to the `data/www` folder in the ESP Rowing Monitor project folder. Once thats done the LittleFs image can be built and uploaded to the ESP32 MCU.

1. Run `ng build` to build the project. The build artifacts will be stored in the `dist/esp-rowing-monitor-client` directory.
2. Copy the files under the `dist/esp-rowing-monitor-client` to the ESP Rowing Monitor project folder `data/www` folder
3. Run `pio run --target uploadfs --environment esp32` to upload the file system image to the ESP32 chip via USB Serial

One advantage of serving the WebGUI via the built in web server is that the WebSocket address is set automatically.

## Experimental BLE Heart Rate Monitor Support

Added experimental BLE HR support that can be enabled in the setting. Once that is done a heart icon will show up on the toolbar that enables connecting to the HR monitor (user needs to click and then select the device from the popup window). The implementation uses Web Bluetooth API. However currently there are several limitations:

- Automatic connection to a previously pared device is not implemented so devices need to be selected on every connect. I was able to identify some probable solutions, but I need to do more research and testing.
- As per the specs Web BLE API is only available in [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts), i.e. either when accessing locally-delivered resources such as those with `http://127.0.0.1` URLs, `http://localhost` and `http://*.localhost` URLs (e.g. `http://dev.whatever.localhost/`), and `file://` URLs. This means that BLE connection will not be available if WebGUI is served up from the ESP32 as it does not meet any of the above criteria (served up via http from a local IP address). Currently there are two possible workarounds:

1) to serve the page up from the computer as a [Developer server](#development-server)
2) to set up reverse proxy for the ESP32's IP address and rewrite rule in IIS/Apache for a localhost address

None of the above are ideal especially in a DHCP local network as on the IP address change of the ESP32 these needs updating (in Option 1 on the WebGUI under settings, in Option 2 in IIS/Apache). A potential workaround is to set up a DHCP Binding in the router so the ESP32 gets assigned a reserved IP address.

Option 1 is generally easier to setup but more cumbersome as the dev server needs starting every time, while option 2 is more complicated to set up initially but on the long term its more of a shoot and forget solution.

A more robust and permanent solution to this is to implement/move to a web server library on the ESP32 that supports tls/ssl. This may happen in the future but for now due to lack of resources this is not planned (help though would be appreciated)

## Experimental ANT+ Heart Rate Monitor Support

Added experimental ANT+ HR support that can be enabled in the setting. Once that is done a heart icon will show up on the toolbar that enables connecting to the HR monitor (user needs to click and then select the device from the popup window). The implementation uses Web USB API. However currently there are a few limitations:

- Same issue with the secure context as for [bluetooth](#experimental-ble-heart-rate-monitor-support)
- The ANT+ stick needs a WinUSB driver (instead of generic libusb) otherwise itt will not work. This can be installed with [Zadig](https://zadig.akeo.ie/).

## Backlog

- Add tooltips for icons
