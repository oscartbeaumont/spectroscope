import { app, BrowserWindow, ipcMain } from "electron";

export interface ExecResult {
  result: unknown;
  error: string;
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor; // eslint-disable-line

if (process.env.SPECTROSCOPE_TEST === "true") {
  console.log("[Spectroscope] Test Mode Enabled. Injecting Runtime!");
  app.commandLine.appendSwitch("remote-debugging-port", process.env.SPECTROSCOPE_TEST_DEBUGGER_PORT || "8315");
  app.commandLine.appendSwitch("host-rules", "MAP * 127.0.0.1");

  ipcMain.on("spectroscope-ready", async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.webContents.once("did-finish-load", () => {
      console.log("[Spectroscope] Window is Ready");
    });
  });

  ipcMain.on("spectroscope-exec", async (event, arg) => {
    const evalFunc = new AsyncFunction(
      "app, window, BrowserWindow",
      `return await (${arg})(app, window, BrowserWindow)`,
    );

    try {
      event.returnValue = {
        result: await evalFunc(app, BrowserWindow.fromWebContents(event.sender), BrowserWindow),
      } as ExecResult;
    } catch (error) {
      event.returnValue = {
        error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      } as ExecResult;
    }
  });
}
