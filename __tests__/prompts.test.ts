import { describe, it, expect } from '@jest/globals'
import {
  AgentQualityCodeWithDiffs,
  SYSTEM_PROMPT_QUALITY
} from '../src/prompts.js'

describe('prompts.ts', () => {
  it('exports non-empty SYSTEM_PROMPT_QUALITY with Quality Gate section', () => {
    expect(typeof SYSTEM_PROMPT_QUALITY).toBe('string')
    expect(SYSTEM_PROMPT_QUALITY.length).toBeGreaterThan(50)
    expect(SYSTEM_PROMPT_QUALITY).toContain('Quality Gate')
    expect(SYSTEM_PROMPT_QUALITY).toContain('Result')
  })

  it('exports AgentQualityCodeWithDiffs with correct header metadata', () => {
    expect(typeof AgentQualityCodeWithDiffs).toBe('string')
    expect(AgentQualityCodeWithDiffs).toContain(
      'name: AgentQualityCodeWithDiffs'
    )
    expect(AgentQualityCodeWithDiffs).toContain('model: GPT-4o')
    expect(AgentQualityCodeWithDiffs).toContain('## Purpose')
  })
})
