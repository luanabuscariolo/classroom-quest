import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { JSDOM } from "jsdom";
import { createRoom, lanAddresses, roomHtml } from "../tools/room.js";
import { emptyWorkspace, validateWorkspace } from "../src/model.js";

// App timers (status messages, the room's polling) must not outlive the test.
const timers = new Set(),
  realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (...args) => {
  const timer = realSetTimeout(...args);
  timers.add(timer);
  return timer;
};

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "tic-sala-"));
async function open(options) {
  const room = await createRoom(options);
  await new Promise((resolve) => room.server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + room.server.address().port + "/";
  return { room, base };
}
async function shut(room) {
  await room.flush();
  room.server.closeAllConnections();
  await new Promise((resolve) => room.server.close(resolve));
}
const json = (body) => JSON.stringify(body);
const until = async (check, ms = 5000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw Error("Timed out");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

test("the room page is marked and may reach only its own server", () => {
  const html = roomHtml(fs.readFileSync("index.html", "utf8"));
  assert.match(html, /<meta name="tic-room" content="1" \/>/);
  assert.match(html, /connect-src 'self'/);
  assert.doesNotMatch(html, /connect-src 'none'/);
});

test("room server: code, saving to a file, conflicts and copies", async () => {
  const dataDir = tempDir();
  let { room, base } = await open({ dataDir, trustLocal: false });
  try {
    const page = await fetch(base);
    assert.match(await page.text(), /tic-room/);
    // Without the code nothing is readable.
    assert.equal((await fetch(base + "api/workspace")).status, 401);
    const login = (code) =>
      fetch(base + "api/login", { method: "POST", body: json({ code }) });
    assert.equal((await login("000000x")).status, 401);
    const { token } = await (await login(room.code)).json();
    const headers = { "X-Room-Token": token };
    const get = (q = "") => fetch(base + "api/workspace" + q, { headers });
    const put = (body) =>
      fetch(base + "api/workspace", { method: "PUT", headers, body });

    assert.deepEqual(await (await get()).json(), { version: 0, data: null });
    const w = emptyWorkspace();
    w.revision = 3;
    let r = await put(json({ base: 0, data: w }));
    assert.deepEqual(await r.json(), { version: 1 });
    // Saved on the PC as a workspace file (it can be imported as a backup).
    await room.flush();
    const saved = JSON.parse(
      fs.readFileSync(path.join(dataDir, "dados.json"), "utf8"),
    );
    assert.equal(validateWorkspace(saved).revision, 3);
    assert.equal(fs.readdirSync(path.join(dataDir, "copias")).length, 1);
    // Unchanged since version 1: nothing to send.
    assert.equal((await get("?since=1")).status, 204);
    // Another device saving from an old version gets the current data back.
    r = await put(json({ base: 0, data: w }));
    assert.equal(r.status, 409);
    assert.equal((await r.json()).data.revision, 3);
    // Invalid data is refused and the file is untouched.
    r = await put(json({ base: 1, data: { format: "outra coisa" } }));
    assert.equal(r.status, 400);
    assert.equal(room.version, 1);
    // Five wrong codes in a minute: wait.
    for (let i = 0; i < 5; i++) await login("111111");
    assert.equal((await login(room.code)).status, 429);

    // Live events: a device waiting for them gets each one at once.
    const events = (q = "") => fetch(base + "api/events" + q, { headers });
    const { seq } = await (await events()).json();
    const waiting = events("?after=" + seq);
    await fetch(base + "api/events", {
      method: "POST",
      headers,
      body: json({ type: "attention-start", from: "tablet" }),
    });
    const got = await (await waiting).json();
    assert.equal(got.events.length, 1);
    assert.equal(got.events[0].type, "attention-start");
    assert.ok(got.events[0].age < 1000);

    // Next lesson: same code, same paired tablet, same data.
    const code = room.code;
    await shut(room);
    ({ room, base } = await open({ dataDir, trustLocal: false }));
    assert.equal(room.code, code);
    const again = await fetch(base + "api/workspace", { headers });
    assert.equal((await again.json()).version, 1);
  } finally {
    await shut(room);
  }
});

test("a damaged data file is never overwritten", async () => {
  const dataDir = tempDir();
  fs.writeFileSync(path.join(dataDir, "dados.json"), "{ meio ficheiro");
  await assert.rejects(createRoom({ dataDir }), /danificado/);
  assert.equal(
    fs.readFileSync(path.join(dataDir, "dados.json"), "utf8"),
    "{ meio ficheiro",
  );
});

test("the app in room mode saves to the PC and shows changes from the tablet", async () => {
  const dataDir = tempDir();
  const { room, base } = await open({ dataDir });
  const html = roomHtml(fs.readFileSync("index.html", "utf8"));
  const dom = new JSDOM(html, { url: base, pretendToBeVisual: true });
  const w = dom.window;
  for (const key of ["window", "document", "localStorage", "Event", "location"])
    globalThis[key] = key === "window" ? w : w[key];
  globalThis.confirm = () => true;
  globalThis.alert = (m) => assert.fail("Unexpected alert: " + m);
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.matchMedia = () => ({ matches: true });
  w.HTMLCanvasElement.prototype.getContext = () =>
    new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true });
  const $ = (id) => w.document.getElementById(id);
  try {
    await import("../src/app.js?room-test=1");
    // This PC (localhost) needs no code; the status shows the room is open.
    assert.equal($("roomOverlay").hidden, true);
    assert.match($("roomStatus").textContent, /Sala aberta/);

    const input = (id, value) => {
      $(id).value = value;
      $(id).dispatchEvent(new w.Event("input", { bubbles: true }));
    };
    const submit = (id) =>
      $(id).dispatchEvent(
        new w.Event("submit", { bubbles: true, cancelable: true }),
      );
    input("teacherName", "Professora Sala");
    submit("teacherForm");
    $("createClass").click();
    input("setupName", "5ºX");
    input("setupNames", "Ana\nBruno");
    submit("setupForm");
    $("applyNames").click();
    w.document.querySelector('[data-seat="0"]').click();
    $("scorePlusFive").click();

    // Saved in Documentos\TIC Quest\dados.json on the PC.
    await until(() => {
      try {
        const d = JSON.parse(
          fs.readFileSync(path.join(dataDir, "dados.json"), "utf8"),
        );
        return d.classes[0]?.students[0].points === 5;
      } catch {
        return false;
      }
    });
    // Nothing in this browser's own storage: the data is on the PC.
    assert.equal(w.localStorage.getItem("tic-quest.workspace.v8"), null);

    // The tablet gives +10 to Bruno: the projector shows it by itself.
    const current = await (await fetch(base + "api/workspace")).json();
    current.data.classes[0].students[1].points = 10;
    current.data.revision++;
    const r = await fetch(base + "api/workspace", {
      method: "PUT",
      body: json({ base: current.version, data: current.data }),
    });
    assert.equal(r.status, 200);
    await until(() =>
      /★ 10/.test(w.document.querySelector('[data-seat="1"]').textContent),
    );

    // Live events from the tablet: the projector spins the same roleta…
    const event = (body) =>
      fetch(base + "api/events", {
        method: "POST",
        body: json({ from: "tablet", ...body }),
      });
    const classId = current.data.classes[0].id;
    await event({ type: "raffle-start", classId, choices: [0, 1], winner: 1 });
    await until(() => !$("winnerOverlay").hidden);
    assert.equal($("winnerName").textContent, "Bruno");
    await event({ type: "winner-point" });
    await until(() => $("winnerPoint").disabled);
    await event({ type: "winner-close" });
    await until(() => $("winnerOverlay").hidden);
    // …and the "Atenção, turma!" countdown with its result.
    await event({ type: "attention-start" });
    await until(() => !$("attentionOverlay").hidden);
    await event({ type: "attention-noisy", before: 5, after: 4 });
    await until(() => /5 → 4/.test($("attentionResult").textContent));
    await event({ type: "attention-close" });
    await until(() => $("attentionOverlay").hidden);
    // A roleta started here is shared with the other devices.
    const { seq } = await (await fetch(base + "api/events")).json();
    $("draw").click();
    const shared = await (await fetch(base + "api/events?after=" + seq)).json();
    assert.equal(shared.events[0].type, "raffle-start");
    assert.equal(shared.events[0].classId, classId);
  } finally {
    for (const timer of timers) clearTimeout(timer);
    w.close();
    await shut(room);
  }
});

test("the tablet is shown only addresses it can reach, Wi-Fi first", () => {
  const ip = (address) => [{ family: "IPv4", internal: false, address }];
  assert.deepEqual(
    lanAddresses({
      Tailscale: ip("169.254.83.107"),
      Ethernet: ip("10.0.0.5"),
      "Wi-Fi": ip("192.168.43.20"),
      "VMware Network Adapter VMnet1": ip("192.168.9.1"),
      "vEthernet (Default Switch)": ip("172.28.176.1"),
      "Loopback Pseudo-Interface 1": [
        { family: "IPv4", internal: true, address: "127.0.0.1" },
      ],
    }),
    ["192.168.43.20", "10.0.0.5"],
  );
});
