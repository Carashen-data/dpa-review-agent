# 更新日志 / Changelog

本项目所有重要变更均记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [Unreleased]

### 计划中
- 增加 FERPA、HIPAA 等行业法规的审阅支持
- 支持多语言审阅意见书输出（英文、日文）
- 添加协议模板生成功能
- 集成 RAG 知识库增强法规引用准确性

---

## [1.0.0] - 2026-07-17

### 新增
- 初始版本发布
- 支持六维审阅框架：主体与角色、数据处理范围、安全保障义务、跨境数据传输、数据主体权利、合同治理
- 支持 8 个司法管辖区的法规矩阵：GDPR、UK GDPR、CCPA/CPRA、PIPL、DSL、LGPD、PDPA、APP Privacy Act
- 输出结构化审阅意见书，包含风险分级、缺失条款清单、谈判要点矩阵、合规检查清单
- 提供 Coze / Dify / FastGPT / OpenAI API / LangChain 多平台部署指南
- 完整的中英双语法律免责声明
- MIT License 开源
- 示例审阅意见书输出

### 文档
- README.md 项目主文档
- DISCLAIMER.md 法律免责声明
- docs/deployment.md 部署指南
- docs/usage.md 使用指南
- examples/sample_review.md 示例输出
- prompt/system_prompt.md 系统提示词
