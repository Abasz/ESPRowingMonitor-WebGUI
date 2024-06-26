# ESP Rowing Monitor WebGUI

The purpose of this project is to provide a WebGUI for [ESP Rowing Monitor](https://github.com/Abasz/ESPRowingMonitor)

![ESP Rowing Monitor WebGUI](docs/imgs/ESP-Rowing-Monitor-WebGUI.jpg)

Version 3.1 and above of this GUI is only compatibly with version 5.1 and above of ESP Rowing Monitor. Also the new WebGUI can be access now via [GitHub Pages of this Repo](https://abasz.github.io/ESPRowingMonitor-WebGUI) directly as an installable Progressive Web App (with all its features) eliminating the need of running local developer/other server or host the page on the ESP32 MCU. This means that this app, after install from the browser, can be used and accessed like a native app on Windows/IOS/Android with home screen icon etc.

**Please note that you need ESP Rowing Monitor firmware version 5.1 or above running on the ESP32 MCU to use the GitHub Pages version. Also the WebGUI served via GitHub Pages do not work with the WebSocket based connection type (the issue is the lack of connection via ssl to the MCU), i.e. it requires the new experimental extended BLE service introduced in version 5.1. This is now default on the ESP Rowing Monitor firmware. The WebSocket based connection approach is deprecated now and will probably be removed at some pint in the future.**

This approach solves several issues that has been encounter with the distribution method (e.g. its accessed through https so secured context is not an issue). Updates to the WebGUI can be done pushed automatically and no longer requires recompilation and uploading the the MCU, etc.

For reference the old README that related to the manual building and serving/hosting of the WebGUI have been moved [here](docs/deprecated-docs.md)

## BLE Heart Rate Monitor Support

The WebGUI supports BLE HR monitors that can be enabled in the setting. Once that is done a heart icon will show up on the toolbar that enables connecting to the HR monitor (user needs to click and then select the device from the popup window). The implementation uses Web Bluetooth API.

The WebGUI supports auto reconnect to previously paired device (reconnects to the one that was last connected) without the need to open the dialog.

However currently there are several limitations:

- Theoretically any browser (with sufficient high version) should work that supports the Web Bluetooth API. However, it has only been tested in Chrome
- For Chrome at least (but I suspect other browsers may too) require the `chrome://flags/#enable-web-bluetooth-new-permissions-backend` to be enabled for the reconnect feature to work correctly

## ANT+ Heart Rate Monitor Support

The WebGUI supports ANT+ HR monitors that can be enabled in the setting. Once that is done a heart icon will show up on the toolbar that enables connecting to the HR monitor (user needs to click and then select the device from the popup window). The implementation uses Web USB API.

However the ANT+ needs a WinUSB driver (instead of generic libusb) otherwise itt will not work. This can be installed with [Zadig](https://zadig.akeo.ie/).

## Backlog

- Add tooltips for icons
