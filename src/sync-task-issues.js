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

    let state = core.getInput('state');
    if (!['complete', 'incomplete'].includes(state)) {
      state = context.payload.action === 'reopened' ? 'incomplete' : 'complete';
    }

    core.setOutput('mark_references_as', state);

    // determine whether to mark items as checked or not and craft
    // search and replacement values to use in String.replace
    const find = state === 'complete' ? ' ' : 'x';
    const replace = state === 'complete' ? 'x' : ' ';
    const url = resource.html_url.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const findRegex = new RegExp(`^(\\s*)- \\[${find}\\](\\s+?.*?(${url}|#${resource.number}).*?)$`, 'gm');
    const replaceString = `$1- [${replace}]$2`;

    const token = core.getInput('github_token', { required: true });
    const api = octokit.graphql.defaults({
      headers: {
        authorization: `token ${token}`
      }
    });

    // find all matching `- [ ] ...<url> or #<number>...` list items in each of
    // the cross referenced items and replace the [ ] with [x]
    const { node } = await api(queries.GET_CROSSREFERENCED_ITEMS, { id: resource.node_id });
    const references = node.crossReferences.nodes;
    core.info(`found ${references.length} references`);

    const updated = [];
    for (let i = 0; i < references.length; i += 1) {
      const { source: reference } = references[i];
      if (!reference.id) {
        // if the cross reference is to a non issue or PR, skip it
        return;
      }

      // if the body changes from checking boxes, push the changes back to GitHub
      const updatedBody = reference.body.replace(findRegex, replaceString);
      if (updatedBody !== reference.body) {
        core.info(`updating ${reference.__typename} ${reference.id}`);
        if (reference.__typename === 'Issue') {
          // eslint-disable-next-line no-await-in-loop
          await api(queries.UPDATE_ISSUE_BODY, { id: reference.id, body: updatedBody });
        } else if (reference.__typename === 'PullRequest') {
          // eslint-disable-next-line no-await-in-loop
          await api(queries.UPDATE_PULL_REQUEST_BODY, { id: reference.id, body: updatedBody });
        }
        updated.push(`${reference.__typename}:${reference.id}`);
      }
    }

    core.setOutput('references', JSON.stringify(references));
    core.setOutput('updated', JSON.stringify(updated));
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = run;
