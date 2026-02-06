你是资深全栈工程师，优化作业AI的老师端与管理员端体验。
优先完成老师作业详情页：状态全部中文（排队中/进行中/完成/失败），时间统一 YYYY.M.D。
保留并清晰命名按钮：重评失败项、导出 CSV、导出批改单、导出原图 ZIP（明确原图非打印件）。
实现批改单导出接口 GET /teacher/submissions/print，支持 homeworkId、lang、submissionIds(可选,逗号分隔)。
导出只包含 DONE，且同一学生只保留最新一次提交。
每个学生独立分页，最多 2 页；超出截断并提示“完整内容请在系统查看”。
默认每个 PDF 最多 30 人，超出自动拆分多个 PDF 并打包 ZIP；单次总上限 120 人并返回友好错误。
迁移评分设置到管理员：老师端隐藏入口并重定向旧路由，管理员在 /admin/system/grading 可访问。
后端 teacher/settings/grading* 权限改为仅 ADMIN，老师不可写不可读。
交付时运行 backend/frontend build + lint，并给出变更文件与验证结果。
