const fields = `
url
number
crossReferences: timelineItems(first: 100, itemTypes: [CROSS_REFERENCED_EVENT]) {
  nodes {
    ... on CrossReferencedEvent {
      source {
        ... on Issue {
          id
          bodyText
        }
        ... on PullRequest {
          id
          bodyText
        }
      }
    }
  }
}
`.trim();

const GET_CROSSREFERENCED_ITEMS = `
query($id: ID!) {
  node(id: id) {
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
  addProjectCard(input: { id: $id, body: $body }) {
    issue {
      id
    }
  }
}
`.trim();

module.exports = {
  GET_CROSSREFERENCED_ITEMS,
  UPDATE_ISSUE_BODY
};
