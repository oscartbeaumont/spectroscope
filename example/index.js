/* eslint-disable @typescript-eslint/no-var-requires */
const { app, BrowserWindow } = require("electron");

// Inject Spectroscope into the main thread. This will expose the main thread to the Spectroscope preload script when the electron application is started through Spectroscope.
require("spectroscope/main");

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // Spectroscope requires a preload script to bridge the main thread and the renderer
      preload: __dirname + "/preload.js",
    },
  });

  win.loadFile("./index.html");
});
