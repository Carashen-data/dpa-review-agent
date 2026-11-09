import { SYSTEM_PROMPT } from "@/lib/system-prompt";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_AGREEMENT_LENGTH = 60_000;

type AuditRequest = {
  agreement?: string;
  jurisdiction?: string;
  relation?: string;
  cnFrameworks?: string[];
  euFrameworks?: string[];
  usFrameworks?: string[];
  controlPoints?: unknown[];
  partyRole?: unknown;
  depth?: string;
  role?: string;
};

const DEPTH_LABELS: Record<string, string> = {
  quick: "速审（5 分钟高风险速览）",
  standard: "标准（覆盖全部合规项）",
  deep: "深审（含谈判要点与法律依据）",
};

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function buildUserMessage(body: AuditRequest & { agreement: string }): string {
  return [
    "请按系统提示词中的审阅框架，对以下《数据处理协议 / DPA》出具结构化审阅意见书。",
    "",
    "【审阅参数】",
    `- 适用法域：${body.jurisdiction ?? "未指定"}`,
    `- DPA 关系类型：${body.relation ?? "未指定"}`,
    `- 审阅深度：${DEPTH_LABELS[body.depth ?? ""] ?? "标准（覆盖全部合规项）"}`,
    `- 委托方视角：${body.role ?? "未指定"}`,
    `- 当事方角色：${JSON.stringify(body.partyRole ?? null)}`,
    `- 中国法规矩阵：${JSON.stringify(body.cnFrameworks ?? [])}`,
    `- 欧盟法规矩阵：${JSON.stringify(body.euFrameworks ?? [])}`,
    `- 美国法规矩阵：${JSON.stringify(body.usFrameworks ?? [])}`,
    `- 监管管控点：${JSON.stringify(body.controlPoints ?? [])}`,
    "",
    "【协议正文】",
    "```text",
    body.agreement.trim(),
    "```",
    "",
    "请直接输出 Markdown 格式的审阅意见书：风险摘要、逐条批注、缺失条款清单、谈判要点矩阵与合规检查清单，并在末尾附免责声明。",
  ].join("\n");
}

/**
 * 流式审阅接口。前端按 SSE 事件消费：
 *   event: delta  { text }       -> 追加正文
 *   event: done   { finishedAt } -> 结束
 *   event: error  { message }    -> 展示错误
 *
 * 模型调用走 OpenAI 兼容的 Chat Completions 协议，密钥只从服务端环境变量读取，
 * 不会下发到浏览器，也不会进入仓库。
 */
export async function POST(req: Request) {
  let body: AuditRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const agreement =
    typeof body.agreement === "string" ? body.agreement.trim() : "";
  if (!agreement) {
    return Response.json({ error: "协议正文不能为空" }, { status: 400 });
  }
  if (agreement.length > MAX_AGREEMENT_LENGTH) {
    return Response.json(
      { error: `协议正文超过 ${MAX_AGREEMENT_LENGTH} 字符上限` },
      { status: 413 },
    );
  }

  const apiKey = process.env.LLM_API_KEY?.trim();
  const baseUrl = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(
    /\/+$/,
    "",
  );
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS || 120_000);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(sse(event, data)));
      };
      const close = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      try {
        if (!apiKey) {
          send("error", {
            message:
              "尚未配置 LLM_API_KEY。请将 .env.example 复制为 .env.local，填入任意 OpenAI 兼容服务的密钥后重启服务（见 README）。",
          });
          close();
          return;
        }

        send("meta", {
          jurisdiction: body.jurisdiction ?? null,
          relation: body.relation ?? null,
          depth: body.depth ?? null,
          length: agreement.length,
          model,
          startedAt: Date.now(),
        });

        const upstream = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            stream: true,
            temperature: 0.2,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: buildUserMessage({ ...body, agreement }) },
            ],
          }),
          signal: AbortSignal.any([req.signal, AbortSignal.timeout(timeoutMs)]),
        });

        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          send("error", {
            message: `模型服务返回 ${upstream.status}${detail ? `：${detail.slice(0, 300)}` : ""}`,
          });
          close();
          return;
        }

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            for (const line of part.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const raw = line.slice(5).trim();
              if (!raw || raw === "[DONE]") continue;
              try {
                const chunk = JSON.parse(raw);
                const text = chunk?.choices?.[0]?.delta?.content;
                if (typeof text === "string" && text) send("delta", { text });
                if (chunk?.error?.message) {
                  send("error", { message: String(chunk.error.message) });
                }
              } catch {
                // 忽略心跳行与非 JSON 片段
              }
            }
          }
        }

        send("done", { finishedAt: Date.now() });
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "审阅过程发生异常",
        });
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
