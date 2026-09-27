// "TIC Quest · Sala": runs on the teacher's PC during the lesson. The data
// lives in a file on the PC; the tablet (on the same network, e.g. the
// phone's hotspot) and the projector window both read and write it here.
//
//   node tools/room.js [--dados <pasta>] [--porta 4180] [--novo-codigo] [--abrir]
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { exec } from "node:child_process";
import { pathToFileURL } from "node:url";
import { appPath, serveStatic } from "./static.js";
import { validateWorkspace } from "../src/model.js";

export const ROOM_PORT = 4180;
const MAX_BODY = 20 * 1024 * 1024;
// Live events (roleta, "Atenção, turma!"): kept briefly, sent at once to the
// devices waiting for them (long polling).
const EVENT_MAX_BODY = 64 * 1024;
const EVENT_WAIT = 25000;
const EVENTS_KEPT = 50;
// A copy of the data at most every 10 minutes; the newest 100 are kept, plus
// the first copy of every day.
const COPY_EVERY = 10 * 60 * 1000;
const KEEP_COPIES = 100;
const COPY_NAME = /^dados_\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d\.json$/;

export function defaultDataDir() {
  const docs = path.join(os.homedir(), "Documents");
  return path.join(fs.existsSync(docs) ? docs : os.homedir(), "TIC Quest");
}

/** The page served by the room: marked as such and allowed to reach the API. */
export function roomHtml(html) {
  return html
    .replace("connect-src 'none'", "connect-src 'self'")
    .replace("<head>", '<head>\n    <meta name="tic-room" content="1" />');
}

/**
 * IPv4 addresses of this PC on real networks (for the tablet), Wi-Fi first.
 * Virtual adapters (VMware, Hyper-V/WSL, VPNs) and link-local addresses are
 * left out: the tablet could never reach them.
 */
export function lanAddresses(interfaces = os.networkInterfaces()) {
  const VIRTUAL =
    /vmware|virtualbox|vethernet|hyper-v|wsl|tailscale|zerotier|hamachi|loopback|bluetooth|docker/i;
  return Object.entries(interfaces)
    .filter(([name]) => !VIRTUAL.test(name))
    .sort(
      ([a], [b]) =>
        /wi-?fi|wlan|wireless/i.test(b) - /wi-?fi|wlan|wireless/i.test(a),
    )
    .flatMap(([, list]) => list || [])
    .filter(
      (a) =>
        a.family === "IPv4" && !a.internal && !a.address.startsWith("169.254."),
    )
    .map((a) => a.address);
}

const pad = (n) => String(n).padStart(2, "0");
function stamp(d) {
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "_" +
    pad(d.getHours()) +
    "-" +
    pad(d.getMinutes()) +
    "-" +
    pad(d.getSeconds())
  );
}
async function readJSON(file) {
  try {
    return JSON.parse(await fsp.readFile(file, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
/** Write to a temporary file first, so a power cut never leaves half a file. */
async function atomicWrite(file, text) {
  const tmp = file + ".tmp";
  await fsp.writeFile(tmp, text);
  await fsp.rename(tmp, file);
}
function isLocal(request) {
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
    request.socket.remoteAddress,
  );
}
function send(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(typeof body === "string" ? body : JSON.stringify(body));
}
function readBody(request, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Error("Dados demasiado grandes."));
        request.destroy();
      } else chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

/**
 * The room: its data folder, access code and HTTP server. `trustLocal` lets
 * this PC (the projector window) in without the code.
 */
export async function createRoom({
  dataDir = defaultDataDir(),
  trustLocal = true,
  newCode = false,
  log = () => {},
} = {}) {
  const copies = path.join(dataDir, "copias"),
    dataFile = path.join(dataDir, "dados.json"),
    roomFile = path.join(dataDir, "sala.json");
  await fsp.mkdir(copies, { recursive: true });

  // Access code and devices already paired (kept between lessons).
  let room = (await readJSON(roomFile)) || {};
  if (newCode || !/^\d{6}$/.test(room.code))
    room = {
      code: String(crypto.randomInt(0, 1000000)).padStart(6, "0"),
      tokens: [],
      version: room.version || 0,
    };
  if (!Array.isArray(room.tokens)) room.tokens = [];

  // Current data. A damaged file is never overwritten: the copies are there.
  let data = null;
  try {
    data = await fsp.readFile(dataFile, "utf8");
    validateWorkspace(JSON.parse(data));
  } catch (e) {
    if (e.code !== "ENOENT")
      throw Error(
        "O ficheiro " +
          dataFile +
          " está danificado (" +
          e.message +
          "). Substitua-o por uma cópia da pasta " +
          copies +
          ".",
        { cause: e },
      );
    data = null;
  }
  let version = data ? Math.max(1, room.version || 0) : 0,
    lastCopy = 0,
    writes = Promise.resolve(),
    eventSeq = 0;
  const failures = [],
    events = [],
    waiting = new Set();

  /** Events after `after`, with their age so late ones can be ignored. */
  function eventsAfter(after) {
    const now = Date.now();
    return JSON.stringify({
      seq: eventSeq,
      events: events
        .filter((e) => e.seq > after)
        .map((e) => ({ ...e.body, seq: e.seq, age: now - e.at })),
    });
  }
  async function postEvent(request, response) {
    let body;
    try {
      body = JSON.parse(await readBody(request, EVENT_MAX_BODY));
    } catch {
      return send(response, 400, { error: "Pedido inválido." });
    }
    if (!body || typeof body.type !== "string")
      return send(response, 400, { error: "Pedido inválido." });
    events.push({ seq: ++eventSeq, at: Date.now(), body });
    if (events.length > EVENTS_KEPT) events.shift();
    for (const wake of [...waiting]) wake();
    send(response, 200, { seq: eventSeq });
  }
  function getEvents(request, response) {
    const after = new URL(request.url, "http://x").searchParams.get("after");
    // First call: start from now, never replay old events.
    if (after === null || events.every((e) => e.seq <= Number(after))) {
      if (after === null) return send(response, 200, eventsAfter(eventSeq));
      const wake = () => {
        clearTimeout(timer);
        waiting.delete(wake);
        send(response, 200, eventsAfter(Number(after)));
      };
      const timer = setTimeout(wake, EVENT_WAIT);
      waiting.add(wake);
      response.on("close", () => {
        clearTimeout(timer);
        waiting.delete(wake);
      });
      return;
    }
    send(response, 200, eventsAfter(Number(after)));
  }

  async function saveRoom() {
    await atomicWrite(roomFile, JSON.stringify(room, null, 2));
  }
  async function keepCopy(text) {
    const now = Date.now();
    if (now - lastCopy < COPY_EVERY) return;
    lastCopy = now;
    await fsp.writeFile(
      path.join(copies, "dados_" + stamp(new Date()) + ".json"),
      text,
    );
    const names = (await fsp.readdir(copies))
        .filter((n) => COPY_NAME.test(n))
        .sort(),
      keep = new Set(names.slice(-KEEP_COPIES)),
      days = new Set();
    for (const n of names) {
      const day = n.slice(6, 16);
      if (!days.has(day)) {
        days.add(day);
        keep.add(n);
      }
    }
    for (const n of names)
      if (!keep.has(n)) await fsp.unlink(path.join(copies, n));
  }

  function authorized(request) {
    if (trustLocal && isLocal(request)) return true;
    const token = request.headers["x-room-token"];
    return typeof token === "string" && room.tokens.includes(token);
  }

  async function login(request, response) {
    const now = Date.now();
    while (failures.length && now - failures[0] > 60000) failures.shift();
    if (failures.length >= 5)
      return send(response, 429, {
        error: "Demasiadas tentativas. Espere um minuto.",
      });
    let code = "";
    try {
      code = String(JSON.parse(await readBody(request)).code || "");
    } catch {
      // Treated as a wrong code below.
    }
    const ok =
      code.length === 6 &&
      crypto.timingSafeEqual(Buffer.from(code), Buffer.from(room.code));
    if (!ok) {
      failures.push(now);
      return send(response, 401, { error: "Código errado." });
    }
    const token = crypto.randomBytes(24).toString("hex");
    room.tokens = [...room.tokens, token].slice(-20);
    await saveRoom();
    log("Novo aparelho ligado à sala.");
    send(response, 200, { token });
  }

  async function put(request, response) {
    let body;
    try {
      body = JSON.parse(await readBody(request));
    } catch {
      return send(response, 400, { error: "Pedido inválido." });
    }
    if (body.base !== version)
      // Someone else saved first: send the current data back.
      return send(
        response,
        409,
        '{"version":' + version + ',"data":' + (data ?? "null") + "}",
      );
    try {
      validateWorkspace(body.data);
    } catch (e) {
      return send(response, 400, { error: e.message });
    }
    const text = JSON.stringify(body.data);
    data = text;
    version++;
    room.version = version;
    send(response, 200, { version });
    writes = writes
      .then(() => atomicWrite(dataFile, text))
      .then(saveRoom)
      .then(() => keepCopy(text))
      .catch((e) => log("⚠ ERRO AO GRAVAR NO DISCO: " + e.message));
  }

  async function handle(request, response) {
    const name = appPath(request.url);
    if (!name.startsWith("/api/"))
      return serveStatic(request, response, roomHtml);
    const route = request.method + " " + name;
    if (route === "POST /api/login") return login(request, response);
    if (!authorized(request))
      return send(response, 401, { error: "Falta o código da sala." });
    if (route === "GET /api/workspace") {
      const since = new URL(request.url, "http://x").searchParams.get("since");
      if (since !== null && Number(since) === version)
        return response.writeHead(204, { "Cache-Control": "no-store" }).end();
      return send(
        response,
        200,
        '{"version":' + version + ',"data":' + (data ?? "null") + "}",
      );
    }
    if (route === "PUT /api/workspace") return put(request, response);
    if (route === "POST /api/events") return postEvent(request, response);
    if (route === "GET /api/events") return getEvents(request, response);
    // Shown on this PC only, to pair the tablet.
    if (route === "GET /api/info" && isLocal(request))
      return send(response, 200, {
        code: room.code,
        addresses: lanAddresses(),
        port: server.address()?.port,
      });
    send(response, 404, { error: "Não encontrado." });
  }

  const server = http.createServer((request, response) => {
    handle(request, response).catch((e) => {
      log("Erro: " + e.message);
      if (!response.headersSent) send(response, 500, { error: "Erro." });
    });
  });
  await saveRoom();
  return {
    server,
    dataDir,
    get code() {
      return room.code;
    },
    get version() {
      return version;
    },
    /** Wait until the data is on the disk (tests, shutdown). */
    flush: () => writes,
  };
}

// ── Command line ─────────────────────────────────────────────────────────────
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2),
    option = (name) => {
      const i = args.indexOf(name);
      return i >= 0 ? args[i + 1] : undefined;
    };
  const port = Number(option("--porta") || process.env.PORT || ROOM_PORT);
  try {
    const room = await createRoom({
      dataDir: option("--dados") || defaultDataDir(),
      newCode: args.includes("--novo-codigo"),
      log: (m) => console.log(new Date().toLocaleTimeString("pt-PT"), m),
    });
    room.server.listen(port, "0.0.0.0", () => {
      const local = "http://localhost:" + port;
      console.log(
        [
          "",
          "  TIC Quest · Sala",
          "  ─────────────────────────────────────────────",
          "  Dados guardados em: " + room.dataDir,
          "",
          "  No PC (apresentação):   " + local,
          ...lanAddresses().map(
            (a) => "  No tablet (mesma rede): http://" + a + ":" + port,
          ),
          "  Código da sala:         " + room.code,
          "",
          "  Deixe esta janela aberta durante a aula.",
          "  Para terminar, feche-a (os dados já estão gravados).",
          "",
        ].join("\n"),
      );
      if (args.includes("--abrir") && process.platform === "win32")
        exec('start "" "' + local + '"');
    });
    room.server.on("error", (e) => {
      console.error(
        e.code === "EADDRINUSE"
          ? "A porta " + port + " já está em uso: a sala já está aberta?"
          : e.message,
      );
      process.exit(1);
    });
  } catch (e) {
    console.error("Não foi possível abrir a sala: " + e.message);
    process.exit(1);
  }
}
