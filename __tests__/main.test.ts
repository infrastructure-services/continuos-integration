import { jest } from '@jest/globals'
import * as path from 'path'
import * as core from '../__fixtures__/core.js'

// Mock @actions/core first
jest.unstable_mockModule('@actions/core', () => core)

// Prepare mutable context for @actions/github mock
type MockContext = {
  eventName: string
  repo: { owner: string; repo: string }
  sha: string
  payload: Record<string, unknown>
}

const mockContext: MockContext = {
  eventName: 'push',
  repo: { owner: 'owner', repo: 'repo' },
  sha: 'abc123',
  payload: {}
}

const createCommitStatus = jest.fn()
const getOctokit = jest.fn(() => ({
  rest: {
    repos: { createCommitStatus }
  }
}))

jest.unstable_mockModule('@actions/github', () => ({
  default: {},
  context: mockContext,
  getOctokit
}))

// Mock createOrUpdateComment helper
const createOrUpdateComment = jest.fn().mockResolvedValue(undefined)
jest.unstable_mockModule('../src/comment.js', () => ({
  createOrUpdateComment
}))

const { run } = await import('../src/main.js')

describe('main.ts', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    core.getInput.mockImplementation((name: string) => {
      if (name === 'github_token') return 'ghs_123'
      if (name === 'report-path') return ''
      return ''
    })
    getOctokit.mockImplementation(() => ({
      rest: { repos: { createCommitStatus } }
    }))
    mockContext.eventName = 'push'
    mockContext.payload = {}
  })

  it('warns and exits when not a pull_request event', async () => {
    await run()
    expect(core.warning).toHaveBeenCalledWith(
      'Esta acción solo se puede ejecutar en eventos de pull request.'
    )
    expect(getOctokit).toHaveBeenCalled()
    expect(createOrUpdateComment).not.toHaveBeenCalled()
    expect(createCommitStatus).not.toHaveBeenCalled()
  })

  it('reports failure when report path does not exist', async () => {
    mockContext.eventName = 'pull_request'
    mockContext.payload = { pull_request: {} }

    await run()

    expect(createOrUpdateComment).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.stringContaining('Report path not found:')
    )
    expect(createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'failure',
        context: 'Agent Code Quality Check'
      })
    )
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('summarizes reports and sets status based on totals when path exists', async () => {
    const { promises: fs } = await import('fs')
    const tmpDir = path.join(process.cwd(), '__tmp_reports_main__')
    await fs.mkdir(tmpDir, { recursive: true })
    await fs.writeFile(
      path.join(tmpDir, 'eslint.json'),
      JSON.stringify([{ errorCount: 1, warningCount: 0 }])
    )

    core.getInput.mockImplementation((name: string) => {
      if (name === 'github_token') return 'ghs_123'
      if (name === 'report-path') return tmpDir
      return ''
    })
    mockContext.eventName = 'pull_request'
    mockContext.payload = { pull_request: {} }

    await run()

    expect(createOrUpdateComment).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.stringContaining('# Code Quality Report')
    )
    // One error -> failure status
    expect(createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'failure',
        context: 'Agent Code Quality Check'
      })
    )
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('sets success when there are zero errors', async () => {
    const { promises: fs } = await import('fs')
    const tmpDir = path.join(process.cwd(), '__tmp_reports_success__')
    await fs.mkdir(tmpDir, { recursive: true })
    // ESLint-style JSON with only warnings
    await fs.writeFile(
      path.join(tmpDir, 'eslint.json'),
      JSON.stringify([{ errorCount: 0, warningCount: 2 }])
    )

    core.getInput.mockImplementation((name: string) => {
      if (name === 'github_token') return 'ghs_123'
      if (name === 'report-path') return tmpDir
      return ''
    })
    mockContext.eventName = 'pull_request'
    mockContext.payload = { pull_request: {} }

    await run()

    expect(createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'success',
        context: 'Agent Code Quality Check'
      })
    )
    await fs.rm(tmpDir, { recursive: true, force: true })
  })
})
