# Deployment Guide - Choose Your Approach

This document helps you choose the best deployment method for your use case.

## Quick Comparison

| Aspect | Docker | systemd |
|--------|--------|---------|
| **Setup Complexity** | Low (one command) | Medium (multiple steps) |
| **Resource Usage** | Higher (~500MB overhead) | Lower (native processes) |
| **Portability** | High (works anywhere with Docker) | Low (Linux specific) |
| **Production Ready** | ✅ Yes | ✅ Yes |
| **Debugging** | Harder (container logs) | Easier (systemd journal) |
| **Updates** | Rebuild containers | git pull + rebuild |
| **Recommended For** | Quick start, testing, small deployments | Production, long-running, large scale |

## Decision Tree

```
Start
 │
 ├─ Are you deploying on Linux (Debian/Ubuntu)?
 │   ├─ Yes → Do you want maximum performance?
 │   │   ├─ Yes → Use **systemd** (DEPLOY.md)
 │   │   └─ No → Use **Docker** (DEPLOY-Docker.md)
 │   │
 │   └─ No (Windows/macOS) → Use **Docker** (DEPLOY-Docker.md)
 │
 └─ Do you need to deploy quickly for testing?
     ├─ Yes → Use **Docker** (DEPLOY-Docker.md)
     └─ No → Use **systemd** (DEPLOY.md)
```

## Docker Deployment

**Choose this if:**
- You're new to deployment
- You want to get started quickly
- You're on Windows or macOS
- You prefer containerized services
- You want easy rollback with docker-compose

**Guide:** [DEPLOY-Docker.md](./DEPLOY-Docker.md)

## systemd Deployment

**Choose this if:**
- You're deploying on Linux (Debian/Ubuntu/CentOS)
- You want maximum performance
- You're comfortable with Linux system administration
- You need fine-grained control over services
- You're using existing infrastructure (MySQL, Redis)

**Guide:** [DEPLOY.md](./DEPLOY.md)

## Common Requirements

Both methods require:
- Node.js 20+ (for building only)
- MySQL 8+ or managed database
- Redis 7+ or managed cache
- Domain name (for production)
- SSL certificates (for production)

## Need Help?

- See [DEVELOPMENT.md](./DEVELOPMENT.md) for local development
- See [RUNBOOK.md](./RUNBOOK.md) for troubleshooting
- Check GitHub Issues for common problems
