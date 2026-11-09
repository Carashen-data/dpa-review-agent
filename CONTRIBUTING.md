# 贡献指南 / Contributing

感谢你有兴趣为本项目贡献！

---

## 贡献方式

### 1. 报告问题

如发现审阅逻辑有误、法规引用不准确、输出格式异常等问题，请提交 Issue：

- 标题格式：`[问题类型] 简要描述`
- 正文包含：
  - 使用的平台与模型
  - 输入的协议片段（请脱敏）
  - 选择的适用法规
  - 期望输出 vs 实际输出
  - 错误信息（如有）

### 2. 改进提示词

欢迎优化 `prompt/system_prompt.md`：

- 补充特定法规的审阅规则
- 优化输出格式的可读性
- 增加 Edge Case 的处理逻辑
- 提升多语言支持

**注意**：服务端实际加载的是 `src/lib/system-prompt.ts` 中的 `SYSTEM_PROMPT` 常量。修改提示词时请**同步更新这两个文件**，否则线上审阅行为不会变化。提交 PR 时请说明修改理由和测试结果。

如需调整前端可选法规、管控点或预设组合，请修改 `src/data/config.json`；接口实现位于 `src/app/api/`。

### 3. 新增法规支持

如需添加新的法规框架：

1. 在 `src/data/config.json` 对应的法规矩阵中添加条目（前端选项来自该文件）
2. 在 `prompt/system_prompt.md` 与 `src/lib/system-prompt.ts` 的审阅规则中同步补充
3. 在 README.md 的项目说明中酌情更新
4. 提供 1-2 个脱敏测试用例

### 4. 分享使用经验

欢迎在 Issue 中分享：
- 实际使用中的典型案例
- 不同行业的 DPA 审阅差异
- 与其他工具的对比评测

---

## 开发规范

### 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

类型：
- `feat`：新功能
- `fix`：修复
- `docs`：文档
- `refactor`：重构
- `test`：测试
- `chore`：杂项

示例：
```
feat(prompt): 增加 HIPAA 法规审阅支持
fix(disclaimer): 修正免责声明中的管辖权描述
docs(readme): 补充自托管部署说明
```

### 审阅流程

1. Fork 本仓库
2. 创建分支：`git checkout -b feat/your-feature`
3. 提交修改：`git commit -m 'feat: your feature'`
4. 推送分支：`git push origin feat/your-feature`
5. 提交 Pull Request

---

## 行为准则

- 保持专业、尊重的交流态度
- 不讨论具体客户或案件的保密信息
- 分享的示例协议文本须经过脱敏处理
- 法规引用须标明来源，不得编造

---

## 许可证

提交的贡献将基于 [MIT License](LICENSE) 开源。提交 PR 即表示你同意将贡献内容以 MIT License 授权。
