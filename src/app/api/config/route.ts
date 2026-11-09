import config from "@/data/config.json";

/**
 * 返回审阅工作台所需的静态配置：法域、DPA 关系类型、法规矩阵、
 * 预设组合、监管管控点与当事方角色。数据源为 src/data/config.json。
 */
export async function GET() {
  return Response.json(config, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
