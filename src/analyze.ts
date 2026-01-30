import fs from 'fs/promises'
import path from 'path'
import { PR_COMMENT_IDENTIFIER } from './constants.js'

export type Summary = {
  tool: string
  file: string
  errors: number
  warnings: number
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

export async function listFiles(root: string): Promise<string[]> {
  const stat = await fs.stat(root)
  if (stat.isFile()) return [root]
  const entries = await fs.readdir(root, { withFileTypes: true })
  return entries.filter((e) => e.isFile()).map((e) => path.join(root, e.name))
}

export function tryParseJSON(text: string): any | undefined {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export function summarizeJSON(
  obj: any
): { tool: string; errors: number; warnings: number } | undefined {
  // SARIF
  if (obj && typeof obj === 'object' && Array.isArray(obj.runs)) {
    const results = obj.runs.flatMap((r: any) => r.results ?? [])
    const errors = results.filter(
      (r: any) => (r.level ?? '').toLowerCase() === 'error'
    ).length
    const warnings = results.filter(
      (r: any) => (r.level ?? '').toLowerCase() === 'warning'
    ).length
    return { tool: 'sarif', errors, warnings }
  }
  // ESLint-like: array of file results with errorCount/warningCount
  if (
    Array.isArray(obj) &&
    obj.length &&
    ('errorCount' in obj[0] || 'warningCount' in obj[0])
  ) {
    const errors = obj.reduce(
      (a: number, it: any) => a + (it.errorCount ?? 0),
      0
    )
    const warnings = obj.reduce(
      (a: number, it: any) => a + (it.warningCount ?? 0),
      0
    )
    return { tool: 'eslint', errors, warnings }
  }
  // Stylelint-like: array of results with warnings[]
  if (Array.isArray(obj) && obj.length && Array.isArray(obj[0]?.warnings)) {
    const allWarnings = obj.flatMap((it: any) => it.warnings ?? [])
    const errors = allWarnings.filter(
      (w: any) => (w.severity ?? '').toLowerCase() === 'error'
    ).length
    const warnings = allWarnings.filter(
      (w: any) => (w.severity ?? '').toLowerCase() === 'warning'
    ).length
    return { tool: 'stylelint', errors, warnings }
  }
  // Pylint/htmllint generic array of messages with "type"
  if (Array.isArray(obj) && obj.length && typeof obj[0] === 'object') {
    const errors = obj.filter(
      (m: any) => (m.type ?? '').toLowerCase() === 'error'
    ).length
    const warnings = obj.filter(
      (m: any) => (m.type ?? '').toLowerCase() === 'warning'
    ).length
    if (errors || warnings) return { tool: 'generic-json', errors, warnings }
  }
  return undefined
}

export async function collectSummaries(reportPath: string): Promise<{
  summaries: Summary[]
  totals: { errors: number; warnings: number }
}> {
  const summaries: Summary[] = []
  const files = await listFiles(reportPath)
  for (const file of files) {
    const text = await fs.readFile(file, 'utf8')
    const asJson = tryParseJSON(text)
    if (asJson) {
      const s = summarizeJSON(asJson)
      if (s) {
        summaries.push({
          tool: s.tool,
          file: path.basename(file),
          errors: s.errors,
          warnings: s.warnings
        })
        continue
      }
    }
    // Fallback: count keywords in text reports
    const lc = text.toLowerCase()
    const errors = (lc.match(/\berror\b/g) || []).length
    const warnings = (lc.match(/\bwarning\b/g) || []).length
    summaries.push({
      tool: 'text',
      file: path.basename(file),
      errors,
      warnings
    })
  }
  const totals = summaries.reduce(
    (acc, s) => ({
      errors: acc.errors + s.errors,
      warnings: acc.warnings + s.warnings
    }),
    { errors: 0, warnings: 0 }
  )
  return { summaries, totals }
}

export function renderComment(
  summaries: Summary[],
  totals: { errors: number; warnings: number }
): string {
  const lines: string[] = []
  lines.push(PR_COMMENT_IDENTIFIER)
  lines.push('# Code Quality Report')
  lines.push('')
  lines.push(`- Total Errors: ${totals.errors}`)
  lines.push(`- Total Warnings: ${totals.warnings}`)
  lines.push('')
  if (summaries.length) {
    lines.push('## Per-file')
    for (const s of summaries) {
      lines.push(
        `- ${s.file} (${s.tool}): ${s.errors} errors, ${s.warnings} warnings`
      )
    }
  } else {
    lines.push('_No reports detected in the provided path._')
  }
  return lines.join('\n')
}
