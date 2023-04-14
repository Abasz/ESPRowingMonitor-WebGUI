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

## Backlog

- Add tooltips for icons
- Add BLE Heart Rate monitor compatibility via Web Bluetooth API
- Review the feasibility of adding ANT+ Heart Rate monitor capabilities via accessing the Ant+ stick through WebUSB API