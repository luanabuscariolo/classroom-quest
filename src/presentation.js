import { syncProjectionNodes } from "./presentation-dom.js";
/** Only sanitized game DOM reaches this window; no diary or workspace serialization. */
export function createPresentation(app) {
  const { $, element, selectStudent, clearSelection, closeOverlay } = app;
  let presentationWindow = null,
    presentationTimer = null,
    projectionSignature = "";
  const projectionAllowed = [
    "draw",
    "cancelDraw",
    "winnerPoint",
    "attention",
    "masterAttention",
    "attentionQuiet",
    "attentionNoisy",
    "attentionCancel",
    "lifeMinus",
    "lifePlus",
    "newLesson",
    "scoreMinus",
    "scorePlus",
    "scorePlusTwo",
    "clearStudent",
    "masterRally",
    "masterPortrait",
  ];
  function mirrorPresentation() {
    if (!presentationWindow || presentationWindow.closed) {
      clearInterval(presentationTimer);
      presentationTimer = null;
      return;
    }
    try {
      const doc = presentationWindow.document,
        host = doc.getElementById("projectionRoot");
      if (!host) return;
      if ($("gameMain").hidden) {
        if (projectionSignature !== "paused") {
          host.textContent = "TIC QUEST · À espera da próxima turma";
          projectionSignature = "paused";
        }
        return;
      }
      doc.body.classList.toggle(
        "silence-active",
        !$("attentionOverlay").hidden,
      );
      const nodes = [],
        game = presentationCopy($("gameMain"));
      game.hidden = false;
      game
        .querySelector(".topbar")
        .appendChild(element("strong", "pixel", app.state.className));
      nodes.push(game);
      ["drawOverlay", "winnerOverlay", "attentionOverlay", "lifeToast"].forEach(
        (id) => {
          const source = $(id);
          if (source && !source.hidden) nodes.push(presentationCopy(source));
        },
      );
      const signature = nodes.map((n) => n.outerHTML).join("");
      if (signature !== projectionSignature) {
        syncProjectionNodes(host, nodes);
        projectionSignature = signature;
      }
      if (!$("drawOverlay").hidden) {
        const canvas = host.querySelector("#nameWheel");
        if (canvas) canvas.getContext("2d").drawImage($("nameWheel"), 0, 0);
      }
    } catch (e) {
      clearInterval(presentationTimer);
      presentationTimer = null;
    }
  }
  function presentationCopy(source) {
    const clone = source.cloneNode(true);
    clone
      .querySelectorAll(
        "script,form,input,select,textarea,#ready,#status,#projectStatus,#bootWarning,.backup-strip,.topbar .actions,.arena-controls,.avatar-controls,#masterChange,#teamsOpen",
      )
      .forEach((el) => {
        el.remove();
      });
    clone.querySelectorAll("button").forEach((b) => {
      const allowed =
        projectionAllowed.includes(b.id) ||
        b.hasAttribute("data-seat") ||
        b.dataset.close === "winnerOverlay";
      if (!allowed) b.remove();
      else {
        b.style.pointerEvents = "auto";
        b.removeAttribute("onclick");
      }
    });
    clone.querySelectorAll("*").forEach((el) => {
      Array.from(el.attributes).forEach((a) => {
        if (a.name.startsWith("on")) el.removeAttribute(a.name);
      });
      el.removeAttribute("contenteditable");
    });
    return clone;
  }
  function openPresentation() {
    if (presentationWindow && !presentationWindow.closed) {
      presentationWindow.focus();
      return;
    }
    projectionSignature = "";
    presentationWindow = window.open(
      "",
      "_blank",
      "popup,width=1280,height=850",
    );
    if (!presentationWindow) {
      alert(
        "O navegador bloqueou a nova janela. Permite pop-ups para abrir a apresentação.",
      );
      return;
    }
    const doc = presentationWindow.document;
    doc.open();
    doc.write(
      '<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TIC Quest · Apresentação</title></head><body><div id="projectionRoot"></div></body></html>',
    );
    doc.close();
    document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
      const clone = link.cloneNode(true);
      clone.href = link.href;
      doc.head.appendChild(clone);
    });
    const css = doc.createElement("link");
    css.rel = "stylesheet";
    css.href = new URL("../assets/css/presentation.css", import.meta.url).href;
    doc.head.appendChild(css);
    presentationWindow.opener = null;
    mirrorPresentation();
    presentationTimer = setInterval(mirrorPresentation, 120);
    $("projectHelp").hidden = false;
    $("projectStatus").textContent =
      "Apresentação aberta. Move a nova janela para o projetor; mantém o diário no teu ecrã.";

    doc.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      if (b.hasAttribute("data-seat")) {
        const i = Number(b.dataset.seat);
        if (Number.isInteger(i) && app.state.students[i]) selectStudent(i);
      } else if (b.dataset.close === "winnerOverlay")
        closeOverlay("winnerOverlay");
      else if (projectionAllowed.includes(b.id)) {
        const target = $(b.id);
        if (target && !target.disabled) target.click();
      }
      mirrorPresentation();
    });
    doc.addEventListener("click", (e) => {
      if (!e.target.closest(".player,.character,.overlay,button")) {
        clearSelection();
        mirrorPresentation();
      }
    });

    presentationWindow.addEventListener("pagehide", app.onClose);
  }

  $("gameProject").onclick = openPresentation;
  $("diaryProject").onclick = openPresentation;
  window.addEventListener("pagehide", () => {
    if (presentationWindow && !presentationWindow.closed)
      presentationWindow.close();
  });
  return {
    open: openPresentation,
    mirror: mirrorPresentation,
    get window() {
      return presentationWindow;
    },
  };
}
