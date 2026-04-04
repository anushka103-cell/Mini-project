# MindSafe Workspace Instructions

## File Output Rules

- **Generated outputs** (logs, reports, summaries, test results, deployment records, phase docs) MUST be written to `MindSafe_Logs/`.
- **Agent-related files** (agent definitions, agent docs, AGENTS.md) belong in `.github/`.
- **NEVER** create output/log/report files in the project root or `src/`.
- `MindSafe_Logs/` is a junction link to an external folder and is git-ignored.
- Use descriptive filenames without date prefixes (e.g., `deployment_report.md` not `20260403_deployment_report.md`).

## Project Structure

- Source code: `src/`
- Backend: `src/backend/`
- Infrastructure: `infra/`, `src/docker/`
- Documentation: `docs/`
- Agent system: `.github/agents/`
