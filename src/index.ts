import { spawn, ChildProcess } from "child_process";
import { App, BrowserWindow, BrowserWindow as ElectronBrowserWindow } from "electron";
import { Browser, ChainablePromiseArray, ChainablePromiseElement, ElementArray, remote, Selector } from "webdriverio";
import * as path from "path";

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
  $(selector: Selector): ChainablePromiseElement<Promise<any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
  $$(selector: Selector): ChainablePromiseArray<ElementArray>;
  execute(
    fn: (app: App, window: BrowserWindow, BrowserWindow: typeof ElectronBrowserWindow) => Promise<void>,
  ): Promise<void>;
  evaluate(
    fn: (app: App, window: BrowserWindow, BrowserWindow: typeof ElectronBrowserWindow) => Promise<unknown>,
  ): Promise<unknown>;
  auditAccessibility(ignoreWarnings?: boolean): Promise<string[]>;
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
        stdio: args.enableConsoleOutput ? [process.stdin, process.stdout, process.stderr] : [],
      });

      const childProcessExitHander = (code: number) => {
        if (code !== 0) {
          console.error(`[Spectroscope] Application exited with error code ${code}`);
        }
        this.stop();
      };

      this.child_process?.on("close", childProcessExitHander);
      this.child_process?.on("exit", childProcessExitHander);

      await new Promise((res) => {
        const promiseComplete = () => {
          this.child_process?.removeListener("close", handleExit);
          this.child_process?.removeListener("exit", handleExit);
          this.child_process?.stdout?.removeListener("data", handleStdout);
          res(undefined);
        };

        const handleStdout = (data: string) => {
          if (data === "[Spectroscope] Window is Ready") promiseComplete();
        };

        const handleExit = (code: number) => {
          if (code !== 0) {
            console.error(`[Spectroscope] Application exited with error code ${code}`);
          }
          promiseComplete();
        };

        setTimeout(promiseComplete, args.electronStartTimeout || 3000);

        this.child_process?.on("close", handleExit);
        this.child_process?.on("exit", handleExit);
        this.child_process?.stdout?.on("data", handleStdout);
      });

      if (this.child_process.exitCode !== null) {
        await this.stop();
        throw new Error("[Spectroscope] Error starting application!");
      }

      let connected = false;
      setTimeout(() => (connected = true), 7000);
      while (!connected) {
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
          connected = true;
        } catch (err) {
          if (err.errno === "ECONNREFUSED") {
            console.error(
              "[Spectroscope] Error connecting to application debugger. Are you sure you imported Spectroscope into the Electron main process?",
            );

            this.browser = undefined;
            await new Promise((res) => setTimeout(res, 500));
          } else {
            await this.stop();
            throw err;
          }
        }
      }

      if (this.browser === undefined) {
        await this.stop();
        throw "[Spectroscope] Attempts to attach to the application debugger have timed out!";
      }
    },
    async stop() {
      if (this.child_process !== undefined) {
        this.child_process?.stdout?.removeAllListeners();
        this.child_process?.removeAllListeners();
        this.child_process.kill();
        this.child_process = undefined;
        this.browser = undefined;
      }
    },
    $(
      selector: Selector,
    ): ChainablePromiseElement<Promise<any>> /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
      if (this.browser === undefined) throw new Error("[Spectroscope] Browser not initialised!");

      return this.browser.$(selector);
    },
    $$(selector: Selector): ChainablePromiseArray<ElementArray> {
      if (this.browser === undefined) throw new Error("[Spectroscope] Browser not initialised!");

      return this.browser.$$(selector);
    },
    async execute(fn: (app: App, window: BrowserWindow, BrowserWindow: typeof ElectronBrowserWindow) => Promise<void>) {
      if (this.browser === undefined) throw new Error("[Spectroscope] Browser not initialised!");
      if (await this.browser.execute(`window.spectroscope === undefined`))
        throw new Error("Spectroscope not injected into Electron preload context!");

      return this.browser.execute(
        `spectroscope.exec(${JSON.stringify(
          `async (app, window, BrowserWindow) => { (${fn.toString()})(app, window, BrowserWindow); return undefined; }`,
        )})`,
      );
    },
    async evaluate(
      fn: (app: App, window: BrowserWindow, BrowserWindow: typeof ElectronBrowserWindow) => Promise<unknown>,
    ) {
      if (this.browser === undefined) throw new Error("[Spectroscope] Browser not initialised!");
      if (await this.browser.execute(`window.spectroscope === undefined`))
        throw new Error("Spectroscope not injected into Electron preload context!");

      return this.browser.execute(`spectroscope.exec(${JSON.stringify(fn.toString())})`);
    },
    async auditAccessibility(ignoreWarnings?: boolean): Promise<string[]> {
      interface AuditAccessibilityResult {
        result: string;
        rule: {
          severity: string;
        };
      }

      const runTests = async (axs_lib_path: string, ignoreWarnings: boolean) =>
        await new Promise((resolve) => {
          const script = document.createElement("script");
          script.type = "text/javascript";
          script.src = "file://" + axs_lib_path;
          script.onload = () => {
            const axs: any = (window as any).axs; // eslint-disable-line @typescript-eslint/no-explicit-any
            const results: AuditAccessibilityResult[] = axs.Audit.run(
              new axs.AuditConfiguration({
                showUnsupportedRulesWarning: false,
              }),
            );

            let failures = results.filter((result) => result.result === "FAIL");
            if (ignoreWarnings) {
              failures = failures.filter((result) => result.rule.severity !== "Warning");
            }
            resolve(failures.map(axs.Audit.accessibilityErrorMessage));
          };
          document.head.appendChild(script);
        });

      return (
        (await this.browser?.execute(
          `(${runTests.toString()})("${path.join(__dirname, "../vendor/axs_testing.js")}", ${ignoreWarnings || false})`,
        )) || []
      );
    },
  };
}
