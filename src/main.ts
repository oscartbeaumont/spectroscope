import { app, BrowserWindow, ipcMain } from "electron";

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor; // eslint-disable-line

if (process.env.SPECTROSCOPE_TEST === "true") {
  console.log("[Spectroscope] Test Mode Enabled. Injecting Runtime!");
  app.commandLine.appendSwitch("remote-debugging-port", process.env.SPECTROSCOPE_TEST_DEBUGGER_PORT || "8315");
  app.commandLine.appendSwitch("host-rules", "MAP * 127.0.0.1");

  ipcMain.on("spectroscope-exec", async (event, arg) => {
    const evalFunc = new AsyncFunction(
      "app, window, BrowserWindow",
      `return await (${arg})(app, window, BrowserWindow)`,
    );

    event.returnValue = await evalFunc(app, BrowserWindow.fromWebContents(event.sender), BrowserWindow);
  });
}
