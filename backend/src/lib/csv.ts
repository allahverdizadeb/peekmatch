// Hand-rolled RFC4180 CSV writer — no dependency needed at this product's table sizes (dozens to a
// few hundred rows). Guards against CSV/Excel formula injection: a cell whose value starts with
// =, +, -, or @ is escaped with a leading apostrophe, the standard mitigation for cells later opened
// in a spreadsheet application.
function sanitizeCell(raw: string): string {
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

export function toCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const lines = [headers.map(sanitizeCell).join(',')];
  for (const row of rows) {
    lines.push(row.map((cell) => sanitizeCell(cell === null || cell === undefined ? '' : String(cell))).join(','));
  }
  return lines.join('\r\n');
}
