import http from "node:http";
import { serveStatic } from "./static.js";

// Local test server (this computer only). Also answers on the GitHub Pages
// path "/classroom-quest/".
const port = Number(process.env.PORT || 4173);
const server = http.createServer((request, response) =>
  serveStatic(request, response),
);
server.listen(port, "127.0.0.1", () =>
  console.log(`TIC Quest: http://127.0.0.1:${port}/classroom-quest/`),
);
