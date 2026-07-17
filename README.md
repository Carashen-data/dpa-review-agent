# 数据处理协议审核 · Legal Agent

> 一个基于 AI 的《数据处理协议 / DPA》智能审阅助手，模拟资深合规合伙人的审阅流程，逐条识别合规风险、缺失条款与谈判要点，输出可直接呈交客户的审阅意见书。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform: Coze](https://img.shields.io/badge/Platform-Coze-blue)](https://www.coze.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![在线演示](https://img.shields.io/badge/在线演示-dpareviewagent.coze.site-brightgreen)](https://dpareviewagent.coze.site)

---

## 目录

- [项目简介](#项目简介)
- [核心功能](#核心功能)
- [适用法规矩阵](#适用法规矩阵)
- [审阅框架](#审阅框架)
- [快速开始](#快速开始)
- [部署指南](#部署指南)
- [输出示例](#输出示例)
- [配置说明](#配置说明)
- [开源协议配置](#开源协议配置)
- [免责声明](#免责声明)
- [贡献指南](#贡献指南)
- [更新日志](#更新日志)
- [许可证](#许可证)

---

## 项目简介

本项目是一个专注于**数据处理协议（Data Processing Agreement, DPA）**审阅的 AI 法律智能体。它基于大语言模型能力，结合合规审阅方法论，为法务团队、合规人员和数据保护官（DPO）提供高效的协议初审工具。

**适用场景：**
- 企业签署数据处理协议前的合规自查
- 律师事务所对客户 DPA 的批量初审
- DPO 日常合同审阅工作流
- 数据合规培训与教学演示

**不适用场景（详见[免责声明](DISCLAIMER.md)）：**
- 替代执业律师出具正式法律意见
- 涉及诉讼、仲裁等争议解决场景
- 对最终签署文本的合规背书

---

## 核心功能

| 功能模块 | 说明 |
|---------|------|
| **逐条批阅** | 对 DPA 全文逐条扫描，标注风险等级（高/中/低） |
| **合规风险识别** | 比对适用法规，识别违反强制性规定的条款 |
| **缺失条款检测** | 检查 DPA 应具备但协议中缺失的关键条款 |
| **谈判要点提炼** | 标注有利于己方/对方的条款，给出谈判建议 |
| **法规矩阵匹配** | 根据用户选择的适用法规，自动适配审阅标准 |
| **审阅意见书生成** | 输出结构化审阅报告，可直接呈交客户或内部决策层 |

---

## 适用法规矩阵

本 Agent 支持以下法规框架的审阅，用户可在使用时选择适用的法规组合：

| 法规 | 管辖区域 | 核心审阅维度 |
|------|---------|-------------|
| **GDPR**（通用数据保护条例） | 欧盟/EEA | 第28条数据处理者义务、SCC、跨境传输、DPA必备条款 |
| **UK GDPR + DPA 2018** | 英国 | 与EU GDPR差异点、UK IDTA跨境传输机制 |
| **CCPA/CPRA** | 美国加利福尼亚州 | 消费者权利、服务提供商条款、数据出售限制 |
| **PIPL**（个人信息保护法） | 中国 | 委托处理协议必备条款、跨境传输、单独同意 |
| **DSL**（数据安全法） | 中国 | 数据分级分类、重要数据出境安全评估 |
| **LGPD** | 巴西 | 数据处理者义务、ANPD 监管要求 |
| **PDPA** | 新加坡 | 数据中介义务、跨境转移同意 |
| **APP Privacy Act** | 澳大利亚 | APP 11 安全义务、跨境披露 APP 8 |

---

## 审阅框架

Agent 采用 **"六维审阅法"**，对每一份 DPA 进行系统性扫描：

```
┌─────────────────────────────────────────────────┐
│               DPA 六维审阅框架                     │
├──────────────┬──────────────────────────────────┤
│ 1. 主体与角色  │ 控制者/处理者/次处理者角色界定、      │
│              │ 权责划分是否清晰                    │
├──────────────┼──────────────────────────────────┤
│ 2. 数据处理范围 │ 处理目的、数据类型、处理方式是否      │
│              │ 必要、是否超出最小必要原则            │
├──────────────┼──────────────────────────────────┤
│ 3. 安全保障义务 │ 技术/组织措施（TOMs）、安全事件      │
│              │ 通知机制、审计权                     │
├──────────────┼──────────────────────────────────┤
│ 4. 跨境传输    │ 传输机制合法性（SCC/BCR/认证）、     │
│              │ 数据落地要求、政府调取应对            │
├──────────────┼──────────────────────────────────┤
│ 5. 权利保障    │ 数据主体权利通道、删除/返还/销毁      │
│              │ 义务、异议处理机制                   │
├──────────────┼──────────────────────────────────┤
│ 6. 合同治理    │ 责任限制、 indemnification、         │
│              │ 终止权、争议解决、审计条款           │
└──────────────┴──────────────────────────────────┘
```

---

## 快速开始

### 方式一：直接使用在线版本

访问已正式发布的 Coze 应用（稳定部署版，可随时打开）：

```
https://dpareviewagent.coze.site
```

> 提示：正式发布版不带 `.dev.` 子域，长期稳定可用；如需自行部署，请参考[部署指南](docs/deployment.md)。

### 方式二：自行部署到 Coze

1. 注册 / 登录 [Coze 平台](https://www.coze.com)
2. 创建新 Bot，选择"对话型"模式
3. 将 [`prompt/system_prompt.md`](prompt/system_prompt.md) 的内容粘贴到"人设与回复逻辑"中
4. 根据需要配置知识库、插件（详见[部署指南](docs/deployment.md)）
5. 发布为网站 / API / Bot

### 方式三：迁移到其他平台

本项目的核心是系统提示词（System Prompt），可迁移至任何支持自定义 Prompt 的平台：

- **Dify** — 导入为对话应用
- **FastGPT** — 配置为工作流节点
- **LangChain / LlamaIndex** — 作为 system message 加载
- **OpenAI Assistants API** — 创建 Assistant 时填入

详见[部署指南](docs/deployment.md)。

---

## 部署指南

详细的部署步骤请参考 [docs/deployment.md](docs/deployment.md)。

---

## 输出示例

一份完整的审阅意见书输出示例请参考 [examples/sample_review.md](examples/sample_review.md)。

---

## 配置说明

### Agent 配置参数

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| 模型 | GPT-4o / Claude 3.5 Sonnet | 需要强推理能力，建议使用旗舰模型 |
| 温度 | 0.3 | 法律审阅需要稳定输出，降低随机性 |
| 最大输出 | 8192 tokens | 审阅意见书较长，需充足输出空间 |
| 上下文窗口 | 128K+ | DPA 全文可能很长，需要大窗口 |

### Coze Bot 配置

```
Bot 名称：数据处理协议审核 · Legal Agent
Bot 描述：资深合规合伙人级别的 DPA 审阅助手
模式：对话型
人设与回复逻辑：见 prompt/system_prompt.md
开场白：见下方
```

**开场白配置：**

```
将协议摊在这张胡桃木书桌上

我会像一位资深合规合伙人那样，逐条批阅你的《数据处理协议 / DPA》。
识别合规风险、缺失条款与谈判要点，最终出具一份可直接呈交客户的审阅意见书。

台灯已亮，等待卷宗

粘贴协议正文，确认 DPA 关系类型与适用法规矩阵，笔已经蘸好朱砂。
```

---

## 开源协议配置

本项目采用 **MIT License** 开源。关于法律工具开源的特殊说明：

1. **MIT License** 允许商业使用、修改、分发、再授权，仅需保留版权声明与许可声明。
2. 本项目附带的 [免责声明](DISCLAIMER.md) 属于 MIT License 第 1 条"无担保"条款的具体延伸，**不可删除**。
3. 如你 fork 后二次分发，**必须保留**：
   - 原始版权声明
   - MIT License 全文
   - DISCLAIMER.md 免责声明
4. 建议在 fork 版本的 README 顶部注明："本项目 fork 自 [原始仓库]，原项目遵循 MIT License。"

### 商标与品牌

- "Legal Agent" 仅为功能描述性名称，不构成商标。
- 如你将本项目用于商业服务，建议使用自有品牌名，避免与原项目混淆。

---

## 免责声明

> **重要：本项目是 AI 辅助工具，不是法律服务机构，不提供法律意见。**

完整免责声明请阅读 [DISCLAIMER.md](DISCLAIMER.md)。

使用本项目即表示你已阅读并同意免责声明的全部内容。

---

## 贡献指南

欢迎提交 Issue 和 Pull Request！请参考 [CONTRIBUTING.md](CONTRIBUTING.md)（如有）。

贡献方向：
- 补充更多法规框架的审阅规则
- 优化系统提示词的审阅精度
- 提供更多语言的输出支持
- 分享实际使用中的 Edge Case

---

## 更新日志

详见 [CHANGELOG.md](CHANGELOG.md)。

---

## 许可证

本项目基于 [MIT License](LICENSE) 开源。

```
MIT License

Copyright (c) 2026 DPA Review Agent Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<p align="center">
  <em>台灯已亮，等待卷宗。</em><br>
  <em>笔已经蘸好朱砂。</em>
</p>
