import { packageBackup } from "./backup.js";
import { downloadBlob } from "./dom.js";
import { PREVIOUS, STORE } from "./storage.js";
import { stamp } from "./utils.js";

export const ROOM_TOKEN = "tic-quest.room.token";
// Changes not yet sent to the PC (network lost), kept on this device.
export const ROOM_PENDING = "tic-quest.room.pending";
const POLL_MS = 1500;
const RETRY_MS = 3000;
// A live event older than this (network was down) is not shown any more.
const EVENT_MAX_AGE = 5000;

/** Room mode: the page was served by "TIC Quest · Sala" on the teacher's PC. */
export const isRoom = (doc = document) =>
  !!doc.querySelector('meta[name="tic-room"]');

// The class open on each device is its own business: changing only it is not
// sent to the other devices.
const withoutActiveClass = (text) =>
  text &&
  text.replace(/"activeClassId":(null|"(?:[^"\\]|\\.)*")/, '"activeClassId":0');

/**
 * Connect to the room: log in with the room code if needed, load the data
 * from the PC and keep both sides up to date. Returns a Storage-like object
 * for persistence.js: the workspace is kept in memory and sent to the PC;
 * every other key (theme, token) stays in this browser.
 *
 * - `canApply()`: false while this device is in the middle of something
 *   (an open window), so changes from the PC wait.
 * - `onRemoteChange()`: the data changed on another device.
 * - `onEvent(event)`: a live event from another device (roleta, "Atenção,
 *   turma!"), sent with `send(type, details)`.
 */
export async function connectRoom({ $, canApply, onRemoteChange, onEvent }) {
  const local = window.localStorage,
    isHost = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const read = (key) => {
    try {
      return local.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key, value) => {
    try {
      if (value === null) local.removeItem(key);
      else local.setItem(key, value);
    } catch {
      // Storage blocked: only the offline safety copy is lost.
    }
  };
  let token = read(ROOM_TOKEN),
    version = 0,
    cache = null, // workspace as this device has it (JSON text)
    synced = null, // workspace as the PC has it
    previous = null,
    sending = false,
    online = true,
    rejected = null,
    rejectReason = "",
    info = null;

  async function api(method, path, body) {
    const headers = {};
    if (token) headers["X-Room-Token"] = token;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    return fetch(new URL("api/" + path, location.href), {
      method,
      headers,
      body,
      cache: "no-store",
    });
  }
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // ── Status pill (bottom corner; never shown on the projector) ───────────
  // The page is still open (the loops stop when it closes).
  const alive = () => !!$("roomStatus");
  function showStatus(text, kind) {
    const pill = $("roomStatus");
    if (!pill) return;
    pill.hidden = false;
    pill.className = "room-status " + kind;
    pill.textContent = text;
  }
  function renderStatus() {
    if (!online)
      showStatus(
        "⚠ Sem ligação ao PC · as alterações ficam neste aparelho e são enviadas quando voltar",
        "offline",
      );
    else if (rejected)
      showStatus("⚠ O PC recusou os últimos dados: " + rejectReason, "offline");
    else if (isHost && info) {
      showStatus("🔗 Sala aberta · ligar o tablet", "online");
      const pill = $("roomStatus");
      if (!pill) return;
      pill.title = "Mostrar o endereço e o código para o tablet";
      pill.onclick = () =>
        alert(
          "No tablet (ligado à mesma rede, por exemplo o hotspot do telemóvel), abra:\n\n" +
            info.addresses
              .map((a) => "http://" + a + ":" + info.port)
              .join("\nou ") +
            "\n\nCódigo da sala: " +
            info.code,
        );
    } else showStatus("🔗 Ligado ao PC da sala", "online");
  }
  function setOnline(flag) {
    if (online === flag) return;
    online = flag;
    renderStatus();
  }

  // ── Login with the room code ───────────────────────────────────────────
  function askCode() {
    return new Promise((resolve) => {
      $("roomOverlay").hidden = false;
      $("roomError").textContent = "";
      $("roomCode").value = "";
      $("roomCode").focus();
      $("roomForm").onsubmit = async (e) => {
        e.preventDefault();
        try {
          const r = await api(
            "POST",
            "login",
            JSON.stringify({ code: $("roomCode").value.trim() }),
          );
          const body = await r.json().catch(() => ({}));
          if (!r.ok) {
            $("roomError").textContent =
              body.error || "Não foi possível ligar.";
            return;
          }
          token = body.token;
          write(ROOM_TOKEN, token);
          $("roomOverlay").hidden = true;
          resolve();
        } catch {
          $("roomError").textContent =
            "Sem ligação ao PC. Confirme que a sala está aberta e que o tablet está na mesma rede.";
        }
      };
    });
  }

  /** Keep a copy of data that could not reach the PC, as a backup file. */
  function saveAside(text, prefix) {
    try {
      downloadBlob(
        new Blob([JSON.stringify(packageBackup(JSON.parse(text)), null, 2)], {
          type: "application/json",
        }),
        prefix + stamp() + ".json",
      );
    } catch {
      // Unreadable copy: nothing more can be done with it.
    }
  }

  // ── Sending and receiving ──────────────────────────────────────────────
  async function push() {
    if (sending || cache === synced || cache === null || cache === rejected)
      return;
    sending = true;
    const sent = cache;
    try {
      const r = await api(
        "PUT",
        "workspace",
        '{"base":' + version + ',"data":' + sent + "}",
      );
      if (r.status === 200) {
        version = (await r.json()).version;
        synced = sent;
        if (rejected) {
          rejected = null;
          renderStatus();
        }
        write(ROOM_PENDING, null);
        setOnline(true);
      } else if (r.status === 409) {
        // Another device saved first: its data wins, ours is kept as a file.
        const server = await r.json();
        saveAside(sent, "TIC_NAO_ENVIADO_");
        version = server.version;
        cache = synced = server.data ? JSON.stringify(server.data) : null;
        write(ROOM_PENDING, null);
        alert(
          "Outro aparelho alterou os dados ao mesmo tempo. Foram abertos os dados do PC; " +
            "o que não chegou a ser enviado foi descarregado como ficheiro (TIC_NAO_ENVIADO…).",
        );
        onRemoteChange();
      } else if (r.status === 401) {
        await askCode();
      } else {
        // Invalid data: not sent again until it changes.
        const body = await r.json().catch(() => ({}));
        rejected = sent;
        rejectReason = body.error || "erro " + r.status;
        renderStatus();
      }
    } catch {
      write(ROOM_PENDING, JSON.stringify({ base: version, data: cache }));
      setOnline(false);
    } finally {
      sending = false;
    }
    if (alive() && online && cache !== synced && cache !== rejected)
      setTimeout(push, 0);
  }

  async function poll() {
    try {
      if (cache !== synced) await push();
      else if (canApply()) {
        const r = await api("GET", "workspace?since=" + version);
        if (r.status === 200) {
          const server = await r.json();
          if (cache === synced && !sending) {
            version = server.version;
            cache = synced = server.data ? JSON.stringify(server.data) : null;
            onRemoteChange();
          }
        } else if (r.status === 401) await askCode();
        setOnline(true);
      }
    } catch {
      setOnline(false);
    }
    if (alive()) setTimeout(poll, online ? POLL_MS : RETRY_MS);
  }

  // ── First connection ───────────────────────────────────────────────────
  showStatus("A ligar ao PC da sala…", "online");
  let first;
  for (;;) {
    try {
      const r = await api("GET", "workspace");
      if (r.status === 401) {
        await askCode();
        continue;
      }
      if (!r.ok) throw Error();
      first = await r.json();
      break;
    } catch {
      showStatus(
        "⚠ Sem ligação ao PC da sala. A tentar de novo… Confirme que a sala está aberta no PC.",
        "offline",
      );
      await sleep(RETRY_MS);
    }
  }
  version = first.version;
  synced = first.data ? JSON.stringify(first.data) : null;
  cache = synced;

  // Changes made here while the PC could not be reached.
  let pending;
  try {
    pending = JSON.parse(read(ROOM_PENDING));
  } catch {
    pending = null;
  }
  if (pending && typeof pending.data === "string") {
    if (pending.base === version) cache = pending.data;
    else saveAside(pending.data, "TIC_NAO_ENVIADO_");
    write(ROOM_PENDING, null);
  }
  // First lesson with the room: offer the classes already on this device.
  const here = read(STORE);
  if (
    first.data === null &&
    cache === null &&
    here &&
    /"className"/.test(here) &&
    confirm(
      "O PC da sala ainda não tem dados. Enviar para o PC as turmas guardadas neste aparelho?",
    )
  )
    cache = here;

  if (isHost)
    try {
      info = await (await api("GET", "info")).json();
    } catch {
      info = null;
    }
  renderStatus();
  setTimeout(poll, cache !== synced ? 0 : POLL_MS);

  // ── Live events ────────────────────────────────────────────────────────
  // The PC answers as soon as there is an event (or after 25 s with none),
  // so the projector shows the roleta at the same time as the tablet.
  const me = Math.random().toString(36).slice(2);
  let eventSeq = null;
  async function listen() {
    try {
      const r = await api(
        "GET",
        "events" + (eventSeq === null ? "" : "?after=" + eventSeq),
      );
      if (!r.ok) throw Error();
      const body = await r.json();
      eventSeq = body.seq;
      for (const e of body.events)
        if (e.from !== me && e.age < EVENT_MAX_AGE) onEvent(e);
    } catch {
      await sleep(RETRY_MS);
    }
    if (alive()) setTimeout(listen, 0);
  }
  listen();
  function send(type, details = {}) {
    api("POST", "events", JSON.stringify({ ...details, type, from: me })).catch(
      () => {
        // Without a connection the projector just misses this animation.
      },
    );
  }

  return {
    isHost,
    send,
    storage: {
      getItem(key) {
        if (key === STORE) return cache;
        if (key === PREVIOUS) return previous;
        return read(key);
      },
      setItem(key, value) {
        if (key === PREVIOUS) {
          previous = value;
          return;
        }
        if (key !== STORE) return write(key, value);
        // Opening another class here is not a change for the other devices.
        const onlyClassChanged =
          cache === synced &&
          withoutActiveClass(value) === withoutActiveClass(synced);
        cache = value;
        if (onlyClassChanged) synced = value;
        else if (!online)
          write(ROOM_PENDING, JSON.stringify({ base: version, data: cache }));
        else push();
      },
      removeItem(key) {
        if (key === STORE) cache = null;
        else if (key === PREVIOUS) previous = null;
        else write(key, null);
      },
    },
  };
}
