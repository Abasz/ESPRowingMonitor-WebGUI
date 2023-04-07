# ESP Rowing Monitor WebGUI

The purpose of this project is to provide a WebGUI for [ESP Rowing Monitor](https://github.com/Abasz/ESPRowingMonitor)

![ESP Rowing Monitor WebGUI](docs/imgs/ESP-Rowing-Monitor-WebGUI.jpg)

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

After running the web server under settings it is possible to set the websocekt address of ESP Rowing Monitor. Once the WebGUI connects to the websocket server it will receive updates automatically and show the available metrics.

## Build/Install

It is possible to serve the WebGUI directly from the ESP Rowing Monitor server. In order to do this, this project needs to be built and than the files under the `dist/esp-rowing-monitor-client` folder needs to be copied to the `data/` folder in the ESP Rowing Monitor project folder. Once thats done the SPIFFS image can be built and uploaded to the ESP32 MCU.

1. Run `ng build` to build the project. The build artifacts will be stored in the `dist/esp-rowing-monitor-client` directory.
2. Copy the files under the `dist/esp-rowing-monitor-client` to the ESP Rowing Monitor project folder `data/` folder
3. Run `pio run --target uploadfs --environment esp32` to upload the file system image to the ESP32 chip via USB Serial

## Backlog

- Add tooltips for icons
