import * as core from '@actions/core'
import * as github from '@actions/github'

import {makeClient} from './jira'
import {extractIssueKeys} from './utils'
import {commentWithValidation, OctokitWithPlugins} from './comment'

export async function run(): Promise<void> {
  const token = core.getInput('github_token', {required: true})
  const jiraHost = 'https://andreani.atlassian.net'
  const jiraEmail = core.getInput('jira_email', {required: true})
  const jiraApiToken = core.getInput('jira_api_token', {required: true})
  const octokit = github.getOctokit(token)

  if (github.context.eventName !== 'pull_request') {
    // ends gracefully if not a PR event
    core.warning('Esta acción solo se puede ejecutar en eventos de pull request.')
    return
  }

  const sha = github.context.sha // Commit SHA for the status check
  const repo = github.context.repo
  const branchName = github.context.payload.pull_request?.head?.ref

  await setStatus(octokit, repo, sha, 'pending', 'Analizando pull request para issues de Jira')

  try {
    const prTitle = github.context.payload.pull_request?.title
    const prNumber = github.context.payload.pull_request?.number
    const baseSha = github.context.payload.pull_request?.base?.sha || 'HEAD~1'
    const headSha = 'HEAD'

    core.info(`PR #${prNumber}: ${prTitle}`)

    if (!baseSha || !headSha) {
      core.warning('Base or Head SHA is missing in the pull request payload.')
      await setStatus(octokit, repo, sha, 'failure', 'Base or Head SHA is missing.')
      return
    }

    const {data: commits} = await octokit.rest.pulls.listCommits({
      owner: repo.owner,
      repo: repo.repo,
      pull_number: prNumber || 0,
      per_page: 100
    })

    const commitMessages = commits.map(commit => commit.commit.message)

    if (prTitle) {
      commitMessages.push(prTitle)
    }
    const issues = extractIssueKeys(commitMessages)

    core.info(`Found issues: ${Array.from(issues).join(', ')}`)

    if (issues.size === 0) {
      core.info('No se encontraron claves de issues de Jira en los commits o en el título del PR.')
      await setStatus(
        octokit,
        repo,
        sha,
        'failure',
        'No se encontraron claves de issues de Jira en los commits o en el título del PR.'
      )
      return
    }

    const {client} = makeClient(jiraHost, jiraEmail, jiraApiToken, core.debug)

    if (!client) {
      core.error('No se pudo crear el cliente de Jira. Por favor, verifica tu configuración.')
      await setStatus(octokit, repo, sha, 'failure', 'No se pudo crear el cliente de Jira.')
      return
    }

    let count = 0

    try {
      const data = await client.issueSearch.countIssues({
        jql: `issue in (${Array.from(issues).join(', ')})`
      })
      count = data?.count || 0
    } catch (error) {
      await setStatus(octokit, repo, sha, 'failure', 'Ha ocurrido un error al consultar los issues en Jira.')
      console.error('Error obteniendo los issues en JIRA:', getErrorMessage(error))
      return
    }

    if (count === 0) {
      await setStatus(
        octokit,
        repo,
        sha,
        'failure',
        'No se encontraron issues de Jira coincidentes. Recuerda que los issues deben existir en Jira y deben estar activos'
      )
    } else {
      core.info(`Se encontraron ${count} issues de Jira.`)
      await setStatus(octokit, repo, sha, 'success', `Se encontraron ${count} issues de Jira.`)
    }

    await commentWithValidation(prTitle || '', branchName || '', octokit as unknown as OctokitWithPlugins)
  } catch (error) {
    await setStatus(octokit, repo, sha, 'failure', 'Ha ocurrido un error al procesar el pull request.')
    core.setFailed(getErrorMessage(error))
  }
}

async function setStatus(
  octokit: ReturnType<typeof github.getOctokit>,
  repo: {owner: string; repo: string},
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

run()
