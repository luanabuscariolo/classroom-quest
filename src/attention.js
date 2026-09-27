/**
 * "Atenção, turma!": a 10-second countdown to be quiet. When time runs out,
 * the teacher decides whether the class loses a life.
 * Phases: idle → countdown → decision → resolved.
 * In room mode, what the teacher does on the tablet is shared (`share`) and
 * the PC shows the same countdown and result on the projector.
 */
export function createAttention(app) {
  const {
    $,
    playSound,
    openOverlay,
    closeOverlay,
    replay,
    changeLife,
    status,
    share,
  } = app;
  let timer = null,
    phase = "idle",
    deadline = 0;

  function stop() {
    clearTimeout(timer);
    timer = null;
    phase = "idle";
  }
  /** `fromRoom`: started on another device (not shared again). */
  function start(fromRoom = false) {
    if (!fromRoom) share("attention-start");
    document.body.classList.add("silence-active");
    playSound("alert");
    clearTimeout(timer);
    phase = "countdown";
    deadline = Date.now() + 10000;
    $("attentionDecisions").hidden = true;
    $("attentionResult").hidden = true;
    $("attentionNoisy").disabled = false;
    $("attentionTitle").textContent = "SILÊNCIO";
    $("attentionPrompt").textContent = "";
    $("attentionCancel").textContent = "Cancelar";
    openOverlay("attentionOverlay", "attentionCancel");
    let previous = -1;
    function tick() {
      if (phase !== "countdown") return;
      const remaining = Math.max(0, deadline - Date.now()),
        seconds = Math.ceil(remaining / 1000);
      $("attentionFill").style.width = remaining / 100 + "%";
      $("attentionProgress").setAttribute("aria-valuenow", seconds);
      if (seconds !== previous) {
        $("attentionOverlay").dataset.level =
          seconds <= 5 ? "urgent" : seconds <= 7 ? "warning" : "ready";
        if (seconds < 10)
          playSound(
            seconds === 0 ? "timeup" : seconds <= 5 ? "urgent" : "count",
          );
        $("attentionNumber").textContent = seconds;
        replay($("attentionNumber"), "attention-beat");
        previous = seconds;
      }
      if (remaining === 0) {
        phase = "decision";
        timer = null;
        $("attentionTitle").textContent = "TEMPO ESGOTADO";
        $("attentionPrompt").textContent = "A turma já está em silêncio?";
        $("attentionDecisions").hidden = false;
        $("attentionQuiet").focus();
        return;
      }
      timer = setTimeout(tick, 80);
    }
    tick();
  }

  /** The class lost a life: show "−1 VIDA" and the lives before and after. */
  function showLifeLost(before, after) {
    clearTimeout(timer);
    timer = null;
    phase = "resolved";
    $("attentionNoisy").disabled = true;
    $("attentionDecisions").hidden = true;
    $("attentionTitle").textContent = before > 0 ? "−1 VIDA" : "SEM VIDAS";
    $("attentionResult").hidden = false;
    $("attentionResult").textContent = "♥ " + before + " → " + after;
    $("attentionCancel").textContent = "Continuar";
  }
  function hide() {
    stop();
    document.body.classList.remove("silence-active");
    $("attentionOverlay").hidden = true;
  }

  /** Room mode: show on this screen what the teacher did on the tablet. */
  function fromRoom(e) {
    const open = !$("attentionOverlay").hidden;
    if (e.type === "attention-start") {
      if (!$("gameMain").hidden) start(true);
    } else if (e.type === "attention-noisy") {
      if (open && Number.isInteger(e.before) && Number.isInteger(e.after))
        showLifeLost(e.before, e.after);
    } else if (e.type === "attention-quiet") {
      if (open) {
        playSound("quiet");
        hide();
      }
    } else if (e.type === "attention-close") {
      if (open) hide();
    }
  }

  $("attention").onclick = () => start();
  $("masterAttention").onclick = () => start();
  $("attentionQuiet").onclick = function () {
    if (phase !== "decision") return;
    share("attention-quiet");
    playSound("quiet");
    closeOverlay("attentionOverlay");
    status("✓ A turma ficou em silêncio. Vamos continuar!");
  };
  $("attentionNoisy").onclick = function () {
    if (phase !== "decision") return;
    phase = "resolved";
    this.disabled = true;
    const before = app.state.lives;
    changeLife(-1);
    showLifeLost(before, app.state.lives);
    share("attention-noisy", { before, after: app.state.lives });
    $("attentionCancel").focus();
  };

  return { stop, fromRoom };
}
