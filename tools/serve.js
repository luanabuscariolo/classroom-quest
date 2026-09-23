import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
};
const server = http.createServer(async (request, response) => {
  try {
    // Test project-site paths too. Only public application files are served.
    let name = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    ).replace(/^\/classroom-quest(?=\/)/, "");
    if (name.endsWith("/")) name += "index.html";
    if (
      !/^\/(index\.html|LICENSE|src\/[\w-]+\.js|assets\/(css\/[\w-]+\.css|images\/[\w-]+\.png))$/.test(
        name,
      )
    ) {
      response.writeHead(404).end("Not found");
      return;
    }
    const file = path.join(root, name);
    const data = await fs.readFile(file);
    response.writeHead(200, {
      "Content-Type":
        name === "/LICENSE"
          ? "text/plain; charset=utf-8"
          : types[path.extname(file)],
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(data);
  } catch {
    response.writeHead(404).end("Not found");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`TIC Quest: http://127.0.0.1:${port}/classroom-quest/`),
);
