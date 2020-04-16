
<p align="center">
  <a href="https://github.com/jonabc/sync-task-issues"><img alt="javscript-action status" src="https://github.com/jonabc/sync-task-issues/workflows/units-test/badge.svg"></a>
</p>

# Mark references to issues and PRs as complete

This GH Action finds checkbox list item cross-references to an issue or pull request from an event and marks the references as complete.

This action uses the GitHub GraphQL API to find references, and updates each reference's body.  The action specifically looks for checkbox list items that are unchecked `- [ ] <any text>(url | #number)<any text>` and marks them complete -> `- [x]`.
