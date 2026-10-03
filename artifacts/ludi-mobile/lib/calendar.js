const pad = (n) => String(n).padStart(2, '0');
export const toYmd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const parseYmd = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || '');
  return m ? { year: +m[1], month: +m[2], day: +m[3] } : null;
};
// Monday-first grid of month cells (null = blank)
export const monthCells = (year, month) => {
  const first = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const days = new Date(year, month, 0).getDate();
  const cells = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
};
