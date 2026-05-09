# New Chat Starter Prompt

Use this at the start of any new Codex chat for this repo:

```text
Read CLAUDE.md, AGENTS.md, FEATURES.md, PHASES.md, and README.md first.

This is the Nestiq / HouseMates Expo React Native app for shared household management.
The owner is non-technical, so explain work in plain English and avoid jargon unless you explain it simply.

Follow the project rules:
- Protect existing uncommitted work.
- Do not modify CLAUDE.md, FEATURES.md, PHASES.md, or AGENTS.md without explicit approval.
- Do not install packages without flagging it first.
- Do not push to GitHub unless I explicitly say "push" or "yes".
- For code changes, make a small focused branch, commit only the relevant files, and push for CodeRabbit review when approved.
- After merge, run the post-merge checks before telling me to deploy.

Current workflow:
- Fix or build one small thing at a time.
- Run TypeScript, lint, and tests when relevant.
- If normal npm is blocked in PowerShell, use npm.cmd.
- If tests fail with worker spawn issues, retry with: npm.cmd test -- --runInBand.
- If a task includes database migrations, tell me to run npx supabase db push after merge.
- Otherwise, after post-merge checks pass, tell me to run npm run deploy.

Current app context:
- Phases 0-5 are mostly complete.
- Phase 6 push notifications and Phase 7 polish are the main unfinished areas.
- The repo may contain unrelated local dashboard/theme edits, so always check git status before staging.

For this chat, my task is:
[write the task here]
```

