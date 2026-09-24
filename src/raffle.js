import { avatarFor, sprite } from "./avatars.js";
import { pad } from "./utils.js";

const WHEEL_SIZE = 900,
  WHEEL_RADIUS = 432,
  WHEEL_COLORS = [
    "#ffd269",
    "#ae91ec",
    "#70dec5",
    "#ff9aa9",
    "#8dbff3",
    "#efaf71",
  ];

/**
 * Name wheel for the students marked "no sorteio". While the presentation
 * window is open, it drives the animation timer so the wheel keeps turning
 * when the main window is minimised.
 */
export function createRaffle(app) {
  const {
    $,
    playSound,
    openOverlay,
    selectStudent,
    addPoints,
    pool,
    rankById,
    presentation,
    reducedMotion,
    replay,
    status,
  } = app;
  let rolling = false,
    lastWinner = -1,
    drawTimer = null,
    wheelFrame = null,
    wheelTimerWindow = window,
    wheelNextCallback = null,
    lastWheelMirror = 0;

  function presentationOpen() {
    return presentation.window && !presentation.window.closed;
  }
  function clearHighlights() {
    app.cards.forEach((c) => {
      c.card.classList.remove("flash", "winner");
    });
  }
  function confetti() {
    const holder = $("confetti");
    holder.textContent = "";
    if (reducedMotion()) return;
    ["#ffd354", "#70f2be", "#ff78b0", "#8fceff"].forEach((color, k) => {
      for (let j = 0; j < 7; j++) {
        const bit = document.createElement("i");
        bit.style.left = Math.random() * 100 + "%";
        bit.style.background = color;
        bit.style.animationDelay = Math.random() * 0.45 + "s";
        bit.style.transform = "rotate(" + k * 40 + "deg)";
        holder.appendChild(bit);
      }
    });
    setTimeout(() => {
      holder.textContent = "";
    }, 2700);
  }
  function cancelWheelFrame() {
    wheelTimerWindow.clearTimeout(wheelFrame);
    wheelNextCallback = null;
  }
  function scheduleWheelFrame(callback) {
    wheelNextCallback = callback;
    wheelTimerWindow = presentationOpen() ? presentation.window : window;
    return wheelTimerWindow.setTimeout(() => {
      if (!rolling) return;
      callback(Date.now());
      if (presentationOpen()) {
        if (Date.now() - lastWheelMirror > 60) {
          presentation.mirror();
          lastWheelMirror = Date.now();
        }
        const dest = presentation.window.document.getElementById("nameWheel");
        if (dest) dest.getContext("2d").drawImage($("nameWheel"), 0, 0);
      }
    }, 16);
  }
  /** The presentation closed mid-spin: continue on the main window's timer. */
  function onPresentationClose() {
    if (rolling && wheelNextCallback) {
      const callback = wheelNextCallback;
      cancelWheelFrame();
      wheelTimerWindow = window;
      wheelFrame = window.setTimeout(() => {
        if (rolling) wheelFrame = scheduleWheelFrame(callback);
      }, 50);
    }
  }
  function cancel() {
    if (wheelFrame) cancelWheelFrame();
    wheelFrame = null;
    if (drawTimer) clearTimeout(drawTimer);
    drawTimer = null;
    rolling = false;
    clearHighlights();
    $("drawOverlay").hidden = true;
    $("draw").disabled = false;
    $("draw").textContent = "🎲 SORTEAR";
    $("drawOutput").textContent = "Cancelado";
    $("draw").focus();
  }
  /** Leaving the class: stop any spin and forget the last winner. */
  function stop() {
    if (rolling) cancel();
    lastWinner = -1;
    clearHighlights();
  }
  function paintWheel(choices, rotation, highlight) {
    const students = app.state.students,
      canvas = $("nameWheel"),
      ctx = canvas.getContext("2d"),
      center = WHEEL_SIZE / 2,
      radius = WHEEL_RADIUS,
      arc = (Math.PI * 2) / choices.length;
    if (canvas.width !== WHEEL_SIZE) {
      canvas.width = WHEEL_SIZE;
      canvas.height = WHEEL_SIZE;
    }
    ctx.clearRect(0, 0, WHEEL_SIZE, WHEEL_SIZE);
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(rotation);
    for (let i = 0; i < choices.length; i++) {
      const start = -Math.PI / 2 + i * arc,
        end = start + arc,
        mid = start + arc / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = "#39234e";
      ctx.lineWidth = 3;
      ctx.stroke();
      if (highlight === i) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = "#fff6be66";
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
        ctx.restore();
      }
      ctx.save();
      ctx.rotate(mid);
      ctx.beginPath();
      ctx.rect(95, -radius, 330, radius * 2);
      ctx.clip();
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#211331";
      ctx.font =
        "800 " +
        (choices.length > 24 ? 28 : choices.length > 14 ? 30 : 34) +
        "px system-ui";
      // Shorten long names with an ellipsis so they fit in the segment.
      const full = students[choices[i]].name;
      let name = full;
      while (ctx.measureText(name).width > 250 && name.length > 1)
        name = name.slice(0, -1);
      if (name !== full) name = name.slice(0, -1) + "…";
      ctx.fillText(name, 410, 0);
      ctx.restore();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffedb0";
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(center, center, radius + 10, 0, Math.PI * 2);
    ctx.strokeStyle = "#a47ac4";
    ctx.lineWidth = 6;
    ctx.stroke();
    canvas.dataset.segments = choices.length;
  }
  function draw() {
    if (rolling) return;
    const students = app.state.students,
      choices = pool();
    if (!choices.length) {
      $("drawOutput").textContent =
        "Marca pelo menos um jogador para o sorteio.";
      status("Usa as caixas «NO SORTEIO» ou clica em «✓ Todos».");
      return;
    }
    rolling = true;
    $("draw").disabled = true;
    $("draw").textContent = "A SORTEAR…";
    $("drawOutput").textContent = "A roleta está a girar…";
    clearHighlights();
    // The winner is chosen first; the wheel then eases out onto that segment.
    const finalIndex = Math.floor(Math.random() * choices.length),
      finalChoice = choices[finalIndex],
      tau = Math.PI * 2,
      arc = tau / choices.length,
      target = tau * 8 + (tau - (finalIndex + 0.5) * arc),
      duration = reducedMotion() ? 600 : 8500;
    let started = null,
      previous = -1,
      lastTick = 0;
    playSound("start");
    $("drawLabel").textContent = "✦ ROLETA DA TURMA ✦";
    $("drawProgressFill").style.width = "0%";
    $("drawProgress").setAttribute("aria-valuenow", "0");
    $("drawNote").textContent = choices.length + " jogadores";
    $("nameWheel").setAttribute(
      "aria-label",
      "Roleta com " + choices.map((i) => students[i].name).join(", "),
    );
    openOverlay("drawOverlay", "cancelDraw");
    function finish() {
      drawTimer = null;
      clearHighlights();
      lastWinner = finalChoice;
      selectStudent(lastWinner);
      app.cards[lastWinner].card.classList.add("winner");
      $("drawOutput").textContent =
        "★ " + students[lastWinner].name + " · Posição " + rankById[lastWinner];
      sprite($("winnerAvatar"), avatarFor(students[lastWinner], lastWinner));
      $("winnerName").textContent = students[lastWinner].name;
      $("winnerSeat").textContent = "POSIÇÃO " + pad(rankById[lastWinner]);
      $("winnerPoint").disabled = false;
      $("winnerPoint").textContent = "★ Dar +1 ponto";
      $("draw").disabled = false;
      $("draw").textContent = "🎲 SORTEAR";
      rolling = false;
      $("drawOverlay").hidden = true;
      openOverlay("winnerOverlay", "winnerPoint");
      app.setReturnFocus($("draw"));
      playSound("win");
      confetti();
    }
    function frame(time) {
      if (!rolling) return;
      if (started === null) started = time;
      const progress = Math.min(1, (time - started) / duration),
        rotation = reducedMotion()
          ? target
          : target * (1 - Math.pow(1 - progress, 3)),
        relative = ((-rotation % tau) + tau) % tau;
      let index = Math.min(choices.length - 1, Math.floor(relative / arc));
      if (progress === 1) index = finalIndex;
      paintWheel(choices, rotation, progress === 1 ? finalIndex : -1);
      $("nameWheel").dataset.pointerIndex = index;
      $("drawName").textContent = students[choices[index]].name;
      $("drawSeat").textContent = "POSIÇÃO " + pad(rankById[choices[index]]);
      if (index !== previous) {
        clearHighlights();
        app.cards[choices[index]].card.classList.add("flash");
        if (!reducedMotion() && time - lastTick > 55) {
          playSound("tick");
          replay($("wheelPointer"), "wheel-tick");
          lastTick = time;
        }
        previous = index;
      }
      $("drawProgressFill").style.width = Math.round(progress * 100) + "%";
      $("drawProgress").setAttribute(
        "aria-valuenow",
        Math.round(progress * 100),
      );
      if (progress > 0.7) $("drawNote").textContent = "A roleta está a parar…";
      if (progress < 1) {
        wheelFrame = scheduleWheelFrame(frame);
      } else {
        wheelFrame = null;
        $("drawNote").textContent = "★ " + students[finalChoice].name + "!";
        drawTimer = setTimeout(finish, reducedMotion() ? 150 : 1400);
      }
    }
    wheelFrame = scheduleWheelFrame(frame);
  }

  $("draw").onclick = draw;
  $("cancelDraw").onclick = cancel;
  $("winnerPoint").onclick = function () {
    if (lastWinner < 0) return;
    addPoints(lastWinner, 1);
    this.disabled = true;
    this.textContent = "✓ Ponto atribuído";
  };

  return {
    get rolling() {
      return rolling;
    },
    cancel,
    stop,
    clearHighlights,
    onPresentationClose,
  };
}
