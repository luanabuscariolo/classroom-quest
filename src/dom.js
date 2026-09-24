/** Small DOM helpers shared by the interface controllers. */
export function $(id) {
  return document.getElementById(id);
}

export function element(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function button(text, fn, cls) {
  const b = element("button", "button " + (cls || ""), text);
  b.type = "button";
  b.onclick = fn;
  return b;
}

export function reducedMotion() {
  return (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Restart a CSS animation that is already applied. */
export function replay(node, className) {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob),
    a = element("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 30000);
}

export function downloadJSON(data, name) {
  downloadBlob(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    name,
  );
}

export function downloadText(text, name) {
  downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), name);
}
