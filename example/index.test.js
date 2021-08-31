/* eslint-disable @typescript-eslint/no-var-requires */
const Application = require("spectroscope");
const path = require("path");

const app = Application({
  exec: path.join(__dirname, "/node_modules/.bin/electron"),
  args: ["."],
  enableConsoleOutput: false,
});

jest.setTimeout(15000);

beforeEach(async () => await app.start());
afterEach(async () => await app.stop());

test("app renders title text", async () => {
  const e = await app.$("#title");
  expect(await e.getText()).toBe("Hello World!");
});

test("app renders paragraph text", async () => {
  const e = await app.$("#some-text");
  expect(await e.getText()).toBe("A Paragraph!");
});

test("check devtools is disabled", async () => {
  expect(await app.evaluate(async (app, window) => window.webContents.isDevToolsOpened())).toBe(false);
});

test("app navigate URL", async () => {
  const getURL = async () => app.evaluate(async (app, window) => window.webContents.getURL());

  expect(await getURL()).toEqual(expect.stringContaining("file://"));
  await app.execute(async (app, window) => window.loadURL("https://otbeaumont.me"));
  expect(await getURL()).toBe("https://otbeaumont.me/");
});

test("confirm NODE_ENV is set correctly", async () => {
  expect(await app.evaluate(async () => process.env.NODE_ENV)).toBe("test");
});

test("audit accessibility", async () => {
  const results = await app.auditAccessibility();
  results.forEach((result) => console.error(result));
  expect(results.length).toBe(0);
});
