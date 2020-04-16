const core = require('@actions/core');
const { Context } = require('@actions/github/lib/context');
const octokit = require('@octokit/graphql');
const queries = require('./graphql');

async function run() {
  try {
    // get the resource from the event
    const context = new Context();
    let resource;
    if (context.payload.issue) {
      resource = context.payload.issue;
    } else if (context.payload.pull_request) {
      resource = context.payload.pull_request;
    }

    // validate the resource
    if (!resource) {
      throw new Error('must run on an issue or pull request');
    }

    // create the regex to find references to mark complete
    const url = resource.html_url.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`^(\\s*)- \\[ \\](\\s+?.*?(${url}|#${resource.number}).*?)$`, 'gm');

    const token = core.getInput('github_token', { required: true });
    const api = octokit.graphql.defaults({
      headers: {
        authorization: `token ${token}`
      }
    });

    // find all matching `- [ ] ...<url> or #<number>...` list items in each of
    // the cross referenced items and replace the [ ] with [x]
    const { node } = await api(queries.GET_CROSSREFERENCED_ITEMS, { id: resource.node_id });
    node.crossReferences.nodes.forEach(async ({ source: reference }) => {
      if (!reference.id) {
        // if the cross reference is to a non issue or PR, skip it
        return;
      }

      // if the body changes from checking boxes, push the changes back to GitHub
      const updatedBody = reference.bodyText.replace(regex, '$1- [x]$2');
      if (updatedBody !== reference.bodyText) {
        await api(queries.UPDATE_ISSUE_BODY, { id: reference.id, body: updatedBody });
      }
    });
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = run;
