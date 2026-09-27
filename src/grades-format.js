/** Numbers as shown in the Avaliação tables: decimal comma, "—" if missing. */
export const number = (x, digits) =>
  x === null || x === undefined ? "—" : x.toFixed(digits).replace(".", ",");

/** Whole numbers without decimals, others with two. */
export const number2 = (x) =>
  number(Math.round(x * 100) / 100, Number.isInteger(x) ? 0 : 2);
