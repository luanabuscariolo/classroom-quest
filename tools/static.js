import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};
// Only public application files are served.
const PUBLIC =
  /^\/(index\.html|manifest\.webmanifest|sw\.js|LICENSE|src\/[\w-]+\.js|assets\/(css\/[\w-]+\.css|images\/[\w-]+\.(webp|png)))$/;

/** Path inside the app, with or without the GitHub Pages "/classroom-quest". */
export function appPath(url) {
  let name = decodeURIComponent(
    new URL(url, "http://localhost").pathname,
  ).replace(/^\/classroom-quest(?=\/)/, "");
  if (name.endsWith("/")) name += "index.html";
  return name;
}

/**
 * Serve one public file. `transformHtml` may change index.html (the room
 * server marks the page and allows it to reach its own API).
 */
export async function serveStatic(request, response, transformHtml) {
  try {
    const name = appPath(request.url);
    if (!PUBLIC.test(name)) {
      response.writeHead(404).end("Not found");
      return;
    }
    const file = path.join(root, name);
    let data = await fs.readFile(file);
    if (name === "/index.html" && transformHtml)
      data = transformHtml(data.toString("utf8"));
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
}
