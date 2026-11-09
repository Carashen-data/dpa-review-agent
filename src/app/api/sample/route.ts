import sample from "@/data/sample.json";

/** 返回一份虚构的示例 DPA，仅供功能演示，不含任何真实客户信息。 */
export async function GET() {
  return Response.json(sample, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
