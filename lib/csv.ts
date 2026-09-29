// CSV for exports. Cells that start with = + - @ are prefixed with ' so spreadsheets don't run them
// as formulas (CSV injection).
type Cell = string | number | null | undefined;

function escape(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  let s = String(cell);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map((r) => r.map(escape).join(",")).join("\r\n") + "\r\n";
}
