/**
 * CSV helpers. All export endpoints MUST go through `csvCell` (or `toCsvRow`)
 * to prevent CSV formula injection in Excel/Numbers/LibreOffice.
 *
 * Audit reference: docs/code-review-and-optimization-plan-minimax.md (P0-3)
 *
 * Why a leading single-quote prefix is safe:
 *  - Excel and Numbers treat a leading `'` as a "force text" marker. The
 *    user still sees the original value when they open the cell.
 *  - LibreOffice and Google Sheets behave the same.
 *  - It does NOT interfere with normal CSV parsing (no quoting change).
 *  - It is the OWASP-recommended mitigation.
 */
const DANGEROUS_LEAD = /^[=+\-@\t\r]/;

/**
 * Escape a value for safe inclusion in a CSV cell.
 *
 * - null/undefined become an empty string
 * - any value containing `"`, `,`, `\n` or `\r` is wrapped in double quotes
 *   with inner quotes doubled (RFC 4180)
 * - any value whose first character is `=`, `+`, `-`, `@`, TAB, or CR is
 *   prefixed with a single quote to neutralize formula execution in
 *   spreadsheet apps
 */
export function csvCell(value: unknown): string {
  const raw = value == null ? '' : String(value);
  const escaped = /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
  return DANGEROUS_LEAD.test(escaped) ? `'${escaped}` : escaped;
}

/**
 * Build a single CSV row from a list of values, applying `csvCell` to each.
 */
export function toCsvRow(values: readonly unknown[]): string {
  return values.map(csvCell).join(',');
}

/**
 * Build a CSV header line (BOM + header + newline). The UTF-8 BOM is included
 * so that Excel for Windows opens the file with the correct encoding when the
 * export contains Cyrillic / Kazakh text.
 */
export function csvHeader(headers: readonly string[]): string {
  return '\ufeff' + toCsvRow(headers) + '\n';
}
