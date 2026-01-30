import * as github from '@actions/github'
import * as core from '@actions/core'
import { createOrUpdateComment } from './comment.js'
import { collectSummaries, pathExists, renderComment } from './analyze.js'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const reportPath: string =
      core.getInput('report-path', { required: false }) || './report'
    const token = core.getInput('github_token', { required: true })

    // install github copilot sdk cli
    const octokit = github.getOctokit(token)

    // get pull request context
    // assign github copilot to pull request

    // use github copilot to analyze and suggest for the report
    core.info(`Report path: ${reportPath}`)

    if (github.context.eventName !== 'pull_request') {
      // ends gracefully if not a PR event
      core.warning(
        'Esta acción solo se puede ejecutar en eventos de pull request.'
      )
      return
    }

    if (!(await pathExists(reportPath))) {
      await createOrUpdateComment(
        octokit,
        github.context,
        `Report path not found: ${reportPath}`
      )
      await setStatus(
        octokit,
        github.context.repo,
        github.context.sha,
        'failure',
        'Report path not found'
      )
      return
    }

    const { summaries, totals } = await collectSummaries(reportPath)
    const body = renderComment(summaries, totals)
    await createOrUpdateComment(octokit, github.context, body)
    await setStatus(
      octokit,
      github.context.repo,
      github.context.sha,
      totals.errors > 0 ? 'failure' : 'success',
      totals.errors > 0
        ? 'Blocking quality issues detected'
        : 'No blocking quality issues'
    )
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function setStatus(
  octokit: ReturnType<typeof github.getOctokit>,
  repo: { owner: string; repo: string },
  sha: string,
  state: 'success' | 'failure' | 'pending',
  description: string,
  context = 'Agent Code Quality Check'
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
