/**
 * CSV serialization for the aggregate analytics export.
 *
 * Two rules matter here and are tested directly:
 *
 *  1. Formula neutralization. A spreadsheet executes a cell that begins with
 *     `=`, `+`, `-`, `@`, tab, or carriage return. Link titles come from the CMS,
 *     so they are operator-controlled, but a compromised or careless editor must
 *     not be able to turn an export into a payload. Such a cell is prefixed with
 *     an apostrophe, which Excel and LibreOffice treat as literal text.
 *  2. RFC 4180 quoting. A value containing a quote, comma, or newline is wrapped
 *     in double quotes with inner quotes doubled, so the column count can never be
 *     shifted by content.
 */

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  let text = String(value);

  if (FORMULA_TRIGGER.test(text)) {
    text = `'${text}`;
  }

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvRow(values: Array<string | number | null | undefined>): string {
  return values.map(csvCell).join(",");
}

/** Prepends the UTF-8 BOM so spreadsheet software reads the file as UTF-8. */
export function toCsvDocument(lines: string[]): string {
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}