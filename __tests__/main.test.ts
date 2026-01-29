import { jest } from '@jest/globals'
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

// Mock Copilot SDK with a class to mirror constructor usage
const sendAndWait = jest.fn()
const createSession = jest.fn(async () => ({ sendAndWait }))
const stopMock = jest.fn().mockResolvedValue([])
class CopilotClientMock {
  createSession = createSession
  stop = stopMock
}
jest.unstable_mockModule('@github/copilot-sdk', () => ({
  CopilotClient: CopilotClientMock
}))

// Mock @actions/exec to prevent real global installs during tests
const execMock = jest.fn().mockResolvedValue(0)
jest.unstable_mockModule('@actions/exec', () => ({
  exec: execMock
}))

const { run } = await import('../src/main.js')

describe('main.ts', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    // reset mocks recreated above
    core.getInput.mockImplementation((name: string) => {
      if (name === 'github_token') return 'ghs_123'
      if (name === 'report-path') return ''
      return ''
    })
    // restore getOctokit implementation after reset
    getOctokit.mockImplementation(() => ({
      rest: { repos: { createCommitStatus } }
    }))
    mockContext.eventName = 'push'
    mockContext.payload = {}
    // clear per-test Copilot stop calls
    stopMock.mockClear()
    execMock.mockClear()
  })

  it('warns and exits when not a pull_request event', async () => {
    await run()
    expect(core.warning).toHaveBeenCalledWith(
      'Esta acción solo se puede ejecutar en eventos de pull request.'
    )
    expect(getOctokit).toHaveBeenCalled()
  })

  it('posts success status when Copilot returns PASS', async () => {
    mockContext.eventName = 'pull_request'
    mockContext.payload = { pull_request: { html_url: 'https://example/pr/1' } }
    createSession.mockImplementation(async (opts: unknown) => {
      if (opts?.onPermissionRequest) {
        await opts.onPermissionRequest()
      }
      return {
        sendAndWait: jest
          .fn()
          .mockResolvedValue({ data: { content: '**Result:** PASS' } })
      }
    })

    await run()

    expect(createSession).toHaveBeenCalled()
    expect(createOrUpdateComment).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.stringContaining('**Result:** PASS')
    )
    expect(createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'success' })
    )
    expect(core.setFailed).not.toHaveBeenCalled()
    // Copilot is stopped in finally
    expect(stopMock).toHaveBeenCalled()
  })

  it('posts failure status when Copilot returns FAIL', async () => {
    mockContext.eventName = 'pull_request'
    mockContext.payload = { pull_request: { html_url: 'https://example/pr/2' } }
    createSession.mockResolvedValue({
      sendAndWait: jest
        .fn()
        .mockResolvedValue({ data: { content: '**Result:** FAIL' } })
    })

    await run()

    expect(createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'failure' })
    )
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('sets failed status when an error occurs', async () => {
    mockContext.eventName = 'pull_request'
    mockContext.payload = { pull_request: { html_url: 'https://example/pr/3' } }
    createSession.mockRejectedValueOnce(new Error('session failed'))

    await run()

    expect(core.setFailed).toHaveBeenCalledWith('session failed')
    // Copilot is stopped even on error
    expect(stopMock).toHaveBeenCalled()
  })

  it('uses custom report path when provided', async () => {
    mockContext.eventName = 'pull_request'
    mockContext.payload = { pull_request: {} }
    // override getInput for this test
    core.getInput.mockImplementation((name: string) => {
      if (name === 'github_token') return 'ghs_123'
      if (name === 'report-path') return 'custom.json'
      return ''
    })

    sendAndWait.mockResolvedValue({ data: { content: 'All good' } })
    createSession.mockResolvedValue({
      sendAndWait
    })

    await run()

    expect(createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'success' })
    )
    // Ensure attachment type is directory with provided path
    expect(sendAndWait).toHaveBeenCalled()
    const args = sendAndWait.mock.calls[0][0]
    expect(args.attachments?.[0]).toEqual(
      expect.objectContaining({ type: 'directory', path: 'custom.json' })
    )
    expect(stopMock).toHaveBeenCalled()
  })

  it('swallows non-Error exceptions without marking failed', async () => {
    mockContext.eventName = 'pull_request'
    mockContext.payload = { pull_request: {} }
    createSession.mockRejectedValueOnce('not-an-error')

    await run()

    expect(core.setFailed).not.toHaveBeenCalled()
    expect(stopMock).toHaveBeenCalled()
  })

  it('treats undefined response as pass via default isPass argument', async () => {
    mockContext.eventName = 'pull_request'
    mockContext.payload = { pull_request: {} }
    createSession.mockResolvedValue({
      sendAndWait: jest.fn().mockResolvedValue(undefined)
    })

    await run()

    expect(createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'success' })
    )
    expect(stopMock).toHaveBeenCalled()
  })

  it('does not create or stop Copilot on non-PR events', async () => {
    mockContext.eventName = 'push'
    await run()
    expect(core.warning).toHaveBeenCalledWith(
      'Esta acción solo se puede ejecutar en eventos de pull request.'
    )
    expect(stopMock).not.toHaveBeenCalled()
  })
})
