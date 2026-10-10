import { createMockApp } from "./app.js";
const portIndex = process.argv.indexOf("--port");
const port = portIndex < 0 ? 8092 : Number(process.argv[portIndex + 1]);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid --port");
createMockApp().listen(port, "127.0.0.1", () =>
  console.log(`Mock calendar: http://127.0.0.1:${port}/`),
);
