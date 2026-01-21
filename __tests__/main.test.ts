describe('run() in src/main.ts', () => {
  const coreMock = {
    getInput: jest.fn((name: string) => {
      if (name === 'github_token') return 'gh-token'
      if (name === 'jira_email') return 'jira@example.com'
      if (name === 'jira_api_token') return 'jira-token'
      return ''
    }),
    warning: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setFailed: jest.fn(),
    group: jest.fn((title: string, fn: Function) => fn())
  }

  const createCommitStatus = jest.fn().mockResolvedValue({})
  const listCommits = jest.fn().mockResolvedValue({
    data: [{commit: {message: 'chore: update readme'}}, {commit: {message: 'fix: adjust styles'}}]
  })

  const octokitMock = {
    rest: {
      repos: {createCommitStatus},
      pulls: {listCommits}
    }
  }

  let contextMock: any

  const extractIssueKeys = jest.fn(() => new Set<string>())
  const countIssues = jest.fn().mockResolvedValue({count: 0})
  const searchForIssuesUsingJqlEnhancedSearch = jest.fn().mockResolvedValue({issues: []})
  const makeClient = jest.fn(() => ({
    client: {
      issueSearch: {
        countIssues,
        searchForIssuesUsingJqlEnhancedSearch
      }
    }
  }))
  const commentWithValidation = jest.fn().mockResolvedValue(undefined)

  const mockModules = () => {
    jest.doMock('@actions/core', () => coreMock)
    jest.doMock('@actions/github', () => ({
      getOctokit: () => octokitMock,
      context: contextMock
    }))
    jest.doMock('../src/utils', () => ({extractIssueKeys}))
    jest.doMock('../src/jira', () => ({makeClient}))
    jest.doMock('../src/comment', () => ({commentWithValidation}))
  }

  const isolateImportMain = async () => {
    // Import the module (which auto-executes run()) and wait a tick
    await jest.isolateModulesAsync(async () => {
      await import('../src/main')
    })
    await new Promise(resolve => setImmediate(resolve))
  }

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()

    contextMock = {
      eventName: 'pull_request',
      sha: 'abc123',
      repo: {owner: 'infrastructure-services', repo: 'continuos-integration'},
      payload: {
        pull_request: {
          title: 'feat: something nice',
          number: 4,
          base: {sha: 'base-sha'},
          head: {ref: 'feature-branch'}
        }
      }
    }
  })

  test('exits gracefully when event is not pull_request', async () => {
    contextMock.eventName = 'push'
    mockModules()

    await isolateImportMain()

    expect(coreMock.warning).toHaveBeenCalledWith('Esta acción solo se puede ejecutar en eventos de pull request.')
    expect(createCommitStatus).not.toHaveBeenCalled()
  })

  test('sets failure when no Jira issues are found', async () => {
    // Ensure no issues found
    extractIssueKeys.mockReturnValueOnce(new Set())
    mockModules()

    await isolateImportMain()

    // First pending, then failure
    expect(createCommitStatus).toHaveBeenCalledTimes(2)
    expect(createCommitStatus.mock.calls[0][0]).toMatchObject({
      state: 'pending',
      description: 'Analizando pull request para issues de Jira'
    })
    expect(createCommitStatus.mock.calls[1][0]).toMatchObject({
      state: 'failure',
      description: 'No se encontraron claves de issues de Jira en los commits o en el título del PR.'
    })
  })

  test('sets success when Jira issues exist', async () => {
    // Found issues
    extractIssueKeys.mockReturnValueOnce(new Set(['ACP-123']))
    // Jira returns count 1
    countIssues.mockResolvedValueOnce({count: 1})
    searchForIssuesUsingJqlEnhancedSearch.mockResolvedValueOnce({
      issues: [{key: 'ACP-123', fields: {summary: 'something', status: {name: 'Open'}}}]
    })
    mockModules()

    await isolateImportMain()

    // pending then success
    expect(createCommitStatus).toHaveBeenCalledTimes(2)
    expect(createCommitStatus.mock.calls[0][0]).toMatchObject({state: 'pending'})
    expect(createCommitStatus.mock.calls[1][0]).toMatchObject({
      state: 'success',
      description: 'Se encontraron 1 issues [ACP-123]'
    })

    // comment invoked with PR title and branch name
    expect(commentWithValidation).toHaveBeenCalledWith('feat: something nice', 'feature-branch', expect.any(Object))
  })

  test('sets failure when Jira returns zero matches', async () => {
    extractIssueKeys.mockReturnValueOnce(new Set(['ACP-123']))
    countIssues.mockResolvedValueOnce({count: 0})
    searchForIssuesUsingJqlEnhancedSearch.mockResolvedValueOnce({issues: []})
    mockModules()

    await isolateImportMain()

    expect(createCommitStatus).toHaveBeenCalledTimes(2)
    expect(createCommitStatus.mock.calls[1][0]).toMatchObject({
      state: 'failure',
      description: 'No se encontraron issues de Jira válidos y activos.'
    })
  })
})
