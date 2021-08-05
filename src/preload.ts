import { contextBridge, ipcRenderer } from "electron";

if (process.env.SPECTROSCOPE_TEST === "true") {
  console.log("[Spectroscope] Test Mode Enabled. Injecting Preload Bridge!");

  contextBridge.exposeInMainWorld("spectroscope", {
    exec: (expr: string) => ipcRenderer.sendSync("spectroscope-exec", expr),
  });
}
