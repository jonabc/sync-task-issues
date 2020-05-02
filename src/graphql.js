const fields = `
url
number
crossReferences: timelineItems(first: 100, itemTypes: [CROSS_REFERENCED_EVENT]) {
  nodes {
    ... on CrossReferencedEvent {
      source {
        __typename
        ... on Issue {
          id
          body
        }
        ... on PullRequest {
          id
          body
        }
      }
    }
  }
}
`.trim();

const GET_CROSSREFERENCED_ITEMS = `
query($id: ID!) {
  node(id: $id) {
    ... on Issue {
      ${fields}
    }
    ... on PullRequest {
      ${fields}
    }
  }
}
`.trim();

const UPDATE_ISSUE_BODY = `
mutation updateIssue($id: ID!, $body: String) {
  updateIssue(input: { id: $id, body: $body }) {
    issue {
      id
    }
  }
}
`.trim();

const UPDATE_PULL_REQUEST_BODY = `
mutation updatePullRequest($id: ID!, $body: String) {
  updatePullRequest(input: { pullRequestId: $id, body: $body }) {
    pullRequest {
      id
    }
  }
}
`.trim();

module.exports = {
  GET_CROSSREFERENCED_ITEMS,
  UPDATE_ISSUE_BODY,
  UPDATE_PULL_REQUEST_BODY
};
