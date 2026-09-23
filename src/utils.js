export function pad(n) {
  return n < 10 ? "0" + n : String(n);
}

export function uid() {
  return (
    "q-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 12)
  );
}

export function copy(x) {
  return JSON.parse(JSON.stringify(x));
}

export function validDate(x) {
  return typeof x === "string" && Number.isFinite(Date.parse(x));
}

export function integer(x, min, max) {
  return Number.isSafeInteger(x) && x >= min && x <= max;
}

export function dayISO(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

export function validDay(s) {
  return (
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) &&
    new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s
  );
}

export function dateLabel(s) {
  return s ? s.split("-").reverse().join("/") : "";
}

export function textField(x, max) {
  return typeof x === "string" && x.length <= max;
}
