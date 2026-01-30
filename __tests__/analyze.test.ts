import { promises as fs } from 'fs'
import * as path from 'path'
import {
  tryParseJSON,
  summarizeJSON,
  renderComment,
  collectSummaries,
  pathExists,
  listFiles
} from '../src/analyze.js'

describe('analyze.ts', () => {
  it('tryParseJSON returns object for valid JSON and undefined otherwise', () => {
    expect(tryParseJSON('{"a":1}')).toEqual({ a: 1 })
    expect(tryParseJSON('not json')).toBeUndefined()
  })

  it('summarizeJSON supports SARIF', () => {
    const sarif = {
      runs: [
        {
          results: [{ level: 'error' }, { level: 'warning' }, { level: 'note' }]
        }
      ]
    }
    expect(summarizeJSON(sarif)).toEqual({
      tool: 'sarif',
      errors: 1,
      warnings: 1
    })
  })
  it('summarizeJSON SARIF handles missing level via nullish coalescing', () => {
    const sarif = { runs: [{ results: [{}, { level: 'error' }] }] }
    expect(summarizeJSON(sarif)).toEqual({
      tool: 'sarif',
      errors: 1,
      warnings: 0
    })
  })
  it('summarizeJSON SARIF condition fails when runs is not an array', () => {
    const sarifInvalid = { runs: {} }
    expect(summarizeJSON(sarifInvalid)).toBeUndefined()
  })

  it('summarizeJSON supports ESLint array', () => {
    const eslint = [
      { errorCount: 2, warningCount: 1 },
      { errorCount: 0, warningCount: 3 }
    ]
    expect(summarizeJSON(eslint)).toEqual({
      tool: 'eslint',
      errors: 2,
      warnings: 4
    })
  })

  it('summarizeJSON supports ESLint warnings-only (no errorCount)', () => {
    const eslintWarnOnly = [{ warningCount: 2 }, { warningCount: 1 }]
    expect(summarizeJSON(eslintWarnOnly)).toEqual({
      tool: 'eslint',
      errors: 0,
      warnings: 3
    })
  })
  it('summarizeJSON supports ESLint errors-only (no warningCount)', () => {
    const eslintErrorOnly = [{ errorCount: 3 }, { errorCount: 0 }]
    expect(summarizeJSON(eslintErrorOnly)).toEqual({
      tool: 'eslint',
      errors: 3,
      warnings: 0
    })
  })

  it('summarizeJSON returns undefined for empty ESLint array', () => {
    expect(summarizeJSON([])).toBeUndefined()
  })

  it('summarizeJSON supports Stylelint array', () => {
    const stylelint = [
      { warnings: [{ severity: 'error' }, { severity: 'warning' }] },
      { warnings: [{ severity: 'warning' }] }
    ]
    expect(summarizeJSON(stylelint)).toEqual({
      tool: 'stylelint',
      errors: 1,
      warnings: 2
    })
  })
  it('summarizeJSON stylelint handles missing severity via nullish coalescing', () => {
    const stylelint = [{ warnings: [{}, { severity: 'warning' }] }]
    expect(summarizeJSON(stylelint)).toEqual({
      tool: 'stylelint',
      errors: 0,
      warnings: 1
    })
  })
  it('summarizeJSON stylelint with non-error/warning severities yields zero counts', () => {
    const stylelintNotes = [
      { warnings: [{ severity: 'note' }, { severity: 'info' }] }
    ]
    expect(summarizeJSON(stylelintNotes)).toEqual({
      tool: 'stylelint',
      errors: 0,
      warnings: 0
    })
  })
  it('summarizeJSON stylelint condition fails when warnings is not an array', () => {
    const stylelintInvalid = [{ warnings: 'not-an-array' }]
    expect(summarizeJSON(stylelintInvalid)).toBeUndefined()
  })

  it('summarizeJSON supports generic messages with type', () => {
    const generic = [{ type: 'error' }, { type: 'warning' }, { type: 'note' }]
    expect(summarizeJSON(generic)).toEqual({
      tool: 'generic-json',
      errors: 1,
      warnings: 1
    })
  })

  it('renderComment includes totals and per-file lines', () => {
    const body = renderComment(
      [
        { tool: 'eslint', file: 'a.json', errors: 2, warnings: 1 },
        { tool: 'stylelint', file: 'b.json', errors: 0, warnings: 3 }
      ],
      { errors: 2, warnings: 4 }
    )
    expect(body).toContain('Total Errors: 2')
    expect(body).toContain('Total Warnings: 4')
    expect(body).toContain('a.json (eslint): 2 errors, 1 warnings')
    expect(body).toContain('b.json (stylelint): 0 errors, 3 warnings')
  })

  it('renderComment for empty summaries shows placeholder', () => {
    const body = renderComment([], { errors: 0, warnings: 0 })
    expect(body).toContain('<!-- code-quality-validator -->')
    expect(body).toContain('_No reports detected in the provided path._')
  })

  it('pathExists and listFiles work for files and directories', async () => {
    const tmpDir = path.join(process.cwd(), '__tmp_reports__')
    await fs.mkdir(tmpDir, { recursive: true })
    const f1 = path.join(tmpDir, 'eslint.json')
    const f2 = path.join(tmpDir, 'stylelint.json')
    await fs.writeFile(f1, JSON.stringify([{ errorCount: 1, warningCount: 2 }]))
    await fs.writeFile(
      f2,
      JSON.stringify([{ warnings: [{ severity: 'warning' }] }])
    )

    expect(await pathExists(tmpDir)).toBe(true)
    const files = await listFiles(tmpDir)
    expect(files).toHaveLength(2)

    const { summaries, totals } = await collectSummaries(tmpDir)
    expect(summaries).toHaveLength(2)
    expect(totals.errors).toBe(1)
    expect(totals.warnings).toBe(3)

    // Cleanup
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('collectSummaries counts fallback text errors and warnings', async () => {
    const tmpDir = path.join(process.cwd(), '__tmp_reports_text__')
    await fs.mkdir(tmpDir, { recursive: true })
    const tf = path.join(tmpDir, 'plain.txt')
    await fs.writeFile(
      tf,
      'Error: something\nwarning: something else\nNOTE: ignore'
    )

    const { summaries, totals } = await collectSummaries(tmpDir)
    expect(summaries[0]).toEqual(
      expect.objectContaining({ tool: 'text', errors: 1, warnings: 1 })
    )
    expect(totals.errors).toBe(1)
    expect(totals.warnings).toBe(1)

    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('collectSummaries fallback with no keywords yields zero totals', async () => {
    const tmpDir = path.join(process.cwd(), '__tmp_reports_text_empty__')
    await fs.mkdir(tmpDir, { recursive: true })
    const tf = path.join(tmpDir, 'plain.txt')
    await fs.writeFile(tf, 'notes only, no issues reported')

    const { totals } = await collectSummaries(tmpDir)
    expect(totals.errors).toBe(0)
    expect(totals.warnings).toBe(0)

    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('pathExists returns false for non-existent path', async () => {
    const p = path.join(process.cwd(), '__no_such_dir__')
    expect(await pathExists(p)).toBe(false)
  })

  it('listFiles returns the file when given a file path', async () => {
    const tmpFile = path.join(process.cwd(), '__single_file__.txt')
    await fs.writeFile(tmpFile, 'just a test')
    const files = await listFiles(tmpFile)
    expect(files).toEqual([tmpFile])
    await fs.rm(tmpFile, { force: true })
  })

  it('summarizeJSON returns undefined for unknown shapes', () => {
    expect(summarizeJSON({ foo: 'bar' })).toBeUndefined()
    expect(summarizeJSON([{ hello: 'world' }])).toBeUndefined()
    expect(summarizeJSON(null as unknown as any)).toBeUndefined()
    expect(summarizeJSON('string' as unknown as any)).toBeUndefined()
  })

  it('collectSummaries falls back when JSON parses but has unknown shape', async () => {
    const tmpDir = path.join(process.cwd(), '__tmp_reports_unknown_json__')
    await fs.mkdir(tmpDir, { recursive: true })
    const jf = path.join(tmpDir, 'unknown.json')
    await fs.writeFile(jf, JSON.stringify({ message: 'error warning' }))

    const { summaries, totals } = await collectSummaries(tmpDir)
    expect(summaries[0]).toEqual(
      expect.objectContaining({ tool: 'text', errors: 1, warnings: 1 })
    )
    expect(totals.errors).toBe(1)
    expect(totals.warnings).toBe(1)

    await fs.rm(tmpDir, { recursive: true, force: true })
  })
})
