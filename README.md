
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


## Usage

Create a YAML file in the `.github/workflows` folder of your repository with the following content:

```yml
name: Cross off linked issues
on:
  issues:
    types: [closed]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Cross of any linked issues
        uses: jonabc/sync-task-issues@v1
```

## Required permissions

The default ${{ secrets.GITHUB_TOKEN }} token can be used only when both the closed issues or PRs and their references are in the same repo.

For cross-repo references, a personal access token with `repo` access is needed from a user account that can `write`to the all repositories containing references.


tests
