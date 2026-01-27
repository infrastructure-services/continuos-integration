import {Version3Client} from 'jira.js'

type MakeClient = {
  client: Version3Client
}

export function makeClient(
  host: string,
  jiraEmail: string,
  jiraApiToken: string,
  logger?: (message: string) => void
): MakeClient {
  const client = new Version3Client({
    host,
    authentication: {
      basic: {
        email: jiraEmail,
        apiToken: jiraApiToken
      }
    },
    middlewares: {
      onError: (error: any) => {
        logger?.('--Error--')
        logger?.('Jira Client Error:')
        logger?.(JSON.stringify(error, null, 2))
        logger?.('----')
      },
      onResponse: (response: any) => {
        logger?.('--Response--')
        // You can log responses here if needed for debugging
        logger?.('Jira Client Response:')
        logger?.(JSON.stringify(response, null, 2))
        logger?.('----')
      }
    }
  })

  return {
    client
  }
}

export function isValidIssue(status = ''): boolean {
  const invalidStatuses = ['Implementado', 'Cerrado']
  return !invalidStatuses.includes(status)
}
