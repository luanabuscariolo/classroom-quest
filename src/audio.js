/** Owns Web Audio state and sound controls. No network or media dependencies. */
export function createAudio(document, window) {
  const $ = (id) => document.getElementById(id);
  let soundEnabled = true,
    audioContext = null,
    audioMaster = null,
    audioVolume = 0.8;
  function ensureAudio() {
    if (!soundEnabled) return false;
    try {
      var Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) {
        $("soundToggle").textContent = "Som indisponível";
        return false;
      }
      if (!audioContext) {
        audioContext = new Context();
        audioMaster = audioContext.createGain();
        audioMaster.gain.value = 0.85 * audioVolume;
        var compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -8;
        compressor.ratio.value = 8;
        audioMaster.connect(compressor);
        compressor.connect(audioContext.destination);
      }
      if (audioContext.state === "suspended")
        audioContext.resume().catch(function () {});
      $("soundToggle").dataset.audioState = audioContext.state;
      return true;
    } catch (e) {
      return false;
    }
  }
  function notes(sequence, type) {
    if (!soundEnabled || !ensureAudio()) return;
    try {
      var start = audioContext.currentTime + 0.015;
      sequence.forEach(function (note) {
        var oscillator = audioContext.createOscillator(),
          gain = audioContext.createGain(),
          at = start + note[1],
          duration = note[2];
        oscillator.type = type || "triangle";
        oscillator.frequency.setValueAtTime(note[0], at);
        if (note[3])
          oscillator.frequency.exponentialRampToValueAtTime(
            note[3],
            at + duration,
          );
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.45, at + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
        oscillator.connect(gain);
        gain.connect(audioMaster);
        oscillator.start(at);
        oscillator.stop(at + duration + 0.02);
        oscillator.onended = function () {
          oscillator.disconnect();
          gain.disconnect();
        };
      });
    } catch (e) {
      // Audio is optional: browser/device failures must not interrupt the lesson.
    }
  }
  function playSound(kind) {
    var cues = {
      select: [[520, 0, 0.035]],
      point: [
        [650, 0, 0.08],
        [980, 0.075, 0.12],
      ],
      minus: [[390, 0, 0.16, 190]],
      gain: [
        [523, 0, 0.1],
        [659, 0.09, 0.1],
        [784, 0.18, 0.18],
      ],
      loss: [
        [390, 0, 0.15, 230],
        [230, 0.13, 0.21, 120],
      ],
      start: [
        [440, 0, 0.08],
        [660, 0.08, 0.1],
      ],
      tick: [[1050, 0, 0.025, 550]],
      win: [
        [523, 0, 0.1],
        [659, 0.1, 0.1],
        [784, 0.2, 0.1],
        [1047, 0.32, 0.3],
      ],
      alert: [
        [784, 0, 0.13],
        [587, 0.16, 0.17],
      ],
      count: [[680, 0, 0.1]],
      urgent: [
        [880, 0, 0.08],
        [1047, 0.15, 0.09],
      ],
      timeup: [
        [330, 0, 0.14],
        [330, 0.2, 0.14],
        [440, 0.4, 0.24],
      ],
      quiet: [
        [659, 0, 0.12],
        [880, 0.13, 0.22],
      ],
    };
    if (cues[kind]) notes(cues[kind], kind === "tick" ? "square" : "triangle");
  }
  $("soundToggle").onclick = function () {
    soundEnabled = !soundEnabled;
    this.setAttribute("aria-pressed", soundEnabled ? "true" : "false");
    this.textContent = soundEnabled ? "♪ Som ligado" : "♪ Som desligado";
    if (audioMaster)
      audioMaster.gain.setTargetAtTime(
        soundEnabled ? 0.85 * audioVolume : 0,
        audioContext.currentTime,
        0.012,
      );
    if (soundEnabled) playSound("point");
  };
  document.addEventListener(
    "click",
    function () {
      if (soundEnabled) ensureAudio();
    },
    true,
  );
  $("volume").addEventListener("input", function () {
    audioVolume = Number(this.value) / 100;
    $("volumeValue").textContent = this.value + "%";
    if (audioMaster)
      audioMaster.gain.setTargetAtTime(
        soundEnabled ? 0.85 * audioVolume : 0,
        audioContext.currentTime,
        0.02,
      );
  });
  $("volume").addEventListener("change", function () {
    playSound("point");
  });

  return { playSound };
}
