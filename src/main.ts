import * as core from '@actions/core'
import * as github from '@actions/github'
import { CopilotClient } from '@github/copilot-sdk'
import { createOrUpdateComment } from './comment.js'
import { SYSTEM_PROMPT_QUALITY } from './prompts.js'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const reportPath: string =
      core.getInput('report-path', { required: false }) || './report.json'
    const token = core.getInput('github_token', { required: true })

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

    const copilot = new CopilotClient()

    const session = await copilot.createSession({
      model: 'gpt-4o',
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
          type: 'file',
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
