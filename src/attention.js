/**
 * "Atenção, turma!": a 10-second countdown to be quiet. When time runs out,
 * the teacher decides whether the class loses a life.
 * Phases: idle → countdown → decision → resolved.
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
  } = app;
  let timer = null,
    phase = "idle",
    deadline = 0;

  function stop() {
    clearTimeout(timer);
    timer = null;
    phase = "idle";
  }
  function start() {
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

  $("attention").onclick = start;
  $("masterAttention").onclick = start;
  $("attentionQuiet").onclick = function () {
    if (phase !== "decision") return;
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
    $("attentionDecisions").hidden = true;
    $("attentionTitle").textContent = before > 0 ? "−1 VIDA" : "SEM VIDAS";
    $("attentionResult").hidden = false;
    $("attentionResult").textContent = "♥ " + before + " → " + app.state.lives;
    $("attentionCancel").textContent = "Continuar";
    $("attentionCancel").focus();
  };

  return { stop };
}
