# 部署指南

本指南介绍如何将"数据保护协议审核 · Legal Agent"部署到不同平台。

---

## 一、部署到 Coze（推荐）

### 1. 创建 Bot

1. 访问 [Coze 平台](https://www.coze.com)，登录账号
2. 点击「创建 Bot」
3. 填写基本信息：
   - **名称**：数据保护协议审核 · Legal Agent
   - **描述**：资深合规合伙人级别的 DPA 审阅助手
   - **Bot 功能介绍**：逐条审阅《数据保护协议 / DPA》，识别合规风险、缺失条款与谈判要点，输出审阅意见书
4. 选择模式：**对话型**

### 2. 配置人设与回复逻辑

1. 进入 Bot 编辑页面
2. 在「人设与回复逻辑」区域，粘贴 [`prompt/system_prompt.md`](../prompt/system_prompt.md) 的完整内容
3. 配置开场白（见 README.md 中的开场白配置）

### 3. 模型设置

| 参数 | 推荐值 |
|------|--------|
| 模型 | GPT-4o 或 Claude 3.5 Sonnet |
| 温度 | 0.3 |
| 最大输出 | 8192 |
| 上下文窗口 | 128K（如可选） |

### 4. 知识库配置（可选）

如需提升审阅精度，建议添加以下知识库：

- GDPR 全文及官方指南
- PIPL 全文及实施细则
- 常用 SCC（标准合同条款）模板
- 各国数据保护监管机构的指导文件

### 5. 插件配置（可选）

- **搜索插件**：用于查询最新法规动态
- **文档解析插件**：用于直接上传 PDF/Word 格式的 DPA

### 6. 发布

1. 点击「发布」
2. 选择发布渠道：
   - **网站**：生成在线访问链接
   - **API**：获取 API 接口，可集成到自有系统
   - **Bot 商店**：上架 Coze 商店供其他用户使用
3. 配置发布信息：
   - 发布名称
   - 发布描述
   - 头像/封面图

---

## 二、部署到 Dify

### 1. 创建应用

1. 登录 [Dify](https://dify.ai)
2. 创建新应用，选择「对话型」
3. 在「系统提示词」中粘贴 `prompt/system_prompt.md` 的内容

### 2. 模型配置

- 选择模型：GPT-4o / Claude 3.5 Sonnet
- Temperature: 0.3
- Max Tokens: 8192

### 3. 知识库

- 上传法规文档到 Dify 知识库
- 在应用设置中关联知识库

### 4. 发布

- 可发布为 Web 应用
- 或通过 API 集成

---

## 三、部署到 FastGPT

### 1. 创建工作流

1. 登录 FastGPT
2. 创建新工作流
3. 添加「AI 对话」节点
4. 在系统提示词中粘贴 `prompt/system_prompt.md` 的内容

### 2. 配置输入变量

- `agreement_text`：协议正文（文本输入）
- `dpa_type`：DPA 关系类型（下拉选择）
- `applicable_laws`：适用法规（多选）
- `user_role`：用户角色（下拉选择）

### 3. 发布

发布为 API 或 Web 应用。

---

## 四、通过 OpenAI Assistants API 集成

### Python 示例

```python
from openai import OpenAI

client = OpenAI(api_key="your-api-key")

# 读取系统提示词
with open("prompt/system_prompt.md", "r", encoding="utf-8") as f:
    instructions = f.read()

# 创建 Assistant
assistant = client.beta.assistants.create(
    name="DPA Review Legal Agent",
    instructions=instructions,
    model="gpt-4o",
    temperature=0.3,
)

# 创建对话线程
thread = client.beta.threads.create()

# 发送协议文本
message = client.beta.threads.messages.create(
    thread_id=thread.id,
    role="user",
    content="[在此粘贴 DPA 协议正文]",
)

# 运行 Assistant
run = client.beta.threads.runs.create(
    thread_id=thread.id,
    assistant_id=assistant.id,
)

# 等待结果（简化示例，实际需轮询 run 状态）
# ...
```

---

## 五、通过 LangChain 集成

```python
from langchain_openai import ChatOpenAI
from langchain.schema import SystemMessage, HumanMessage

# 读取系统提示词
with open("prompt/system_prompt.md", "r", encoding="utf-8") as f:
    system_prompt = f.read()

# 初始化模型
llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0.3,
    max_tokens=8192,
)

# 构建消息
messages = [
    SystemMessage(content=system_prompt),
    HumanMessage(content="[在此粘贴 DPA 协议正文]"),
]

# 获取审阅结果
response = llm.invoke(messages)
print(response.content)
```

---

## 六、自托管 Web 应用

如需自托管一个完整的 Web 界面，可参考以下技术栈：

| 层 | 技术选型 |
|----|---------|
| 前端 | React / Next.js + Tailwind CSS |
| 后端 | Python FastAPI / Node.js Express |
| AI 接口 | OpenAI API / 本地部署的开源模型 |
| 部署 | Docker + Nginx |

最小化部署架构：

```
用户浏览器 → Nginx → FastAPI → LLM API
                         ↓
                    系统提示词加载
```

---

## 常见部署问题

### Q: 输出被截断怎么办？

A: 增大模型的 `max_tokens` 参数（建议 8192+），或在工作流中分段输出后拼接。

### Q: 协议太长，超出上下文窗口怎么办？

A: 1) 使用支持长上下文的模型（如 GPT-4o 128K）；2) 在提示词中指示 Agent 分段审阅；3) 使用 RAG 技术对协议进行检索。

### Q: 如何提升审阅精度？

A: 1) 添加法规知识库；2) 使用更低温度（0.1-0.2）；3) 在提示词中增加更多示例；4) 使用思维链（CoT）提示。
