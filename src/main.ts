import * as github from '@actions/github'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import { CopilotClient } from '@github/copilot-sdk'
import { SYSTEM_PROMPT_QUALITY } from './prompts.js'
import { createOrUpdateComment } from './comment.js'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  let copilot: CopilotClient | undefined
  try {
    const reportPath: string =
      core.getInput('report-path', { required: false }) || './report'
    const token = core.getInput('github_token', { required: true })
    const model = core.getInput('model', { required: false }) || 'gpt-4o'

    // install github copilot sdk cli
    await exec.exec('npm', ['install', '-g', '@github/copilot-sdk-cli'])
    const octokit = github.getOctokit(token)

    // get pull request context

    // use github copilot to analyze and suggest for the report
    core.info(`Report path: ${reportPath}`)

    if (github.context.eventName !== 'pull_request') {
      // ends gracefully if not a PR event
      core.warning(
        'Esta acción solo se puede ejecutar en eventos de pull request.'
      )
      return
    }
    const pullRequest = github.context.payload.pull_request

    // Default stdio mode; graceful shutdown prevents stream errors
    copilot = new CopilotClient()

    const session = await copilot.createSession({
      model: model,
      systemMessage: {
        mode: 'append',
        content: SYSTEM_PROMPT_QUALITY
      },
      onPermissionRequest: async () => {
        return { kind: 'approved' }
      }
    })

    const response = await session.sendAndWait({
      prompt: `Analyze the linter report located and provide actionable, language-agnostic recommendations to improve the code quality. Focus on readability, maintainability, simplicity, testability, consistency, and documentation. Avoid mentioning security issues. Focus on the changes made in this pull request: ${pullRequest?.html_url}`,
      attachments: [
        {
          type: 'directory',
          path: reportPath
        }
      ]
    })

    core.info(`Copilot response: ${response?.data.content.trim()}`)

    await createOrUpdateComment(
      octokit,
      github.context,
      `${response?.data.content.trim()}`
    )

    await setStatus(
      octokit,
      github.context.repo,
      github.context.sha,
      isPass(response?.data.content.trim()) ? 'success' : 'failure',
      'Code quality analysis completed'
    )
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  } finally {
    // Ensure Copilot resources are cleaned up to avoid stream write errors
    try {
      // Stop the client which destroys active sessions and closes connections
      if (copilot) {
        await copilot.stop()
      }
    } catch {
      // Swallow cleanup errors to avoid masking the primary result
    }
  }
}

function isPass(message: string = ''): boolean {
  return !message.toLowerCase().includes('**result:** fail')
}

async function setStatus(
  octokit: ReturnType<typeof github.getOctokit>,
  repo: { owner: string; repo: string },
  sha: string,
  state: 'success' | 'failure' | 'pending',
  description: string,
  context = 'Jira Issue Validation'
): Promise<void> {
  await octokit.rest.repos.createCommitStatus({
    owner: repo.owner,
    repo: repo.repo,
    sha: sha,
    state: state,
    description: description,
    context // This is the name of the status check
  })
}
