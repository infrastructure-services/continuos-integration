import * as github from '@actions/github'

export async function createOrUpdateComment(
  octokit: ReturnType<typeof github.getOctokit>,
  context: typeof github.context,
  body: string,
  actor = 'CybersecurityGLA',
  commentBody: string = '<!-- code-quality-validator -->'
) {
  const { data: comments } = await octokit.rest.issues.listComments({
    issue_number: context.issue.number,
    owner: context.repo.owner,
    repo: context.repo.repo
  })

  const botComment = comments.find(
    (comment) =>
      comment.user?.login === actor && comment.body?.includes(commentBody)
  )

  if (botComment) {
    // Update the existing comment
    await octokit.rest.issues.updateComment({
      comment_id: botComment.id,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body
    })
  } else {
    // Create a new comment
    await octokit.rest.issues.createComment({
      issue_number: context.issue.number,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body
    })
  }
}
