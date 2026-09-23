export var femaleNames = new Set(
  "ana maria joana beatriz bia ines carolina mariana sofia laura leonor matilde margarida alice lara clara isabel sara sarah francisca camila julia helena rita catarina diana luana leticia luisa vera raquel ines eva ines emilia valentina madalena iris vitoria adriana amelia aline andrea amanda bruna carla daniela elisa fatima gabriela helena ines liana liliana lucia luiza marta monica natalia patricia paula renata susana talita teresa vanessa viviane yasmin".split(
    " ",
  ),
);

export var maleNames = new Set(
  "joao jose antonio manuel pedro miguel tiago diogo rodrigo afonso francisco tomas duarte guilherme santiago gabriel rafael lucas davi david daniel bernardo salvador henrique goncalo andre bruno eduardo martim luis nuno paulo ricardo rui sergio simao vitor vitoria victor ze zeca alex alexandre artur arthur caio carlos cesar diego enzo felipe gustavo hugo igor isaac jorge juliano leonardo luciano mario mateus matheus murilo otavio renato samuel thiago vinicius william".split(
    " ",
  ),
);

export function autoAvatar(s, i) {
  if (s.avatarMode === "manual") return;
  var name = s.name
    .trim()
    .split(/\s+/)[0]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  s.gender =
    Math.random() < 0.28
      ? "robot"
      : femaleNames.has(name)
        ? "f"
        : maleNames.has(name)
          ? "m"
          : "robot";
  var options =
    s.gender === "f"
      ? [28, 29, 30, 31]
      : s.gender === "m"
        ? [24, 25, 26, 27]
        : [16, 17, 18, 19, 20, 21, 22, 23];
  s.avatar = options[Math.floor(Math.random() * options.length)];
  s.avatarMode = "auto";
}

export function avatarChoices(gender) {
  return gender === "f"
    ? [28, 29, 30, 31, 8, 9, 10, 11, 14, 15]
    : gender === "m"
      ? [24, 25, 26, 27, 4, 5, 6, 7, 12, 13]
      : [16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3];
}

export function avatarFor(s, i) {
  var options = avatarChoices(s.gender);
  return Number.isInteger(s.avatar) && s.avatar >= 0 && s.avatar < 32
    ? s.avatar
    : options[i % options.length];
}

export function sprite(node, index) {
  node.dataset.sheet = index >= 16 ? "new" : "original";
  index = index % 16;
  node.textContent = "";
  node.classList.add("game-avatar");
  node.style.backgroundSize = "400% 400%";
  node.style.backgroundPosition =
    ((index % 4) * 100) / 3 + "% " + (Math.floor(index / 4) * 100) / 3 + "%";
  node.dataset.avatar = index + (node.dataset.sheet === "new" ? 16 : 0);
}

export function masterSprite(node, index) {
  node.textContent = "";
  node.classList.add("game-avatar");
  node.removeAttribute("data-avatar");
  node.dataset.masterAvatar = index;
  node.dataset.sheet = index === 0 ? "teacher" : "masters";
  if (index === 0) {
    node.style.backgroundSize = "contain";
    node.style.backgroundPosition = "center bottom";
    return;
  }
  var i = index - 1,
    col = i % 3,
    row = Math.floor(i / 3),
    xs = [50, 440, 840],
    ws = [380, 390, 385],
    ys = [0, 435, 850],
    hs = [435, 415, 404],
    x = xs[col],
    w = ws[col],
    y = ys[row],
    h = hs[row];
  node.style.setProperty(
    "--master-size",
    (1254 / w) * 100 + "% " + (1254 / h) * 100 + "%",
  );
  node.style.setProperty(
    "--master-position",
    (x / (1254 - w)) * 100 + "% " + (y / (1254 - h)) * 100 + "%",
  );
}
