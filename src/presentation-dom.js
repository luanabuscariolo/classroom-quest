export function syncProjectionElement(old, fresh) {
  if (
    old.nodeType !== fresh.nodeType ||
    old.nodeName !== fresh.nodeName ||
    (old.nodeType === 1 && old.id !== fresh.id)
  ) {
    old.replaceWith(fresh);
    return;
  }
  if (old.nodeType === 3) {
    if (old.nodeValue !== fresh.nodeValue) old.nodeValue = fresh.nodeValue;
    return;
  }
  if (old.nodeType !== 1) return;
  Array.from(old.attributes).forEach(function (a) {
    if (!fresh.hasAttribute(a.name)) old.removeAttribute(a.name);
  });
  Array.from(fresh.attributes).forEach(function (a) {
    if (old.getAttribute(a.name) !== a.value) old.setAttribute(a.name, a.value);
  });
  syncProjectionNodes(old, Array.from(fresh.childNodes));
}

export function syncProjectionNodes(host, nodes) {
  nodes.forEach(function (n, i) {
    var old = host.childNodes[i];
    if (old) syncProjectionElement(old, n);
    else host.appendChild(n);
  });
  while (host.childNodes.length > nodes.length) host.lastChild.remove();
}
