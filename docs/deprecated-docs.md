# Deprecated documentation

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

- As per the specs Web BLE API is only available in [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts), i.e. either when accessing locally-delivered resources such as those with `http://127.0.0.1` URLs, `http://localhost` and `http://*.localhost` URLs (e.g. `http://dev.whatever.localhost/`), and `file://` URLs. This should mean that BLE connection will not be available if WebGUI is served up from the ESP32 as it does not meet any of the above criteria (served up via http from a local IP address). Currently there are several possible workarounds:

1) serve the page up from the computer as a [Developer server](#development-server)
2) use a simple light weight http server (it is available on most platforms including android) and serve the GUI from there and access it through localhost
3) set up proxy pass for the ESP32's IP address and rewrite rule in IIS/Apache for a `localhost` address
4) route through a secure https page (e.g. one that has a self-signed certificate) with proxy pass in IIS/Apache (I went down this route)

None of the above are ideal especially in a DHCP local network as on the IP address change of the ESP32 these needs updating (in Option 1-2 on the WebGUI under settings, in Option 3-4 in IIS/Apache). A potential workaround is to set up a DHCP Binding in the router so the ESP32 gets assigned a reserved IP address.

Option 1 and 2 is generally easier to setup but option 1 more cumbersome as the dev server needs starting every time, while option 3-4 is more complicated to set up initially but on the long term its more of a shoot and forget solution.

A more robust and permanent solution to this is to implement/move to a web server library on the ESP32 that supports tls/ssl. However, while recently I was able to implement a https server (after testing libraries ending up using [this library](https://github.com/hoeken/PsychicHTTP)) on the ESP32 that worked, tests have shown that the MCU does not have sufficient memory (ssl handshakes require approx 45kb heap per socket!) making the device very unstable. I have created a separate [branch](https://github.com/Abasz/ESPRowingMonitor#http-server) on the ESP Rowing Monitor repo which has an updated README that includes the relevant considerations and observations.

**Long story short, it is highly unlikely that a dedicated https server will make it to a stable release on the monitor and my recommendation is to use Option 2 (light weight web server).**
