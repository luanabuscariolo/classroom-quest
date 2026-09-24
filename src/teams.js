/** Random teams with their own score. Members are student slots. */
export function createTeams(app) {
  const { $, dirty, playSound, openOverlay, activeSlots } = app;

  function render() {
    const state = app.state,
      root = $("teamList");
    root.textContent = "";
    state.groups.forEach((g, i) => {
      const box = document.createElement("article");
      box.className = "team";
      const h = document.createElement("h3");
      h.className = "pixel";
      h.textContent = "EQUIPA " + (i + 1);
      const names = document.createElement("p");
      names.textContent = g.members
        .map((j) => state.students[j].name)
        .filter(Boolean)
        .join(" · ");
      const points = document.createElement("div");
      points.className = "team-score";
      points.textContent = "★ " + g.points;
      const row = document.createElement("div");
      row.className = "row";
      [-1, 1].forEach((n) => {
        const b = document.createElement("button");
        b.className = "button small";
        b.textContent = (n > 0 ? "+" : "") + n;
        b.setAttribute(
          "aria-label",
          (n > 0 ? "Dar" : "Retirar") + " um ponto à equipa " + (i + 1),
        );
        b.onclick = function () {
          if (!Number.isSafeInteger(g.points + n)) {
            alert("Pontuação fora do limite.");
            return;
          }
          g.points += n;
          dirty();
          points.textContent = "★ " + g.points;
        };
        row.appendChild(b);
      });
      box.appendChild(h);
      box.appendChild(names);
      box.appendChild(points);
      box.appendChild(row);
      root.appendChild(box);
    });
  }

  $("teamsOpen").onclick = function () {
    render();
    openOverlay("teamsOverlay", "teamCount");
  };
  $("makeTeams").onclick = function () {
    const state = app.state,
      ids = activeSlots(),
      n = Number($("teamCount").value);
    if (ids.length < n) {
      alert("São necessários pelo menos " + n + " alunos com nome.");
      return;
    }
    if (
      state.groups.length &&
      !confirm("Voltar a sortear as equipas apaga os seus pontos. Continuar?")
    )
      return;
    // Fisher–Yates shuffle, then deal students round-robin.
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    state.groups = [];
    for (let k = 0; k < n; k++) state.groups.push({ members: [], points: 0 });
    ids.forEach((id, i) => {
      state.groups[i % n].members.push(id);
    });
    dirty();
    render();
    playSound("win");
  };

  return { render };
}
