<h1 align="center">Spectroscope</h1>

![NPM](https://img.shields.io/npm/v/spectroscope)
![CI workflow](https://github.com/oscartbeaumont/spectroscope/actions/workflows/ci.yml/badge.svg)

Test your [Electron](https://www.electronjs.org/) applications in style!

## Features:
 - Simple
 - Easy to use
 - Works with Electron security features enabled unlike [Spectron](https://github.com/electron-userland/spectron/issues/693)

## Basics

### Installation

```bash
npm install --save-dev spectroscope
# Or
yarn add --dev spectroscope
```

### Add Spectroscope to your application

Add the line `require("spectroscope/main");` into your Electron application's main thread. This is the Javascript/Typescript file that is executed by the `electron` binary.

Next ensure you have a preload script configured as shown below.

```javascript
const win = new BrowserWindow({
  webPreferences: {
    preload: __dirname + "/preload.js", # This line here
  },
});
```

And finally add the line `require("spectroscope/preload");` to your preload script.

You have successfully added the Spectroscope runtime to your application. This allows the test suite to correctly communicate with the Electron main thread. If your application was not launched using Spectroscope, the runtime code will disable itself so it does not pose a security risk.

### Test your application!

Now you can write tests for your application!

An example of how to do this using [Jest](https://jestjs.io/) can be [found here](https://github.com/oscartbeaumont/spectroscope/blob/main/example/index.test.js). Jest is shown here but any testing framework, or regular Javascript/Typescript program would work.

## Spectron Exports

### Application

You declare an application for each test that is run. This informs Spectron about the Electron application you would like to execute.


```javascript
const Application = require("spectroscope");

const app = Application({
  exec: path.join(__dirname, "/node_modules/.bin/electron"),
  args: ["."],
  enableConsoleOutput: false,
});
```

You must `await app.start();` before beginning your test code and `await app.stop()` after completing your test code.

#### $

Exported from WebdriverIO. Refer to documentation [here](https://webdriver.io/docs/api/browser/$).

```javascript
const element = await app.$("#title");
```

### $$

Exported from WebdriverIO. Refer to documentation [here](https://webdriver.io/docs/api/browser/$$).

```javascript
const elements = await app.$$(".title");
```

### Evaluate

Evaluate runs an expression on the Electron main thread with full access to the [app](https://www.electronjs.org/docs/api/app), [window](https://www.electronjs.org/docs/api/browser-window#browserwindow) (this refers to the current BrowserWindow) and [BrowserWindow](https://www.electronjs.org/docs/api/browser-window#browserwindow) and returns the response to the test code.

```javascript
const url = await app.evaluate(async (app, window, BrowserWindow) => window.webContents.getURL());
```

### Execute

Execute runs an expression on the Electron main thread with full access to the [app](https://www.electronjs.org/docs/api/app), [window](https://www.electronjs.org/docs/api/browser-window#browserwindow) (this refers to the current BrowserWindow) and [BrowserWindow](https://www.electronjs.org/docs/api/browser-window#browserwindow) and **does not** returns the response to the test code.

Execute must be used over Evaluate if the browser preload context were to change, for example when navigating to a new page as shown below.

```javascript
await app.execute(async (app, window, BrowserWindow) => window.loadURL("https://otbeaumont.me"));
```

### Known Issues

- Triggering Devtools in Electron can disconnect the debugger used by Spectroscope.

## Developing on Spectroscope

To run and test the Spectroscope codebase use the following commands.

```bash
yarn
yarn build
cd example/
yarn
yarn run link
yarn test
```
