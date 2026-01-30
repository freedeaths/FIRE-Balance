export type CsvPrimitive = string | number | boolean | null | undefined;

function escapeCsvValue(value: CsvPrimitive): string {
  if (value == null) return '';

  const text = String(value);
  const mustQuote =
    text.includes(',') ||
    text.includes('"') ||
    text.includes('\n') ||
    text.includes('\r');

  if (!mustQuote) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(
  rows: Array<Record<string, CsvPrimitive>>,
  opts?: { headers?: string[]; includeBom?: boolean }
): string {
  if (!rows.length) {
    const headerLine = (opts?.headers || []).map(escapeCsvValue).join(',');
    const content = headerLine ? `${headerLine}\r\n` : '';
    return (opts?.includeBom ?? true) ? `\uFEFF${content}` : content;
  }

  const headers = opts?.headers || Object.keys(rows[0]);
  const lines: string[] = [];
  lines.push(headers.map(escapeCsvValue).join(','));

  for (const row of rows) {
    lines.push(headers.map(h => escapeCsvValue(row[h])).join(','));
  }

  const content = `${lines.join('\r\n')}\r\n`;
  return (opts?.includeBom ?? true) ? `\uFEFF${content}` : content;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
