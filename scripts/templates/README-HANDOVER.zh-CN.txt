Homework AI 交接包

1) source-code.zip：提交版本 {{COMMIT}} 的项目源码
2) MANIFEST.json：交接包元信息
3) docs/HANDOVER.md 与 docs/DEPLOY.md 在 source-code.zip 内

安全提醒：
- 不要打包 deploy/host.env 或 apps/backend/.env
- 若包含 secrets/account-only.env，请仅通过可信渠道传输
- API 密钥与密码请通过安全渠道单独发送
