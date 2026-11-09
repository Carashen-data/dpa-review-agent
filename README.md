# 数据处理协议审核 · Legal Agent

> 一位资深数据合规律师的 AI 分身，为你逐条审阅《数据处理协议 / DPA》，出具风险清单、条款批注与整改建议。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> ⚠️ **本工具仅供研究与起草辅助，不构成法律意见，不建立律师—客户关系。请勿输入保密客户信息或受特权保护的材料。** 详见 [DISCLAIMER.md](DISCLAIMER.md)。

---

## 这是什么

一个可直接自托管的 DPA 审阅工作台：粘贴协议正文，选择适用法域、法规矩阵、DPA 关系类型、当事方视角与审阅深度，模型以流式方式输出一份 Markdown 审阅意见书。

- **三套法规矩阵**：中国（PIPL / CSL / DSL / 国标）、欧盟（GDPR 等）、美国（CCPA/CPRA 等）
- **五种 DPA 关系**：委托处理、独立控制者、共同控制者、次级处理者、跨境提供
- **监管管控点**：按监管机构分组勾选，随请求一并传给模型
- **三档审阅深度**：速审 / 标准 / 深审
- 技术栈：Next.js 16 App Router、React 19、TypeScript、Tailwind CSS v4 编译产物、`marked`、`lucide-react`

---

## 快速开始

要求 **Node.js >= 20.9**（推荐 22 LTS）。

```bash
git clone https://github.com/Carashen-data/dpa-review-agent.git
cd dpa-review-agent
npm install
cp .env.example .env.local
# 编辑 .env.local，填入 LLM_API_KEY（任意 OpenAI 兼容服务）
npm run dev
```

打开 <http://localhost:3000>。

未配置密钥时页面、法规配置与示例协议仍可正常加载（可点「加载示例」体验界面），点击「开始核阅」会返回明确的配置提示，不会静默失败。

### 环境变量

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `LLM_API_KEY` | 是 | — | 模型服务密钥，**仅服务端读取**，不会下发浏览器 |
| `LLM_BASE_URL` | 否 | `https://api.openai.com/v1` | OpenAI 兼容的 Chat Completions 根地址 |
| `LLM_MODEL` | 否 | `gpt-4o-mini` | 模型名 |
| `LLM_TIMEOUT_MS` | 否 | `120000` | 单次请求超时 |

兼容示例：`https://api.deepseek.com/v1`、`https://dashscope.aliyuncs.com/compatible-mode/v1`、本地 `http://localhost:11434/v1`（Ollama）等。切换服务只需改 `.env.local`，无需改代码。

> `.env`、`.env.local` 等均在 `.gitignore` 中。**切勿把真实密钥或包含真实合同内容的文件提交到仓库。**

---

## 项目结构

```
src/
├── app/
│   ├── layout.tsx / page.tsx        # 页面骨架与元数据
│   ├── globals.css                  # 工作台样式（Tailwind v4 构建产物）
│   └── api/
│       ├── config/route.ts          # GET  法规矩阵、预设、管控点、当事方角色
│       ├── sample/route.ts          # GET  虚构示例 DPA
│       └── audit/route.ts           # POST 流式审阅（SSE）
├── components/audit/
│   └── audit-workbench.tsx          # 审阅工作台主组件
├── data/
│   ├── config.json                  # 静态配置数据
│   └── sample.json                  # 示例协议
└── lib/system-prompt.ts            # 服务端系统提示词（与 prompt/ 下 md 同步）
prompt/system_prompt.md              # 可阅读、可复用的审阅方法论提示词
docs/                                # 使用与部署文档
examples/sample_review.md            # 输出示例
```

### 数据流

```
浏览器 ──GET──> /api/config、/api/sample
浏览器 ──POST─> /api/audit ──流式请求──> OpenAI 兼容模型服务
浏览器 <─SSE── event: delta / done / error
```

`/api/audit` 把用户选择的审阅参数与协议正文拼装为结构化提示，调用模型后把 `choices[0].delta.content` 逐块转发为 `event: delta`，并以 `event: done` 结束。前端使用原生 `fetch` + `ReadableStream` 消费，无额外 SDK。

---

## 数据来源与开源边界

请留意这一节，它说明了本仓库与线上版本的关系：

- **前端源码**：`audit-workbench.tsx` 与 `globals.css` 还原自 Coze Space 生成的 Next.js 应用（通过其开发预览站点公开的 source map 提取），保留原实现；已移除平台注入的编辑器脚本与调试标记。
- **后端实现**：线上版本的 `/api/audit` 依赖 Coze 平台侧的模型额度与 Agent / 工作流配置，**不属于可开源的代码，也未包含在本仓库**。这里以可自托管的 OpenAI 兼容实现替代，审阅方法论来自 `prompt/system_prompt.md`。
- **配置与示例**：`src/data/*.json` 来自线上配置与示例接口，示例协议为虚构文本，不含真实客户信息。
- **线上演示地址**（`*.dev.coze.site` / `dpareviewagent.coze.site`）由平台托管，可用性受套餐与额度影响，**不是本仓库的运行依赖**。请以本地或自行部署的实例为准。
- 如果你持有该 Coze 项目的完整源码导出，欢迎用原实现替换 `src/app/api/audit/route.ts` 并提交 PR。

---

## 合规与使用边界

1. 所有输出均为模型自动生成，**必须经合格律师独立核实后方可依赖**。
2. 协议正文会发送给你在 `.env.local` 中配置的第三方模型服务；使用前请评估数据出境与保密风险，并先做脱敏。
3. 法规矩阵、条文引用与管控点列表是辅助提示信息，**不保证时效性、完整性或适用性**，请以现行有效法规文本为准。
4. 本仓库不含、也不应包含任何客户材料、密钥或内部地址。提交前请自行复查。

完整免责声明见 [DISCLAIMER.md](DISCLAIMER.md)，该文件的免责条款是 MIT 许可证 `"AS IS"` 的补充，分发时必须保留。

---

## 更多文档

- [使用指南](docs/usage.md)
- [部署指南](docs/deployment.md)
- [输出示例](examples/sample_review.md)
- [系统提示词](prompt/system_prompt.md)
- [贡献指南](CONTRIBUTING.md) · [更新日志](CHANGELOG.md)

---

## 许可证

[MIT](LICENSE) © 2026 DPA Review Agent Contributors

前端实现源自 Coze Space 生成的项目代码；开源前请确认你对该平台生成内容的使用与再分发符合平台条款。依赖库各自遵循其原始许可证。
