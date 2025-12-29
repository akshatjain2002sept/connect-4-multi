# Agent Instructions

This project uses **bd** (beads) for issue tracking and **AgentMail** for agent-to-agent communication.

Run `bd onboard` to get started.

## Agent Registry

| Agent | Role | Domain | Email |
|-------|------|--------|-------|
| claude-infra | Infrastructure | CI/CD, deployment, docker, db migrations, env config | claude-infra@connect-4-multi.agentmail.to |
| claude-backend | Backend | APIs, services, business logic, data models | claude-backend@connect-4-multi.agentmail.to |
| claude-frontend | Frontend | UI components, pages, client state, styling | claude-frontend@connect-4-multi.agentmail.to |
| codex-testing | Testing & Integration | Tests, e2e, integration, verification | codex-testing@connect-4-multi.agentmail.to |

## Quick Reference

### Issue Tracking (bd)
```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

### Agent Communication (AgentMail)

**Check inbox at session start** – Other agents may have left you context or requests.

**When to email other agents:**
- Handing off work that depends on another agent's domain
- Reporting blockers that affect shared resources
- Requesting review or input on cross-cutting changes
- Completing work that unblocks another agent

**Email format:**
- Subject: `[issue-id] brief description`
- Body: What you did, what's needed, relevant file paths
- Reply in-thread to maintain context

## Landing the Plane (Session Completion)

**When ending a work session**, complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **Check inbox & respond** - Reply to any pending agent messages
2. **Notify downstream agents** - Email agents whose work depends on yours
3. **File issues for remaining work** - Create issues for anything that needs follow-up
4. **Run quality gates** (if code changed) - Tests, linters, builds
5. **Update issue status** - Close finished work, update in-progress items
6. **PUSH TO REMOTE** - This is MANDATORY:
```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
```
7. **Clean up** - Clear stashes, prune remote branches
8. **Verify** - All changes committed AND pushed

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds