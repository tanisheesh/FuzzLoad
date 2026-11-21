<!--
  TANISH'S SETUP TOOLKIT · tanisheesh.in
  PR template. Goes to: <repo>/.github/PULL_REQUEST_TEMPLATE.md
  Works as-is in any repo, no placeholders to fill.
  Use a plain-English past-tense PR title (no emojis or issue tags).
  Comments like this one are hidden in the rendered PR.
-->

## What & Why

<!-- 1-3 concise sentences: what changed and why. Link any issue below. -->


Closes #

## Type of change

- [ ] ✨ New feature
- [ ] 🐛 Bug fix
- [ ] 🎊 Improvement
- [ ] ♻️ Refactor (no behaviour change)
- [ ] 🔒 Security hardening
- [ ] 🧪 Tests
- [ ] 📚 Docs
- [ ] 🔨 Chore / config / CI
- [ ] 👆 Dependency update
- [ ] 🚨 Breaking change

## Testing & Verification

<!-- Commands run, unit/integration/E2E tests added, and preview/live check notes. -->

- [ ] Lint, format, typecheck, and build pass locally
- [ ] Unit / integration tests pass (and new tests added for new logic or bugfix)
- [ ] UI verified at mobile (`375px`) & desktop (`1280px`) with 0 console errors *(if UI changed)*
- [ ] Verified on the preview or live deployment

## Security & Quality Checklist

- [ ] Follows `AGENTS.md` (kebab-case/snake_case, modular files <= 300 lines, reusable components, no AI slop)
- [ ] Inputs validated at API/action boundaries (Zod/Pydantic) and auth/ownership checked
- [ ] No secrets, debug logs, `@ts-ignore`, empty `catch {}`, or unrelated changes
- [ ] Docs, `.env.example`, and `CHANGELOG.md` updated if needed

<!--
  Tanish Poddar · https://tanisheesh.in · https://linkedin.com/in/tanisheesh
  https://github.com/tanisheesh · hi@tanisheesh.in
-->
