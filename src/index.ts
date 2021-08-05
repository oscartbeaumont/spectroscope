import { spawn, ChildProcess } from "child_process";
import { App, BrowserWindow } from "electron";
import {
  Browser,
  ChainablePromiseArray,
  ChainablePromiseElement,
  ElementArray,
  remote,
  Selector,
} from "webdriverio";

export interface ApplicationArgs {
  exec: string;
  args?: string[];
  electronStartTimeout?: number;
  enableConsoleOutput?: boolean;
}

export interface Application {
  readonly debugger_port: number;
  browser?: Browser<"async">;
  child_process?: ChildProcess;
  start(): Promise<void>;
  stop(): Promise<void>;
  $(selector: Selector): ChainablePromiseElement<Promise<any>>;
  $$(selector: Selector): ChainablePromiseArray<ElementArray>;
  execute(
    fn: (
      app: App,
      window: BrowserWindow,
      BrowserWindow: BrowserWindow
    ) => Promise<void>
  ): Promise<void>;
  evaluate(
    fn: (
      app: App,
      window: BrowserWindow,
      BrowserWindow: BrowserWindow
    ) => Promise<any>
  ): Promise<any>;
}

export default function Application(args: ApplicationArgs): Application {
  return {
    debugger_port: 8055,
    async start() {
      this.child_process = spawn(args.exec, args.args || [], {
        env: {
          SPECTROSCOPE_TEST: "true",
          SPECTROSCOPE_TEST_DEBUGGER_PORT: this.debugger_port.toString(),
          ...process.env,
        },
        stdio: args.enableConsoleOutput
          ? [process.stdin, process.stdout, process.stderr]
          : [],
      });

      this.child_process!.on("close", (code) => {
        console.error(`[Spectroscope] Application exited with code ${code}`);
        this.browser = undefined;
      });

      this.child_process!.on("exit", (code) => {
        console.error(`[Spectroscope] Application exited with code ${code}`);
        this.browser = undefined;
      });

      await new Promise((res) =>
        setTimeout(res, args.electronStartTimeout || 1000)
      );

      if (this.child_process.exitCode !== null) {
        throw new Error("[Spectroscope] Error starting application!");
      }

      try {
        this.browser = await remote({
          logLevel: "error",
          capabilities: {
            browserName: "chrome",
            "goog:chromeOptions": {
              debuggerAddress: "127.0.0.1:" + this.debugger_port.toString(),
            },
          },
        });
      } catch (err) {
        console.error(
          "[Spectroscope] Error connecting to application debugger:\n",
          err,
          "\n\nAre you sure you imported Spectroscope into the Electron main process?"
        );
      }
    },
    async stop() {
      if (this.child_process !== undefined) {
        this.child_process!.removeAllListeners();
        this.child_process.kill();
        this.browser = undefined;
      }
    },
    $(selector: Selector): ChainablePromiseElement<Promise<any>> {
      if (this.browser === undefined)
        throw new Error("[Spectroscope] Browser not initialised!");

      return this.browser.$(selector);
    },
    $$(selector: Selector): ChainablePromiseArray<ElementArray> {
      if (this.browser === undefined)
        throw new Error("[Spectroscope] Browser not initialised!");

      return this.browser.$$(selector);
    },
    async execute(
      fn: (
        app: App,
        window: BrowserWindow,
        BrowserWindow: BrowserWindow
      ) => Promise<void>
    ) {
      if (this.browser === undefined)
        throw new Error("[Spectroscope] Browser not initialised!");
      if (await this.browser.execute(`window.spectroscope === undefined`))
        throw new Error(
          "Spectroscope not injected into Electron preload context!"
        );

      return this.browser.execute(
        `spectroscope.exec(${JSON.stringify(
          `async (app, window, BrowserWindow) => { (${fn.toString()})(app, window, BrowserWindow); return undefined; }`
        )})`
      );
    },
    async evaluate(
      fn: (
        app: App,
        window: BrowserWindow,
        BrowserWindow: BrowserWindow
      ) => Promise<any>
    ) {
      if (this.browser === undefined)
        throw new Error("[Spectroscope] Browser not initialised!");
      if (await this.browser.execute(`window.spectroscope === undefined`))
        throw new Error(
          "Spectroscope not injected into Electron preload context!"
        );

      return this.browser.execute(
        `spectroscope.exec(${JSON.stringify(fn.toString())})`
      );
    },
  };
}
