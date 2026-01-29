import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { createOrUpdateComment } from '../src/comment.js'

type OctokitMock = {
  rest: {
    issues: {
      listComments: jest.Mock
      updateComment: jest.Mock
      createComment: jest.Mock
    }
  }
}

const makeOctokit = (): OctokitMock => ({
  rest: {
    issues: {
      listComments: jest.fn(),
      updateComment: jest.fn(),
      createComment: jest.fn()
    }
  }
})

const makeContext = () =>
  ({
    issue: { number: 123 },
    repo: { owner: 'owner', repo: 'repo' }
  } as any)

describe('createOrUpdateComment', () => {
  let octokit: OctokitMock
  let context: any

  beforeEach(() => {
    octokit = makeOctokit()
    context = makeContext()
    jest.resetAllMocks()
  })

  it('updates an existing matching bot comment (default actor and marker)', async () => {
    const existingComment = {
      id: 42,
      user: { login: 'CybersecurityGLA' },
      body: 'Previous results <!-- code-quality-validator --> details'
    }
    octokit.rest.issues.listComments.mockResolvedValue({ data: [existingComment] })

    await createOrUpdateComment(octokit as any, context, 'new body')

    expect(octokit.rest.issues.listComments).toHaveBeenCalledWith({
      issue_number: 123,
      owner: 'owner',
      repo: 'repo'
    })

    expect(octokit.rest.issues.updateComment).toHaveBeenCalledTimes(1)
    expect(octokit.rest.issues.updateComment).toHaveBeenCalledWith({
      comment_id: 42,
      owner: 'owner',
      repo: 'repo',
      body: 'new body'
    })
    expect(octokit.rest.issues.createComment).not.toHaveBeenCalled()
  })

  it('creates a new comment when no matching comment exists', async () => {
    octokit.rest.issues.listComments.mockResolvedValue({ data: [] })

    await createOrUpdateComment(octokit as any, context, 'new body')

    expect(octokit.rest.issues.createComment).toHaveBeenCalledTimes(1)
    expect(octokit.rest.issues.createComment).toHaveBeenCalledWith({
      issue_number: 123,
      owner: 'owner',
      repo: 'repo',
      body: 'new body'
    })
    expect(octokit.rest.issues.updateComment).not.toHaveBeenCalled()
  })

  it('updates when using a custom actor and marker', async () => {
    const customActor = 'my-bot'
    const customMarker = '<!-- marker123 -->'
    const matching = {
      id: 7,
      user: { login: customActor },
      body: `Hello ${customMarker} world`
    }
    const nonMatching = {
      id: 8,
      user: { login: 'someone-else' },
      body: 'no marker'
    }
    octokit.rest.issues.listComments.mockResolvedValue({ data: [nonMatching, matching] })

    await createOrUpdateComment(
      octokit as any,
      context,
      'custom body',
      customActor,
      customMarker
    )

    expect(octokit.rest.issues.updateComment).toHaveBeenCalledTimes(1)
    expect(octokit.rest.issues.updateComment).toHaveBeenCalledWith({
      comment_id: 7,
      owner: 'owner',
      repo: 'repo',
      body: 'custom body'
    })
    expect(octokit.rest.issues.createComment).not.toHaveBeenCalled()
  })

  it('creates when actor matches but marker is missing', async () => {
    const sameActorNoMarker = {
      id: 101,
      user: { login: 'CybersecurityGLA' },
      body: 'No marker present here'
    }
    octokit.rest.issues.listComments.mockResolvedValue({ data: [sameActorNoMarker] })

    await createOrUpdateComment(octokit as any, context, 'body-123')

    expect(octokit.rest.issues.updateComment).not.toHaveBeenCalled()
    expect(octokit.rest.issues.createComment).toHaveBeenCalledTimes(1)
    expect(octokit.rest.issues.createComment).toHaveBeenCalledWith({
      issue_number: 123,
      owner: 'owner',
      repo: 'repo',
      body: 'body-123'
    })
  })
})
