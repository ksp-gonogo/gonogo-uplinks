# CLAUDE.md

## Branches and landing

`main` is this repository's integration branch and the correct place for finished work to land. There is no `staging` branch and no pull-request step: the operator's standing instruction (2026-09-29) is that Uplink and docs work is committed and pushed straight to `main` once its gates pass. Rebasing a local branch onto `origin/main` and pushing it to `main` is the normal landing, not a merge that skips review.

- Work in your own worktree (`git worktree add ../<repo>-<ticket> -b dev/<ticket> origin/main`), never in a checkout another agent is using
- Rebase onto fresh `origin/main` immediately before pushing, because CI's page regeneration moves `main` often
- Push with `git push origin HEAD:refs/heads/main`, never `--force`, never `--no-verify`, and verify with `git ls-remote origin main`
- No Claude or Anthropic attribution in commit messages; Conventional Commits

This differs from the sibling `gonogo` repository, where `main` is a frozen release branch and work lands on `ci-dev` and `staging`. Do not carry that rule here.
