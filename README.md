
<p align="center">
  <a href="https://github.com/jonabc/sync-task-issues"><img alt="javscript-action status" src="https://github.com/jonabc/sync-task-issues/workflows/units-test/badge.svg"></a>
</p>

# Mark references to issues and PRs as complete

This GH Action finds checkbox list item cross-references to an issue or pull request from an event and marks the references as complete.

This action uses the GitHub GraphQL API to find references, and updates each reference's body.  The action looks for checkbox list items that are unchecked and marks them completed

```markdown
- [ ] <any text>(url | #number)<any text>

becomes

- [x] <any text>(url | #number)<any text>
```

When an issue or PR which is referenced as a checkbox list item is reopened, the action will mark all references as incomplete.

```markdown
- [x] <any text>(url | #number)<any text>

becomes

- [ ] <any text>(url | #number)<any text>
```

## Usage

Create a YAML file in the `.github/workflows` folder of your repository with the following content:

```yml
name: Cross off linked issues
on:
  # the closed event type causes unchecked checkbox references to be checked / marked complete
  # the reopened event type causes checked checkbox references to be unchecked / marked incomplete
  issues:
    types: [closed, reopened]

  # the action works on pull request events as well
  pull_requests:
    types: [closed, reopened]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Cross of any linked issue and PR references
        uses: jonabc/sync-task-issues@v1
```

### State input

A `state` input is available to explicitly configure whether to mark references as complete or incomplete when the action is triggered.  Available values are `complete` and `incomplete`.

## Required permissions

The default ${{ secrets.GITHUB_TOKEN }} token can be used only when both the closed issues or PRs and their references are in the same repo.

For cross-repo references, a personal access token with `repo` access is needed from a user account that can `write` to the all repositories containing references.
