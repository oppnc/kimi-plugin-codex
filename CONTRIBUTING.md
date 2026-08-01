# Contributing

Thanks for your interest in **kimi-plugin-codex**.

## Before you start

- Read [README.md](README.md) (product overview) and [AGENTS.md](AGENTS.md) (architecture, bridge rules, version sync).
- Keep the product thin: **forward to local Kimi Code over ACP** — do not reimplement system prompts or turn this into a review-gate suite.

## Development setup

```bash
# Node ≥ 18.18
npm test
npm run setup             # needs Kimi Code + kimi login
npm run smoke             # unit + live ACP (release gate)
```

## Pull requests

1. One logical change per PR when possible.
2. Update **both** English and Chinese user docs if behavior changes (`README*`, `CHANGELOG*`).
3. Put agent/maintainer detail in `AGENTS.md`, not the human README.
4. Bump **all** version fields together when releasing (see version table in `AGENTS.md`).
5. Add unit tests for pure logic under `tests/` (`args`, `permissions`, `state`, `media`).
6. Do not commit secrets, job data, or local settings.

## Commit messages

Prefer clear, sentence-style summaries:

```text
Fix plan mode ExitPlanMode handling
Document unlimited default ACP timeout
```

## Code of conduct

Be respectful. Harassment or abusive behavior is not welcome. Maintainers may close issues/PRs that violate this.