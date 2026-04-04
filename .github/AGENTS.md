---
name: MindSafe Agents
description: "Custom agents for MindSafe mental health platform automation. Use when: managing deployments, running tests, validating security, monitoring services, or automating ML operations."
version: 1.0.0
---

# MindSafe Agent Suite

Complete agent-based system for autonomous management of the MindSafe privacy-first mental health platform.

## Available Agents

All agents are located in `.github/agents/` and automatically discoverable in Copilot chat.

### 1. **MindSafe-Orchestrator** (Master Agent)

Master coordination agent for complex multi-step workflows. Orchestrates all other agents.

**Use for:**

- End-to-end platform deployments (local or production)
- Complex multi-agent workflows
- Testing and validation
- Disaster recovery procedures
- Credential rotation and security operations

**Common commands:**

```
Deploy the MindSafe platform locally
Run a full production deployment
Validate the deployment before going live
Scale services up/down
Perform a full backup and disaster recovery test
```

### 2. **Database-Manager**

Specialized agent for PostgreSQL database operations.

**Use for:**

- Database initialization and schema setup
- Backup and restore operations
- Encryption key management
- Performance optimization (VACUUM, ANALYZE)
- Data integrity verification
- Database health checks

### 3. **Security-Validator**

Specialized agent for security audits and compliance.

**Use for:**

- Full security audits
- Compliance checking (GDPR, HIPAA, OWASP, PCI-DSS, SOC 2)
- Vulnerability scanning
- Encryption validation
- Authentication and authorization review
- Generating security and compliance reports

### 4. **Deployment-Executor**

Specialized agent for Docker and infrastructure management.

**Use for:**

- Building and pushing Docker images
- Starting/stopping services locally
- Deploying to AWS production
- Health monitoring and service checks
- Blue-green and canary deployments
- Service scaling and load testing
- Rollback procedures

### 5. **ML-Pipeline-Manager**

Specialized agent for ML model management.

**Use for:**

- Loading and initializing ML models
- Performance testing and benchmarking
- Inference latency optimization
- A/B testing new models
- Model versioning and rollout
- Performance monitoring and alerts

### 6. **Testing-Coordinator**

Specialized agent for comprehensive testing.

**Use for:**

- Running full test suites
- API endpoint testing
- Security testing (injection attacks, auth bypass)
- Performance and load testing
- Data integrity testing
- Generating coverage reports
- Pre-deployment validation

### 7. **Monitoring-Setup-Agent**

Specialized agent for observability infrastructure.

**Use for:**

- Setting up Prometheus metrics collection
- Creating Grafana dashboards
- Configuring alerting rules
- Log aggregation setup
- Monitoring health checks
- Performance reporting

### 8. **Documentation-Keeper-Agent**

Specialized agent for documentation and audit logs.

**Use for:**

- Creating operational runbooks
- Generating deployment guides
- Maintaining change logs
- Creating incident reports
- Audit logging for compliance
- Exporting and archiving documentation

## File Output Conventions

All agents MUST follow these rules when creating files:

| File Type                       | Output Location         | Examples                                                                               |
| ------------------------------- | ----------------------- | -------------------------------------------------------------------------------------- |
| Agent definitions (`.agent.md`) | `.github/agents/`       | New or updated agent files                                                             |
| Agent documentation             | `.github/`              | AGENTS.md, agent READMEs                                                               |
| Workspace instructions          | `.github/instructions/` | `*.instructions.md`                                                                    |
| Prompts                         | `.github/prompts/`      | `*.prompt.md`                                                                          |
| **All other generated outputs** | `MindSafe_Logs/`        | Logs, reports, summaries, test results, deployment records, phase docs, scripts output |

**Rules:**

- **NEVER** create output/log/report/summary files in the project root or `src/`.
- `MindSafe_Logs/` is a junction link to an external folder — files placed here are stored outside the repo and excluded from git.
- Use descriptive filenames without date prefixes (e.g., `deployment_report.md`, not `20260403_deployment_report.md`).
- Source code, configs, and project documentation (`README.md`, `ARCHITECTURE.md`, etc.) remain in their standard locations.

## Quick Start in Copilot Chat

1. **Type `/` in the Copilot Chat** to see available slash commands
2. **Select an agent** from the dropdown (e.g., `/MindSafe-Orchestrator`)
3. **Type your command** (e.g., "Deploy the platform locally")
4. **Press Enter** and the agent executes!

## Common Workflows

### 🚀 First-Time Deployment

```
1. @Database-Manager init-schema
2. @Deployment-Executor build-images
3. @Deployment-Executor start-local-stack
4. @Testing-Coordinator test-all
5. @Monitoring-Setup-Agent setup-monitoring
```

### 🔒 Security Audit

```
@Security-Validator full-audit
```

### 📊 Pre-Deployment Checklist

```
@MindSafe-Orchestrator validate-deployment
```

### 🔄 Rollover to Production

```
@MindSafe-Orchestrator deploy-production
```

## Output Files

All agents generate timestamped output files in `Agent_log/`:

- `database_init_YYYYMMDD.log` - Database initialization
- `deployment_YYYYMMDD_HHMMSS.log` - Deployment logs
- `security_audit_YYYYMMDD.json` - Security findings
- `test_results_YYYYMMDD.json` - Test results
- `monitoring_config_YYYYMMDD.yaml` - Monitoring configuration
- `compliance_report_YYYYMMDD.md` - Compliance documentation

## Status

✅ **All 8 agents fully operational and ready to use**

- ORCHESTRATOR - Master coordination
- DATABASE-MANAGER - Database operations
- SECURITY-VALIDATOR - Security & compliance
- DEPLOYMENT-EXECUTOR - Docker & infrastructure
- ML-PIPELINE-MANAGER - Model management
- TESTING-COORDINATOR - Quality assurance
- MONITORING-SETUP-AGENT - Observability
- DOCUMENTATION-KEEPER-AGENT - Runbooks & audit logs

## Location

All agent files are stored in: `.github/agents/`

## Need Help?

- Check the agent's full documentation in the `.github/agents/` folder
- Review output logs in `Agent_log/` folder
- Consult the implementation guide in `docs/`
