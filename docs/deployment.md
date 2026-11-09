# 部署指南

本指南面向**本仓库的 Next.js 网页版审阅工作台**。仓库不再依赖任何平台侧的 Bot / 工作流配置，模型通过 OpenAI 兼容接口在服务端调用。

---

## 前置条件

| 项目 | 要求 |
| --- | --- |
| Node.js | >= 20.9（推荐 22 LTS） |
| 模型服务 | 任意支持 `POST /chat/completions` 且开启 `stream: true` 的 OpenAI 兼容服务 |
| 密钥 | 服务端环境变量 `LLM_API_KEY`，不要写进代码或前端 |

---

## 一、本地开发

```bash
npm install
cp .env.example .env.local
npm run dev
```

访问 <http://localhost:3000>。修改 `.env.local` 后需重启 dev server。

---

## 二、生产构建（自托管）

```bash
npm ci
npm run build
npm run start        # 默认监听 3000
```

可通过 `PORT=8080 npm run start` 修改端口，或用 systemd / PM2 / supervisor 托管进程。

建议前置 Nginx / Caddy 提供 HTTPS。`/api/audit` 使用 **SSE 流式响应**，反向代理必须关闭响应缓冲，否则前端会一直等到请求结束才收到内容：

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;          # 关键：SSE 必需
    proxy_cache off;
    proxy_read_timeout 180s;      # 长审阅需放宽超时
}
```

---

## 三、Docker

仓库根目录已提供 `Dockerfile`（Next.js standalone 输出）与 `.dockerignore`：

```bash
docker build -t dpa-review-agent .
docker run --rm -p 3000:3000 \
  -e LLM_API_KEY=你的密钥 \
  -e LLM_BASE_URL=https://api.openai.com/v1 \
  -e LLM_MODEL=gpt-4o-mini \
  dpa-review-agent
```

> 不要把密钥写进镜像或 `docker-compose.yml` 提交到仓库；通过运行时环境变量、Docker secrets 或编排平台的密钥管理注入。

---

## 四、Vercel / Serverless 平台

1. Fork / Import 本仓库，框架选择 Next.js，构建命令 `npm run build`。
2. 在平台环境变量中配置 `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`。
3. 注意平台对函数执行时长的限制：`src/app/api/audit/route.ts` 中声明了 `maxDuration = 120`（秒），若平台套餐上限更低，请在 `LLM_TIMEOUT_MS` 与前端提示中同步调整。
4. 确认平台不会缓冲 SSE 响应（Vercel Functions 支持流式响应）。

---

## 五、模型服务选择

| 场景 | `LLM_BASE_URL` 示例 |
| --- | --- |
| OpenAI | `https://api.openai.com/v1` |
| DeepSeek | `https://api.deepseek.com/v1` |
| 通义千问（兼容模式） | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 本地 Ollama | `http://localhost:11434/v1` |

**数据合规提示**：协议正文会被发送到你配置的模型服务。处理真实合同前，请确认该服务的数据处理条款、数据出境路径与保留策略；对保密要求高的场景建议改用本地模型（Ollama / vLLM）并对文本脱敏。

---

## 六、仅复用提示词到其他平台

`prompt/system_prompt.md` 是平台无关的审阅方法论，可单独粘贴到 Coze Bot、Dify、FastGPT 等对话型应用中作为 System Message：

- 温度建议 `0.1 - 0.2`，最大输出 `8192+`
- 建议补充法规知识库以提升条文引用准确度
- 该用法**不使用本仓库的网页前端与 API**，属于独立部署方式

---

## 常见问题

**Q：点击「开始核阅」提示未配置 `LLM_API_KEY`？**
A：确认 `.env.local` 位于项目根目录、变量名无拼写错误，并重启服务。生产环境请在进程/平台的环境变量中配置。

**Q：页面一直空白、没有逐字输出？**
A：多为反向代理开启了 `proxy_buffering`，或模型服务未返回流式 `delta`。先直接访问 `http://<host>:3000` 排除代理因素，再检查 `LLM_BASE_URL` 是否指向兼容 `/chat/completions` 的地址。

**Q：输出被截断？**
A：换用最大输出更大的模型，或缩短协议正文；当前前端限制协议正文最多 60,000 字符。

**Q：模型返回 401 / 404 / 模型名错误？**
A：核对 `LLM_API_KEY`、`LLM_BASE_URL`（末尾不要重复 `/v1`）、`LLM_MODEL` 三者是否属于同一服务商，错误信息会在审阅窗内以 `event: error` 展示。
