# ESP Rowing Monitor WebGUI

The purpose of this project is to provide an intuitive WebGUI for [ESP Rowing Monitor](https://github.com/Abasz/ESPRowingMonitor), designed to simplify metrics tracking, settings management and firmware updates.

The WebGUI may be accessed via [GitHub Pages of this Repo](https://abasz.github.io/ESPRowingMonitor-WebGUI) directly as an installable Progressive Web App (with all its features) eliminating the need of running local developer/other server or host the page on the ESP32 MCU, building the Web GUI and so on. This means that this app, after install from the browser, can be used and accessed like a native app on Windows/IOS/Android with home screen icon, updates are pushed automatically, etc. This method provides a much simpler way of distributing this app.

![ESP Rowing Monitor WebGUI](docs/imgs/ESP-Rowing-Monitor-WebGUI.jpg)

The WebGUI supports all features of ESPRM API (i.e. it is able to take full advantage of the Extended BLE Metrics API as well as supports over-the-air firmware updates).

This approach solves several issues that has been encounter with the distribution method (e.g. its accessed through https so secured context is not an issue). Updates to the WebGUI can this way be pushed automatically and no longer requires recompilation and uploading to the MCU, etc.

**Note, the version served over the GitHub Pages is only compatible with version 5.2 and above of ESP Rowing Monitor. This is due to the fact that the WebGUI served via GitHub Pages do not work with the deprecated WebSocket based connection type (the issue is the lack of connection via ssl to the MCU and browser security prevents such connection, at least on chrome), i.e. it requires the new Extended BLE service introduced in version 5.2 of ESPRM. This is now default on the ESP Rowing Monitor firmware.**

For reference, the old README that related to the manual building and serving/hosting of the WebGUI have been moved [here](docs/deprecated-docs.md)

## BLE Heart Rate Monitor Support

The WebGUI supports BLE HR monitors that can be enabled in the setting. Once that is done a heart icon will show up on the toolbar that enables connecting to the HR monitor (user needs to click and then select the device from the popup window). The implementation uses Web Bluetooth API.

The WebGUI supports auto reconnect to previously paired device (reconnects to the one that was last connected) without the need to open the dialog.

However currently there are several limitations:

- Theoretically any browser (with sufficient high version) should work that supports the Web Bluetooth API. However, it has only been tested in Chrome
- WebGUI does not work on iOS because it does not support Web Bluetooth API on a device level (i.e. on iOS non of the browsers would work)
- While theoretically MacOS support Web Bluetooth API, there are reports that the WebGUI does not work on MacOS in any browser (report if this is not the case)
- For Chrome at least (but I suspect other browsers may too) require the `chrome://flags/#enable-web-bluetooth-new-permissions-backend` to be enabled for the reconnect feature to work correctly

## ANT+ Heart Rate Monitor Support

The WebGUI supports ANT+ HR monitors that can be enabled in the setting. Once that is done a heart icon will show up on the toolbar that enables connecting to the HR monitor (user needs to click and then select the device from the popup window). The implementation uses Web USB API.

However the ANT+ needs a WinUSB driver (instead of generic libusb) otherwise itt will not work. This can be installed with [Zadig](https://zadig.akeo.ie/).

## TCX export for Strava upload

It is possible to export logged workout data in TCX format that can be manually uploaded to Strava and other platforms.

## Experimental Logbook support

The GUI is capable of persisting sessions. However, this is saved to the browser storage which means that it is not transferable between devices automatically. Nevertheless, the GUI provides for an import/export feature that helps with moving the data between devices if necessary.

![ESP Rowing Monitor WebGUI Logbook](docs/imgs/ESP-Rowing-Monitor-WebGUI-logbook.jpg)

_Limitations:_

Even though the Logbook is saved to a fully functional client-side database (IndexedDB) for the web, it is not a persistent storage by default. IndexedDB without StorageManager is just a “best-effort” database that can be erased in situations of low disk space on a device. The browser may delete your database without notifying the user in case it needs to free up space for other website’s data that was used more recently than yours.

It is possible to request via the StorageManager API to persist the data and prevent accidental deletion but this is not perfect as there is no guarantee that persistance can be enabled (its up to the browser, system whether system got permission etc.).

For further information please see the [here](https://dexie.org/docs/StorageManager) and [here](https://hackernoon.com/persistent-data-what-working-with-the-storage-api-looks-like)

## Backlog

- Implement calibration feature within the UI
- Make sessions repayable, especially the force curves
- Add web firmware flasher with WebSerial to support full browser setup of devices (i.e. drop the requirement of compiling firmware for supported boards)
