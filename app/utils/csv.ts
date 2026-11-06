/** Export CSV (séparateur « ; », BOM UTF-8 pour Excel). Les cellules commençant par = + - @ sont neutralisées contre l'injection de formule. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0]!)
  const cell = (v: unknown) => {
    let s = v == null ? '' : String(v)
    if (/^[=+\-@]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [keys.join(';'), ...rows.map((r) => keys.map((k) => cell(r[k])).join(';'))].join('\r\n')
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (typeof document === 'undefined') return
  const blob = new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename.endsWith('.csv') ? filename : `${filename}.csv` })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
