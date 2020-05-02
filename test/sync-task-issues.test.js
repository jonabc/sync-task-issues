const core = require('@actions/core');
const octokit = require('@octokit/graphql');
const { Context } = require('@actions/github/lib/context');
const sinon = require('sinon');
const { readFileSync } = require('fs');
const { resolve: resolvePath } = require('path');

const run = require('../src/sync-task-issues');
const queries = require('../src/graphql');

describe('sync-task-issues', () => {
  const processEnv = process.env;
  const token = 'token';
  let api;
  let response;
  let context;

  beforeEach(() => {
    process.env = {
      ...process.env,
      INPUT_GITHUB_TOKEN: token
    };

    sinon.stub(core, 'setFailed');
    sinon.stub(core, 'info');

    // eslint-disable-next-line global-require
    response = JSON.parse(
      readFileSync(resolvePath(__dirname, './fixtures/cross-reference-query-response.json'), { encoding: 'utf8' })
    );
    api = sinon
      .stub()
      .withArgs(queries.GET_CROSSREFERENCED_ITEMS)
      .resolves(response);
    sinon.stub(octokit.graphql, 'defaults').returns(api);
  });

  afterEach(() => {
    process.env = processEnv;
    sinon.restore();
  });

  it("raises an error if the event doesn't contain an issue or PR", async () => {
    delete process.env.GITHUB_EVENT_PATH;
    await run();

    expect(core.setFailed.callCount).toEqual(1);
    expect(core.setFailed.getCall(0).args).toEqual(['must run on an issue or pull request']);
  });

  describe('with an issue event', () => {
    beforeEach(() => {
      process.env = {
        ...process.env,
        GITHUB_EVENT_PATH: resolvePath(__dirname, './fixtures/issue-event.json')
      };

      context = new Context();
    });

    it("raises an error if github_token isn't provided", async () => {
      delete process.env.INPUT_GITHUB_TOKEN;
      await run();

      expect(core.setFailed.callCount).toEqual(1);
      expect(core.setFailed.getCall(0).args).toEqual(['Input required and not supplied: github_token']);
    });

    it('noops for no cross references', async () => {
      await run();

      expect(octokit.graphql.defaults.callCount).toEqual(1);
      expect(octokit.graphql.defaults.getCall(0).args).toEqual([{ headers: { authorization: `token ${token}` } }]);

      expect(api.callCount).toEqual(1);
      expect(api.getCall(0).args).toEqual([queries.GET_CROSSREFERENCED_ITEMS, { id: context.payload.issue.node_id }]);

      expect(core.setFailed.callCount).toEqual(0);
    });

    it('marks matching incomplete checkbox list references as complete', async () => {
      const originalBody = `
  - [ ] [in markdown link](${context.payload.issue.html_url})
  - [ ] standalone with url ${context.payload.issue.html_url}
  - [ ] standalone with number #${context.payload.issue.number}
     - [ ] with leading whitespace ${context.payload.issue.html_url}
  - [x] already checked ${context.payload.issue.html_url}
  - [ ] no match [in markdown link](https://github.com/jonabc/sync-text-issues/issues/no-match)
  - [ ] no match with url https://github.com/jonabc/sync-text-issues/issues/no-match
  - [ ] no match with number #no-match
      `.trim();

      const expectedBody = `
  - [x] [in markdown link](${context.payload.issue.html_url})
  - [x] standalone with url ${context.payload.issue.html_url}
  - [x] standalone with number #${context.payload.issue.number}
     - [x] with leading whitespace ${context.payload.issue.html_url}
  - [x] already checked ${context.payload.issue.html_url}
  - [ ] no match [in markdown link](https://github.com/jonabc/sync-text-issues/issues/no-match)
  - [ ] no match with url https://github.com/jonabc/sync-text-issues/issues/no-match
  - [ ] no match with number #no-match
      `.trim();

      response.node.crossReferences.nodes = [
        {
          source: {
            id: 'source-1',
            body: originalBody
          }
        },
        {
          source: {
            id: 'source-2',
            body: originalBody
          }
        }
      ];

      await run();

      expect(octokit.graphql.defaults.callCount).toEqual(1);
      expect(octokit.graphql.defaults.getCall(0).args).toEqual([{ headers: { authorization: `token ${token}` } }]);

      expect(api.callCount).toEqual(3);
      expect(api.getCall(0).args).toEqual([queries.GET_CROSSREFERENCED_ITEMS, { id: context.payload.issue.node_id }]);
      expect(api.getCall(1).args).toEqual([
        queries.UPDATE_ISSUE_BODY,
        { id: response.node.crossReferences.nodes[0].source.id, body: expectedBody }
      ]);
      expect(api.getCall(2).args).toEqual([
        queries.UPDATE_ISSUE_BODY,
        { id: response.node.crossReferences.nodes[1].source.id, body: expectedBody }
      ]);

      expect(core.setFailed.callCount).toEqual(0);
    });

    it('marks matching complete checkbox list references as incomplete for reopened event', async () => {
      process.env.GITHUB_EVENT_PATH = resolvePath(__dirname, './fixtures/issue-reopened-event.json');
      const originalBody = `
  - [ ] [in markdown link](${context.payload.issue.html_url})
  - [ ] standalone with url ${context.payload.issue.html_url}
  - [ ] standalone with number #${context.payload.issue.number}
     - [ ] with leading whitespace ${context.payload.issue.html_url}
  - [x] already checked ${context.payload.issue.html_url}
  - [ ] no match [in markdown link](https://github.com/jonabc/sync-text-issues/issues/no-match)
  - [ ] no match with url https://github.com/jonabc/sync-text-issues/issues/no-match
  - [ ] no match with number #no-match
      `.trim();

      const expectedBody = `
  - [ ] [in markdown link](${context.payload.issue.html_url})
  - [ ] standalone with url ${context.payload.issue.html_url}
  - [ ] standalone with number #${context.payload.issue.number}
     - [ ] with leading whitespace ${context.payload.issue.html_url}
  - [ ] already checked ${context.payload.issue.html_url}
  - [ ] no match [in markdown link](https://github.com/jonabc/sync-text-issues/issues/no-match)
  - [ ] no match with url https://github.com/jonabc/sync-text-issues/issues/no-match
  - [ ] no match with number #no-match
      `.trim();

      response.node.crossReferences.nodes = [
        {
          source: {
            id: 'source-1',
            body: originalBody
          }
        },
        {
          source: {
            id: 'source-2',
            body: originalBody
          }
        }
      ];

      await run();

      expect(octokit.graphql.defaults.callCount).toEqual(1);
      expect(octokit.graphql.defaults.getCall(0).args).toEqual([{ headers: { authorization: `token ${token}` } }]);

      expect(api.callCount).toEqual(3);
      expect(api.getCall(0).args).toEqual([queries.GET_CROSSREFERENCED_ITEMS, { id: context.payload.issue.node_id }]);
      expect(api.getCall(1).args).toEqual([
        queries.UPDATE_ISSUE_BODY,
        { id: response.node.crossReferences.nodes[0].source.id, body: expectedBody }
      ]);
      expect(api.getCall(2).args).toEqual([
        queries.UPDATE_ISSUE_BODY,
        { id: response.node.crossReferences.nodes[1].source.id, body: expectedBody }
      ]);

      expect(core.setFailed.callCount).toEqual(0);
    });

    it('marks matching incomplete checkbox list references as complete for complete state input', async () => {
      process.env.INPUT_STATE = 'complete';
      process.env.GITHUB_EVENT_PATH = resolvePath(__dirname, './fixtures/issue-reopened-event.json');

      const originalBody = `
  - [ ] [in markdown link](${context.payload.issue.html_url})
  - [ ] standalone with url ${context.payload.issue.html_url}
  - [ ] standalone with number #${context.payload.issue.number}
     - [ ] with leading whitespace ${context.payload.issue.html_url}
  - [x] already checked ${context.payload.issue.html_url}
  - [ ] no match [in markdown link](https://github.com/jonabc/sync-text-issues/issues/no-match)
  - [ ] no match with url https://github.com/jonabc/sync-text-issues/issues/no-match
  - [ ] no match with number #no-match
      `.trim();

      const expectedBody = `
  - [x] [in markdown link](${context.payload.issue.html_url})
  - [x] standalone with url ${context.payload.issue.html_url}
  - [x] standalone with number #${context.payload.issue.number}
     - [x] with leading whitespace ${context.payload.issue.html_url}
  - [x] already checked ${context.payload.issue.html_url}
  - [ ] no match [in markdown link](https://github.com/jonabc/sync-text-issues/issues/no-match)
  - [ ] no match with url https://github.com/jonabc/sync-text-issues/issues/no-match
  - [ ] no match with number #no-match
      `.trim();

      response.node.crossReferences.nodes = [
        {
          source: {
            id: 'source-1',
            body: originalBody
          }
        },
        {
          source: {
            id: 'source-2',
            body: originalBody
          }
        }
      ];

      await run();

      expect(octokit.graphql.defaults.callCount).toEqual(1);
      expect(octokit.graphql.defaults.getCall(0).args).toEqual([{ headers: { authorization: `token ${token}` } }]);

      expect(api.callCount).toEqual(3);
      expect(api.getCall(0).args).toEqual([queries.GET_CROSSREFERENCED_ITEMS, { id: context.payload.issue.node_id }]);
      expect(api.getCall(1).args).toEqual([
        queries.UPDATE_ISSUE_BODY,
        { id: response.node.crossReferences.nodes[0].source.id, body: expectedBody }
      ]);
      expect(api.getCall(2).args).toEqual([
        queries.UPDATE_ISSUE_BODY,
        { id: response.node.crossReferences.nodes[1].source.id, body: expectedBody }
      ]);

      expect(core.setFailed.callCount).toEqual(0);
    });

    it('marks matching complete checkbox list references as incomplete for incomplete state input', async () => {
      process.env.INPUT_STATE = 'incomplete';

      const originalBody = `
  - [ ] [in markdown link](${context.payload.issue.html_url})
  - [ ] standalone with url ${context.payload.issue.html_url}
  - [ ] standalone with number #${context.payload.issue.number}
     - [ ] with leading whitespace ${context.payload.issue.html_url}
  - [x] already checked ${context.payload.issue.html_url}
  - [ ] no match [in markdown link](https://github.com/jonabc/sync-text-issues/issues/no-match)
  - [ ] no match with url https://github.com/jonabc/sync-text-issues/issues/no-match
  - [ ] no match with number #no-match
      `.trim();

      const expectedBody = `
  - [ ] [in markdown link](${context.payload.issue.html_url})
  - [ ] standalone with url ${context.payload.issue.html_url}
  - [ ] standalone with number #${context.payload.issue.number}
     - [ ] with leading whitespace ${context.payload.issue.html_url}
  - [ ] already checked ${context.payload.issue.html_url}
  - [ ] no match [in markdown link](https://github.com/jonabc/sync-text-issues/issues/no-match)
  - [ ] no match with url https://github.com/jonabc/sync-text-issues/issues/no-match
  - [ ] no match with number #no-match
      `.trim();

      response.node.crossReferences.nodes = [
        {
          source: {
            id: 'source-1',
            body: originalBody
          }
        },
        {
          source: {
            id: 'source-2',
            body: originalBody
          }
        }
      ];

      await run();

      expect(octokit.graphql.defaults.callCount).toEqual(1);
      expect(octokit.graphql.defaults.getCall(0).args).toEqual([{ headers: { authorization: `token ${token}` } }]);

      expect(api.callCount).toEqual(3);
      expect(api.getCall(0).args).toEqual([queries.GET_CROSSREFERENCED_ITEMS, { id: context.payload.issue.node_id }]);
      expect(api.getCall(1).args).toEqual([
        queries.UPDATE_ISSUE_BODY,
        { id: response.node.crossReferences.nodes[0].source.id, body: expectedBody }
      ]);
      expect(api.getCall(2).args).toEqual([
        queries.UPDATE_ISSUE_BODY,
        { id: response.node.crossReferences.nodes[1].source.id, body: expectedBody }
      ]);

      expect(core.setFailed.callCount).toEqual(0);
    });
  });

  describe('with a pull request event', () => {
    beforeEach(() => {
      process.env = {
        ...process.env,
        GITHUB_EVENT_PATH: resolvePath(__dirname, './fixtures/pull-request-event.json')
      };

      context = new Context();
    });

    it("raises an error if github_token isn't provided", async () => {
      delete process.env.INPUT_GITHUB_TOKEN;
      await run();

      expect(core.setFailed.callCount).toEqual(1);
      expect(core.setFailed.getCall(0).args).toEqual(['Input required and not supplied: github_token']);
    });

    it('noops for no cross references', async () => {
      await run();

      expect(octokit.graphql.defaults.callCount).toEqual(1);
      expect(octokit.graphql.defaults.getCall(0).args).toEqual([{ headers: { authorization: `token ${token}` } }]);

      expect(api.callCount).toEqual(1);
      expect(api.getCall(0).args).toEqual([
        queries.GET_CROSSREFERENCED_ITEMS,
        { id: context.payload.pull_request.node_id }
      ]);

      expect(core.setFailed.callCount).toEqual(0);
    });

    it('marks matching incomplete checkbox list references to pull request as complete', async () => {
      const originalBody = `
  - [ ] [in markdown link](${context.payload.pull_request.html_url})
  - [ ] standalone with url ${context.payload.pull_request.html_url}
  - [ ] standalone with number #${context.payload.pull_request.number}
   - [ ] with leading whitespace ${context.payload.pull_request.html_url}
  - [x] already checked ${context.payload.pull_request.html_url}
  - [ ] no match [in markdown link](https://github.com/jonabc/sync-text-issues/issues/no-match)
  - [ ] no match with url https://github.com/jonabc/sync-text-issues/issues/no-match
  - [ ] no match with number #no-match
      `.trim();

      const expectedBody = `
  - [x] [in markdown link](${context.payload.pull_request.html_url})
  - [x] standalone with url ${context.payload.pull_request.html_url}
  - [x] standalone with number #${context.payload.pull_request.number}
   - [x] with leading whitespace ${context.payload.pull_request.html_url}
  - [x] already checked ${context.payload.pull_request.html_url}
  - [ ] no match [in markdown link](https://github.com/jonabc/sync-text-issues/issues/no-match)
  - [ ] no match with url https://github.com/jonabc/sync-text-issues/issues/no-match
  - [ ] no match with number #no-match
      `.trim();

      response.node.crossReferences.nodes = [
        {
          source: {
            id: 'source-1',
            body: originalBody
          }
        },
        {
          source: {
            id: 'source-2',
            body: originalBody
          }
        }
      ];

      await run();

      expect(octokit.graphql.defaults.callCount).toEqual(1);
      expect(octokit.graphql.defaults.getCall(0).args).toEqual([{ headers: { authorization: `token ${token}` } }]);

      expect(api.callCount).toEqual(3);
      expect(api.getCall(0).args).toEqual([
        queries.GET_CROSSREFERENCED_ITEMS,
        { id: context.payload.pull_request.node_id }
      ]);
      expect(api.getCall(1).args).toEqual([
        queries.UPDATE_ISSUE_BODY,
        { id: response.node.crossReferences.nodes[0].source.id, body: expectedBody }
      ]);
      expect(api.getCall(2).args).toEqual([
        queries.UPDATE_ISSUE_BODY,
        { id: response.node.crossReferences.nodes[1].source.id, body: expectedBody }
      ]);

      expect(core.setFailed.callCount).toEqual(0);
    });

    it('marks matching complete checkbox list references as incomplete for reopened event', async () => {
      process.env.GITHUB_EVENT_PATH = resolvePath(__dirname, './fixtures/pull-request-reopened-event.json');
      const originalBody = `
  - [ ] [in markdown link](${context.payload.pull_request.html_url})
  - [ ] standalone with url ${context.payload.pull_request.html_url}
  - [ ] standalone with number #${context.payload.pull_request.number}
     - [ ] with leading whitespace ${context.payload.pull_request.html_url}
  - [x] already checked ${context.payload.pull_request.html_url}
  - [ ] no match [in markdown link](https://github.com/jonabc/sync-text-issues/issues/no-match)
  - [ ] no match with url https://github.com/jonabc/sync-text-issues/issues/no-match
  - [ ] no match with number #no-match
      `.trim();

      const expectedBody = `
  - [ ] [in markdown link](${context.payload.pull_request.html_url})
  - [ ] standalone with url ${context.payload.pull_request.html_url}
  - [ ] standalone with number #${context.payload.pull_request.number}
     - [ ] with leading whitespace ${context.payload.pull_request.html_url}
  - [ ] already checked ${context.payload.pull_request.html_url}
  - [ ] no match [in markdown link](https://github.com/jonabc/sync-text-issues/issues/no-match)
  - [ ] no match with url https://github.com/jonabc/sync-text-issues/issues/no-match
  - [ ] no match with number #no-match
      `.trim();

      response.node.crossReferences.nodes = [
        {
          source: {
            id: 'source-1',
            body: originalBody
          }
        },
        {
          source: {
            id: 'source-2',
            body: originalBody
          }
        }
      ];

      await run();

      expect(octokit.graphql.defaults.callCount).toEqual(1);
      expect(octokit.graphql.defaults.getCall(0).args).toEqual([{ headers: { authorization: `token ${token}` } }]);

      expect(api.callCount).toEqual(3);
      expect(api.getCall(0).args).toEqual([
        queries.GET_CROSSREFERENCED_ITEMS,
        { id: context.payload.pull_request.node_id }
      ]);
      expect(api.getCall(1).args).toEqual([
        queries.UPDATE_ISSUE_BODY,
        { id: response.node.crossReferences.nodes[0].source.id, body: expectedBody }
      ]);
      expect(api.getCall(2).args).toEqual([
        queries.UPDATE_ISSUE_BODY,
        { id: response.node.crossReferences.nodes[1].source.id, body: expectedBody }
      ]);

      expect(core.setFailed.callCount).toEqual(0);
    });

    it('marks matching incomplete checkbox list references as complete for complete state input', async () => {
      process.env.INPUT_STATE = 'complete';
      process.env.GITHUB_EVENT_PATH = resolvePath(__dirname, './fixtures/pull-request-reopened-event.json');

      const originalBody = `
  - [ ] [in markdown link](${context.payload.pull_request.html_url})
  - [ ] standalone with url ${context.payload.pull_request.html_url}
  - [ ] standalone with number #${context.payload.pull_request.number}
     - [ ] with leading whitespace ${context.payload.pull_request.html_url}
  - [x] already checked ${context.payload.pull_request.html_url}
  - [ ] no match [in markdown link](https://github.com/jonabc/sync-text-issues/issues/no-match)
  - [ ] no match with url https://github.com/jonabc/sync-text-issues/issues/no-match
  - [ ] no match with number #no-match
      `.trim();

      const expectedBody = `
  - [x] [in markdown link](${context.payload.pull_request.html_url})
  - [x] standalone with url ${context.payload.pull_request.html_url}
  - [x] standalone with number #${context.payload.pull_request.number}
     - [x] with leading whitespace ${context.payload.pull_request.html_url}
  - [x] already checked ${context.payload.pull_request.html_url}
  - [ ] no match [in markdown link](https://github.com/jonabc/sync-text-issues/issues/no-match)
  - [ ] no match with url https://github.com/jonabc/sync-text-issues/issues/no-match
  - [ ] no match with number #no-match
      `.trim();

      response.node.crossReferences.nodes = [
        {
          source: {
            id: 'source-1',
            body: originalBody
          }
        },
        {
          source: {
            id: 'source-2',
            body: originalBody
          }
        }
      ];

      await run();

      expect(octokit.graphql.defaults.callCount).toEqual(1);
      expect(octokit.graphql.defaults.getCall(0).args).toEqual([{ headers: { authorization: `token ${token}` } }]);

      expect(api.callCount).toEqual(3);
      expect(api.getCall(0).args).toEqual([
        queries.GET_CROSSREFERENCED_ITEMS,
        { id: context.payload.pull_request.node_id }
      ]);
      expect(api.getCall(1).args).toEqual([
        queries.UPDATE_ISSUE_BODY,
        { id: response.node.crossReferences.nodes[0].source.id, body: expectedBody }
      ]);
      expect(api.getCall(2).args).toEqual([
        queries.UPDATE_ISSUE_BODY,
        { id: response.node.crossReferences.nodes[1].source.id, body: expectedBody }
      ]);

      expect(core.setFailed.callCount).toEqual(0);
    });

    it('marks matching complete checkbox list references as incomplete for incomplete state input', async () => {
      process.env.INPUT_STATE = 'incomplete';

      const originalBody = `
  - [ ] [in markdown link](${context.payload.pull_request.html_url})
  - [ ] standalone with url ${context.payload.pull_request.html_url}
  - [ ] standalone with number #${context.payload.pull_request.number}
     - [ ] with leading whitespace ${context.payload.pull_request.html_url}
  - [x] already checked ${context.payload.pull_request.html_url}
  - [ ] no match [in markdown link](https://github.com/jonabc/sync-text-issues/issues/no-match)
  - [ ] no match with url https://github.com/jonabc/sync-text-issues/issues/no-match
  - [ ] no match with number #no-match
      `.trim();

      const expectedBody = `
  - [ ] [in markdown link](${context.payload.pull_request.html_url})
  - [ ] standalone with url ${context.payload.pull_request.html_url}
  - [ ] standalone with number #${context.payload.pull_request.number}
     - [ ] with leading whitespace ${context.payload.pull_request.html_url}
  - [ ] already checked ${context.payload.pull_request.html_url}
  - [ ] no match [in markdown link](https://github.com/jonabc/sync-text-issues/issues/no-match)
  - [ ] no match with url https://github.com/jonabc/sync-text-issues/issues/no-match
  - [ ] no match with number #no-match
      `.trim();

      response.node.crossReferences.nodes = [
        {
          source: {
            id: 'source-1',
            body: originalBody
          }
        },
        {
          source: {
            id: 'source-2',
            body: originalBody
          }
        }
      ];

      await run();

      expect(octokit.graphql.defaults.callCount).toEqual(1);
      expect(octokit.graphql.defaults.getCall(0).args).toEqual([{ headers: { authorization: `token ${token}` } }]);

      expect(api.callCount).toEqual(3);
      expect(api.getCall(0).args).toEqual([
        queries.GET_CROSSREFERENCED_ITEMS,
        { id: context.payload.pull_request.node_id }
      ]);
      expect(api.getCall(1).args).toEqual([
        queries.UPDATE_ISSUE_BODY,
        { id: response.node.crossReferences.nodes[0].source.id, body: expectedBody }
      ]);
      expect(api.getCall(2).args).toEqual([
        queries.UPDATE_ISSUE_BODY,
        { id: response.node.crossReferences.nodes[1].source.id, body: expectedBody }
      ]);

      expect(core.setFailed.callCount).toEqual(0);
    });
  });
});
