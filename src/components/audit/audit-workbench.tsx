"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import {
  AlertTriangle,
  BookOpen,
  Check,
  FileUp,
  GitBranch,
  Landmark,
  Loader2,
  PenLine,
  Play,
  RotateCcw,
  ScrollText,
  Sparkles,
  Square,
} from "lucide-react";

/* ============================================================
 * Types
 * ============================================================ */

type Jurisdiction = "CN" | "GDPR" | "CCPA";
type Depth = "quick" | "standard" | "deep";
type DpaRelation =
  | "controller_processor"
  | "controller_controller"
  | "joint_controller"
  | "sub_processor"
  | "cross_border";

interface JurisdictionOption {
  code: Jurisdiction;
  label: string;
  hint: string;
}
interface RelationOption {
  code: DpaRelation;
  label: string;
  ref: string;
  hint: string;
}
interface CnFrameworkOption {
  code: string;
  short: string;
  full: string;
  year: string;
  category: "core" | "regulation" | "gb" | "practice";
  group?: "foundation" | "pi" | "data" | "sector";
  hint: string;
  citedBy?: string;
}
interface CnPresetOption {
  code: string;
  label: string;
  hint: string;
  frameworks: string[];
}
interface EuFrameworkOption {
  code: string;
  short: string;
  full: string;
  year: string;
  category: "core" | "act" | "guideline" | "transfer" | "sector";
  hint: string;
  citedBy?: string;
}
interface UsFrameworkOption {
  code: string;
  short: string;
  full: string;
  year: string;
  category:
    | "federal"
    | "executive"
    | "state-comprehensive"
    | "state-sector"
    | "agency";
  hint: string;
  citedBy?: string;
}
interface RegionPresetOption {
  code: string;
  label: string;
  hint: string;
  frameworks: string[];
}
interface ControlPoint {
  id: string;
  title: string;
  desc: string;
  basis: string;
  precedent: string;
  severity: "high" | "medium";
}
interface ControlPointGroup {
  regulator: "CAC" | "MPS" | "MIIT" | "SAMR" | "JOINT";
  label: string;
  hint: string;
  points: ControlPoint[];
}
interface ControlPresetOption {
  code: string;
  label: string;
  hint: string;
  points: string[];
}
interface PartyRoleOption {
  code: string;
  label: string; // 英文主标题
  zh: string;
  hint: string;
  stance: string;
}
interface ConfigPayload {
  jurisdictions: JurisdictionOption[];
  relations: RelationOption[];
  cnFrameworks: CnFrameworkOption[];
  cnPresets: CnPresetOption[];
  euFrameworks: EuFrameworkOption[];
  euPresets: RegionPresetOption[];
  usFrameworks: UsFrameworkOption[];
  usPresets: RegionPresetOption[];
  controlPoints: ControlPointGroup[];
  controlPresets: ControlPresetOption[];
  partyRoles: Record<string, PartyRoleOption[]>;
}

interface RiskItem {
  title: string;
  level: "high" | "medium" | "low" | null;
  clause?: string;
  basis?: string;
  consequence?: string;
  remedy?: string;
}

/* ============================================================
 * Constants
 * ============================================================ */

const DEPTHS: Array<{ code: Depth; label: string; hint: string }> = [
  { code: "quick", label: "速审", hint: "5 分钟高风险速览" },
  { code: "standard", label: "标准", hint: "覆盖全部合规项" },
  { code: "deep", label: "深审", hint: "含谈判与法律依据" },
];

const CATEGORY_LABEL: Record<CnFrameworkOption["category"], string> = {
  core: "核心三法",
  regulation: "配套法规",
  gb: "国家标准",
  practice: "实践指南（TC260）",
};

const EU_CATEGORY_LABEL: Record<EuFrameworkOption["category"], string> = {
  core: "核心法规",
  act: "关键立法（Acts）",
  guideline: "EDPB 指引 / 建议",
  transfer: "跨境传输机制",
  sector: "行业专项",
};

const US_CATEGORY_LABEL: Record<UsFrameworkOption["category"], string> = {
  federal: "联邦级",
  executive: "行政令 / 出口管制",
  "state-comprehensive": "州级综合隐私法",
  "state-sector": "州级行业专项",
  agency: "监管机构 / 标准",
};

const GROUP_LABEL: Record<
  NonNullable<CnFrameworkOption["group"]>,
  string
> = {
  foundation: "基础与等保",
  pi: "个人信息",
  data: "数据安全",
  sector: "行业专项",
};

const LEVEL_LABEL: Record<"high" | "medium" | "low", string> = {
  high: "高",
  medium: "中",
  low: "低",
};

/* ============================================================
 * Risk extractor
 * ============================================================ */

function extractRisks(markdown: string): RiskItem[] {
  const risks: RiskItem[] = [];
  const lines = markdown.split(/\n/);
  let current: RiskItem | null = null;
  let inRiskSection = false;

  for (const raw of lines) {
    const line = raw.trim();

    if (/^##\s*二、\s*关键风险清单/.test(line)) {
      inRiskSection = true;
      continue;
    }
    if (/^##\s*[三四五六七]\s*、/.test(line)) {
      if (current) risks.push(current);
      current = null;
      inRiskSection = false;
      continue;
    }
    if (!inRiskSection) continue;

    // 风险条目标题：兼容 "### 风险 N｜标题"、"### 风险 N：标题"、"### 风险 N - 标题"、
    // "### 风险 #N 标题"、"**风险 N｜标题**" 等 LLM 常见变体
    const headingMatch = line.match(
      /^#{1,4}\s+\*{0,2}风险\s*[#]?\s*\d+\s*[｜|:\-·]\s*(.+?)\s*\*{0,2}\s*$/,
    );
    if (headingMatch) {
      if (current) risks.push(current);
      current = { title: headingMatch[1].replace(/\*+/g, "").trim() || "未命名风险", level: null };
      continue;
    }

    if (!current) continue;

    // 风险等级：兼容 "风险等级: 高"、"**风险等级**：中"、"Risk Level: low" 等
    const levelMatch = line.match(
      /\*{0,2}风险等级\*{0,2}\s*[:：]\s*\*{0,2}\s*(高|中|低|high|medium|low)\*{0,2}/i,
    );
    if (levelMatch) {
      const raw = levelMatch[1].toLowerCase();
      if (raw === "高" || raw === "high") current.level = "high";
      else if (raw === "中" || raw === "medium") current.level = "medium";
      else if (raw === "低" || raw === "low") current.level = "low";
    }

    const clauseMatch = line.match(/条款定位\s*[:：]\s*(.+)/);
    if (clauseMatch) current.clause = clauseMatch[1].replace(/\*+/g, "").trim();

    const basisMatch = line.match(/法律依据\s*[:：]\s*(.+)/);
    if (basisMatch) current.basis = basisMatch[1].replace(/\*+/g, "").trim();

    const consMatch = line.match(/风险后果\s*[:：]\s*(.+)/);
    if (consMatch)
      current.consequence = consMatch[1].replace(/\*+/g, "").trim();

    const remedyMatch = line.match(/整改建议\s*[:：]\s*(.+)/);
    if (remedyMatch) current.remedy = remedyMatch[1].replace(/\*+/g, "").trim();
  }

  if (current) risks.push(current);

  // 兜底：对未识别到风险等级的条目，按标题关键词给一个默认等级，
  // 保证右侧"风险摘要"的高/中/低计数始终有值
  for (const r of risks) {
    if (r.level) continue;
    const t = (r.title || "") + " " + (r.consequence || "");
    if (/无限连带|无上限|单方修改|单方解除|无审计权|无删除|数据泄露|跨境未|未告知|未同意|未成年人|生物识别|敏感个人|重要数据|数据出境|无 BAA|无 SCC|无 DPIA|无 DPO|无 PIPIA/.test(t)) {
      r.level = "high";
    } else if (/未备案|未分类分级|未加密|未脱敏|未留存|日志不满|超范围|强制授权|SDK 未告知|未公示|未明示|未单独同意|未评估|未签署/.test(t)) {
      r.level = "medium";
    } else {
      r.level = "low";
    }
  }

  return risks;
}

marked.setOptions({ gfm: true, breaks: false });

/* ============================================================
 * Framework selector sub-components
 * ============================================================ */

function FrameworkChip({
  f,
  active,
  onClick,
}: {
  f: Pick<CnFrameworkOption, "code" | "short" | "full" | "year" | "hint" | "citedBy">;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-1.5 rounded-sm border px-2 py-1.5 text-left text-[11px] transition-colors"
      style={{
        borderColor: active ? "var(--brass)" : "var(--rule)",
        background: active ? "var(--paper-deep)" : "transparent",
        fontFamily: "var(--font-legal-sans)",
      }}
      title={`${f.full}${f.citedBy ? ` · 监管高频：${f.citedBy}` : ""}`}
    >
      <span
        className="mt-0.5 flex h-3 w-3 items-center justify-center rounded-[2px] border"
        style={{
          borderColor: active ? "var(--brass)" : "var(--rule)",
          background: active ? "var(--brass)" : "transparent",
        }}
      >
        {active && (
          <Check
            className="h-2.5 w-2.5"
            style={{ color: "var(--paper)" }}
            strokeWidth={3}
          />
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span
          className="flex items-center gap-1 font-semibold"
          style={{ color: active ? "var(--brass)" : "var(--ink-soft)" }}
        >
          <span className="truncate">{f.short}</span>
          {f.citedBy && (
            <span
              className="shrink-0 rounded-[2px] px-1 text-[8.5px] leading-none py-[2px]"
              style={{
                background: "var(--seal)",
                color: "var(--paper)",
                fontFamily: "var(--font-legal-sans)",
              }}
              title={`监管高频引用：${f.citedBy}`}
            >
              监管高频
            </span>
          )}
        </span>
        <span
          className="block text-[10px] leading-tight"
          style={{ color: "var(--ink-muted)" }}
        >
          {f.hint}
        </span>
      </span>
    </button>
  );
}

function FrameworkGroup({
  title,
  frameworks,
  selected,
  onToggle,
}: {
  title: string;
  frameworks: Array<Pick<CnFrameworkOption, "code" | "short" | "full" | "year" | "hint" | "citedBy">>;
  selected: string[];
  onToggle: (code: string) => void;
}) {
  if (frameworks.length === 0) return null;
  return (
    <div className="mb-2.5">
      <div
        className="mb-1 text-[10px] uppercase tracking-[0.18em]"
        style={{
          color: "var(--ink-muted)",
          fontFamily: "var(--font-legal-sans)",
        }}
      >
        {title}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {frameworks.map((f) => (
          <FrameworkChip
            key={f.code}
            f={f}
            active={selected.includes(f.code)}
            onClick={() => onToggle(f.code)}
          />
        ))}
      </div>
    </div>
  );
}

function FrameworkSubGroup({
  title,
  frameworks,
  selected,
  onToggle,
}: {
  title: string;
  frameworks: CnFrameworkOption[];
  selected: string[];
  onToggle: (code: string) => void;
}) {
  if (frameworks.length === 0) return null;
  return (
    <div className="mb-2 ml-2 border-l-[2px] pl-2" style={{ borderColor: "var(--rule)" }}>
      <div
        className="mb-1 text-[10px]"
        style={{
          color: "var(--ink-muted)",
          fontFamily: "var(--font-legal-sans)",
          letterSpacing: "0.08em",
        }}
      >
        · {title}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {frameworks.map((f) => (
          <FrameworkChip
            key={f.code}
            f={f}
            active={selected.includes(f.code)}
            onClick={() => onToggle(f.code)}
          />
        ))}
      </div>
    </div>
  );
}

const REGULATOR_META: Record<
  ControlPointGroup["regulator"],
  { color: string; short: string }
> = {
  CAC: { color: "var(--vermilion)", short: "网信办" },
  MPS: { color: "var(--brass)", short: "公安" },
  MIIT: { color: "var(--ink-soft)", short: "工信" },
  SAMR: { color: "var(--ink-soft)", short: "市监" },
  JOINT: { color: "var(--seal)", short: "联合" },
};

function ControlPointGroupBlock({
  group,
  selected,
  onToggle,
}: {
  group: ControlPointGroup;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const meta = REGULATOR_META[group.regulator];
  const groupSelected = group.points.filter((p) => selected.includes(p.id)).length;
  return (
    <div>
      <div
        className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em]"
        style={{
          color: "var(--ink-muted)",
          fontFamily: "var(--font-legal-sans)",
        }}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: meta.color }}
        />
        {group.label}
        <span
          className="normal-case tracking-normal"
          style={{ color: "var(--ink-soft)" }}
        >
          {groupSelected}/{group.points.length}
        </span>
      </div>
      <div className="space-y-1">
        {group.points.map((p) => {
          const active = selected.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onToggle(p.id)}
              title={`${p.desc}\n\n依据：${p.basis}\n案例：${p.precedent}`}
              className="group flex w-full items-start gap-2 rounded-sm border px-2 py-1.5 text-left transition-colors"
              style={{
                borderColor: active ? "var(--vermilion)" : "var(--rule)",
                backgroundColor: active
                  ? "var(--vermilion-wash)"
                  : "var(--paper)",
              }}
            >
              <span
                className="mt-[3px] inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-[2px] border text-[9px]"
                style={{
                  borderColor: active ? "var(--vermilion)" : "var(--rule)",
                  backgroundColor: active ? "var(--vermilion)" : "transparent",
                  color: active ? "#fff" : "transparent",
                }}
              >
                ✓
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span
                    className="text-[10px]"
                    style={{
                      color: meta.color,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    [{meta.short}]
                  </span>
                  <span
                    className="text-[11.5px] font-medium leading-snug"
                    style={{
                      color: "var(--ink)",
                      fontFamily: "var(--font-legal-sans)",
                    }}
                  >
                    {p.title}
                  </span>
                  <span
                    className="ml-auto shrink-0 rounded-sm border px-1 text-[9px]"
                    style={{
                      borderColor:
                        p.severity === "high"
                          ? "var(--vermilion)"
                          : "var(--brass)",
                      color:
                        p.severity === "high"
                          ? "var(--vermilion)"
                          : "var(--brass)",
                    }}
                  >
                    {p.severity === "high" ? "高" : "中"}
                  </span>
                </span>
                <span
                  className="mt-0.5 line-clamp-1 block text-[10.5px]"
                  style={{
                    color: "var(--ink-soft)",
                    fontFamily: "var(--font-legal-sans)",
                  }}
                >
                  {p.basis}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
 * Component
 * ============================================================ */

export function AuditWorkbench() {
  const [config, setConfig] = useState<ConfigPayload | null>(null);

  const [agreement, setAgreement] = useState<string>("");
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("CN");
  const [relation, setRelation] = useState<DpaRelation>("controller_processor");
  const [partyRoleCode, setPartyRoleCode] = useState<string>("");
  const [cnFrameworks, setCnFrameworks] = useState<string[]>([
    "PIPL",
    "CSL",
    "DSL",
    "GB_35273",
  ]);
  const [euFrameworks, setEuFrameworks] = useState<string[]>([
    "GDPR",
    "EDPB_07_2020_CTRL_PROC",
    "SCC_2021",
  ]);
  const [usFrameworks, setUsFrameworks] = useState<string[]>([
    "CCPA_CPRA",
    "HIPAA",
    "EO_14117",
  ]);
  const [selectedControlPoints, setSelectedControlPoints] = useState<string[]>([]);
  const [controlPanelOpen, setControlPanelOpen] = useState<boolean>(false);
  const [depth, setDepth] = useState<Depth>("standard");
  const [role, setRole] = useState<string>("数据处理方");

  const [running, setRunning] = useState<boolean>(false);
  const [content, setContent] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);

  // 拉取配置
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data: ConfigPayload) => setConfig(data))
      .catch(() => setError("配置加载失败，请刷新页面"));
  }, []);

  const risks = useMemo(() => extractRisks(content), [content]);
  const highCount = risks.filter((r) => r.level === "high").length;
  const mediumCount = risks.filter((r) => r.level === "medium").length;
  const lowCount = risks.filter((r) => r.level === "low").length;

  const renderedHtml = useMemo(() => {
    if (!content) return "";
    try {
      return marked.parse(content) as string;
    } catch {
      return content;
    }
  }, [content]);

  useEffect(() => {
    if (running && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [content, running]);

  const currentRelation = useMemo(
    () => config?.relations.find((r) => r.code === relation),
    [config, relation],
  );

  const currentPartyRole = useMemo(
    () =>
      config?.partyRoles?.[relation]?.find((p) => p.code === partyRoleCode) ??
      null,
    [config, relation, partyRoleCode],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  }, []);

  const handleReset = useCallback(() => {
    handleStop();
    setContent("");
    setError("");
    setFinishedAt(null);
    setStartedAt(null);
  }, [handleStop]);

  const handleLoadSample = useCallback(async () => {
    try {
      const res = await fetch("/api/sample");
      const data = (await res.json()) as { agreement?: string };
      if (data.agreement) setAgreement(data.agreement);
    } catch {
      setError("示例加载失败，请检查网络");
    }
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    if (file.size > 500 * 1024) {
      setError("文件超过 500KB，请截取核心条款后再上传");
      return;
    }
    try {
      const text = await file.text();
      setAgreement(text);
      setError("");
    } catch {
      setError("文件读取失败");
    }
  }, []);

  const toggleCnFramework = useCallback((code: string) => {
    setCnFrameworks((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }, []);

  const toggleEuFramework = useCallback((code: string) => {
    setEuFrameworks((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }, []);

  const toggleUsFramework = useCallback((code: string) => {
    setUsFrameworks((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }, []);

  const handleRun = useCallback(async () => {
    const trimmed = agreement.trim();
    if (!trimmed) {
      setError("请先粘贴或上传待审阅的协议正文");
      return;
    }
    setError("");
    setContent("");
    setFinishedAt(null);
    setStartedAt(Date.now());
    setRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const controlPointsPayload =
        jurisdiction === "CN" && config && selectedControlPoints.length > 0
          ? config.controlPoints
              .flatMap((g) =>
                g.points
                  .filter((p) => selectedControlPoints.includes(p.id))
                  .map((p) => ({ ...p, regulator: g.regulator })),
              )
          : [];

      const partyRolePayload =
        config?.partyRoles?.[relation]?.find((p) => p.code === partyRoleCode) ??
        null;

      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agreement: trimmed,
          jurisdiction,
          relation,
          cnFrameworks: jurisdiction === "CN" ? cnFrameworks : [],
          euFrameworks: jurisdiction === "GDPR" ? euFrameworks : [],
          usFrameworks: jurisdiction === "CCPA" ? usFrameworks : [],
          controlPoints: controlPointsPayload,
          partyRole: partyRolePayload,
          depth,
          role,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errBody = await res.text();
        throw new Error(errBody || `请求失败 (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const evtLine = part.split("\n").find((l) => l.startsWith("event:"));
          const dataLine = part.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const payload = dataLine.slice(5).trim();
          const eventName = evtLine ? evtLine.slice(6).trim() : "message";

          try {
            const data = JSON.parse(payload);
            if (eventName === "delta" && data.text) {
              setContent((prev) => prev + data.text);
            } else if (eventName === "done") {
              setFinishedAt(data.finishedAt ?? Date.now());
            } else if (eventName === "error") {
              setError(data.message ?? "审阅失败");
            }
          } catch {
            // 忽略非 JSON 片段
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message || "审阅过程发生异常");
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [agreement, jurisdiction, relation, cnFrameworks, euFrameworks, usFrameworks, selectedControlPoints, config, depth, role, partyRoleCode]);

  const groupedFrameworks = useMemo(() => {
    const result = {
      core: [] as CnFrameworkOption[],
      regulation: [] as CnFrameworkOption[],
      gb: {
        foundation: [] as CnFrameworkOption[],
        pi: [] as CnFrameworkOption[],
        data: [] as CnFrameworkOption[],
        sector: [] as CnFrameworkOption[],
      },
      practice: [] as CnFrameworkOption[],
    };
    if (!config) return result;
    for (const f of config.cnFrameworks) {
      if (f.category === "gb") {
        const g = f.group ?? "foundation";
        result.gb[g].push(f);
      } else if (f.category === "core") {
        result.core.push(f);
      } else if (f.category === "regulation") {
        result.regulation.push(f);
      } else if (f.category === "practice") {
        result.practice.push(f);
      }
    }
    return result;
  }, [config]);

  const groupedEuFrameworks = useMemo(() => {
    const buckets: Record<EuFrameworkOption["category"], EuFrameworkOption[]> = {
      core: [],
      act: [],
      guideline: [],
      transfer: [],
      sector: [],
    };
    if (config) {
      for (const f of config.euFrameworks) buckets[f.category].push(f);
    }
    return buckets;
  }, [config]);

  const groupedUsFrameworks = useMemo(() => {
    const buckets: Record<UsFrameworkOption["category"], UsFrameworkOption[]> = {
      federal: [],
      executive: [],
      "state-comprehensive": [],
      "state-sector": [],
      agency: [],
    };
    if (config) {
      for (const f of config.usFrameworks) buckets[f.category].push(f);
    }
    return buckets;
  }, [config]);

  return (
    <>
      {/* 顶部免责声明横幅 */}
      <div
        className="mb-6 flex items-start gap-3 rounded-sm border px-4 py-3 text-xs leading-relaxed"
        style={{
          borderColor: "var(--vermilion)",
          background: "rgba(241,216,206,0.35)",
          color: "var(--ink)",
          fontFamily: "var(--font-legal-serif)",
        }}
      >
        <AlertTriangle
          className="mt-0.5 h-3.5 w-3.5 shrink-0"
          style={{ color: "var(--vermilion)" }}
          strokeWidth={1.8}
        />
        <div className="flex-1">
          <span
            className="font-semibold"
            style={{ color: "var(--vermilion)" }}
          >
            免责声明 · Disclaimer：
          </span>
          <span>
            本工具为研究与起草辅助工具，
            <strong>不构成法律意见</strong>
            ，不建立律师—客户关系。所有输出（含条款批注、风险分级、监管管控点核查）
            <strong>必须经合格律师独立核实后方可依赖</strong>
            。请勿输入保密客户信息或受特权保护的材料。详见项目根目录{" "}
            <code
              className="rounded px-1 py-0.5 text-[11px]"
              style={{ background: "rgba(247,243,234,0.9)" }}
            >
              DISCLAIMER.md
            </code>
            。
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_320px]">
      {/* 左：卷宗录入 */}
      <aside
        className="rounded-sm border p-5"
        style={{
          borderColor: "var(--rule)",
          background: "rgba(247,243,234,0.75)",
          boxShadow: "0 1px 0 var(--rule)",
        }}
      >
        <div className="mb-4 flex items-center gap-2">
          <ScrollText
            className="h-4 w-4"
            style={{ color: "var(--brass)" }}
            strokeWidth={1.6}
          />
          <span
            className="text-sm font-semibold tracking-wide"
            style={{ color: "var(--ink)", fontFamily: "var(--font-legal-serif)" }}
          >
            卷宗录入
          </span>
        </div>

        <label
          className="mb-2 block text-xs"
          style={{ color: "var(--ink-muted)", fontFamily: "var(--font-legal-sans)" }}
        >
          协议正文
        </label>
        <textarea
          value={agreement}
          onChange={(e) => setAgreement(e.target.value)}
          placeholder="将协议正文粘贴至此，或上传 .txt / .md 文件开始核阅。"
          className="min-h-[220px] w-full resize-y bg-transparent p-3 text-[14px] leading-relaxed outline-none"
          style={{
            color: "var(--ink)",
            fontFamily: "var(--font-legal-serif)",
            borderTop: "1px solid var(--rule)",
            borderBottom: "1px solid var(--rule)",
            background: "rgba(255,255,255,0.4)",
          }}
        />
        <div className="mt-2 flex items-center justify-between">
          <span
            className="text-[11px]"
            style={{
              color: "var(--ink-muted)",
              fontFamily: "var(--font-legal-mono)",
            }}
          >
            {agreement.length.toLocaleString()} chars · 上限 60,000
          </span>
          <div className="flex items-center gap-3">
            <label
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs hover:underline"
              style={{ color: "var(--brass)", fontFamily: "var(--font-legal-sans)" }}
            >
              <FileUp className="h-3.5 w-3.5" strokeWidth={1.6} />
              上传 .txt / .md
              <input
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              onClick={handleLoadSample}
              className="inline-flex items-center gap-1.5 text-xs hover:underline"
              style={{ color: "var(--brass)", fontFamily: "var(--font-legal-sans)" }}
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.6} />
              加载示例
            </button>
          </div>
        </div>

        {/* DPA 关系类型（重点强调） */}
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-1.5">
            <GitBranch
              className="h-3.5 w-3.5"
              style={{ color: "var(--vermilion)" }}
              strokeWidth={1.6}
            />
            <span
              className="text-xs font-semibold"
              style={{ color: "var(--ink)", fontFamily: "var(--font-legal-sans)" }}
            >
              DPA 关系类型
            </span>
          </div>
          <div className="grid gap-1.5">
            {config?.relations.map((r) => {
              const active = r.code === relation;
              return (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => {
                    setRelation(r.code);
                    setPartyRoleCode("");
                  }}
                  className="rounded-sm border px-3 py-2 text-left text-xs transition-colors"
                  style={{
                    borderColor: active ? "var(--vermilion)" : "var(--rule)",
                    background: active ? "var(--vermilion-wash)" : "transparent",
                    color: active ? "var(--seal)" : "var(--ink-soft)",
                    fontFamily: "var(--font-legal-sans)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-sm font-semibold tracking-tight"
                      style={{
                        color: active ? "var(--seal)" : "var(--ink)",
                        fontFamily: "var(--font-legal-sans)",
                      }}
                    >
                      {r.label}
                    </span>
                  </div>
                  <div
                    className="mt-0.5 text-[11px]"
                    style={{
                      color: active ? "var(--seal)" : "var(--ink-muted)",
                    }}
                  >
                    {r.hint} · 依据 {r.ref}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 审阅立场 / Party you represent */}
        {config?.partyRoles?.[relation] && config.partyRoles[relation].length > 0 && (
          <div className="mt-5">
            <div className="mb-2 flex items-center gap-1.5">
              <PenLine
                className="h-3.5 w-3.5"
                strokeWidth={1.5}
                style={{ color: "var(--vermilion)" }}
              />
              <span
                className="text-xs font-semibold"
                style={{ color: "var(--ink)", fontFamily: "var(--font-legal-sans)" }}
              >
                审阅立场 · Party you represent
              </span>
              {partyRoleCode && (
                <span
                  className="ml-auto rounded-sm px-1.5 py-[1px] text-[10px]"
                  style={{
                    background: "var(--vermilion)",
                    color: "var(--paper)",
                    fontFamily: "var(--font-legal-sans)",
                  }}
                >
                  已锁定
                </span>
              )}
            </div>
            <div className="mb-1.5 text-[11px]" style={{ color: "var(--ink-muted)" }}>
              选择审阅者所代表的一方，AI 将站在该方立场分析风险与谈判点。
            </div>
            <div className="grid gap-1.5">
              {config.partyRoles[relation].map((p) => {
                const active = p.code === partyRoleCode;
                return (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() =>
                      setPartyRoleCode(active ? "" : p.code)
                    }
                    className="rounded-sm border px-3 py-2 text-left text-xs transition-colors"
                    style={{
                      borderColor: active ? "var(--seal)" : "var(--rule)",
                      background: active ? "var(--vermilion-wash)" : "transparent",
                      color: active ? "var(--seal)" : "var(--ink-soft)",
                      fontFamily: "var(--font-legal-sans)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="text-sm font-semibold tracking-tight"
                        style={{
                          color: active ? "var(--seal)" : "var(--ink)",
                          fontFamily: "var(--font-legal-sans)",
                        }}
                      >
                        {p.label}
                      </span>
                      <span
                        className="text-[11px]"
                        style={{
                          color: active ? "var(--seal)" : "var(--ink-muted)",
                        }}
                      >
                        {p.zh}
                      </span>
                    </div>
                    <div
                      className="mt-0.5 text-[11px] leading-snug"
                      style={{
                        color: active ? "var(--seal)" : "var(--ink-muted)",
                      }}
                    >
                      {p.hint}
                    </div>
                    {active && (
                      <div
                        className="mt-1 border-t pt-1 text-[11px] leading-snug"
                        style={{
                          borderColor: "var(--vermilion-wash)",
                          color: "var(--seal)",
                        }}
                      >
                        <span className="font-semibold">立场关注：</span>
                        {p.stance}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 适用法域 */}
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-1.5">
            <Landmark
              className="h-3.5 w-3.5"
              style={{ color: "var(--brass)" }}
              strokeWidth={1.6}
            />
            <span
              className="text-xs font-semibold"
              style={{ color: "var(--ink)", fontFamily: "var(--font-legal-sans)" }}
            >
              适用法域
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {config?.jurisdictions.map((j) => {
              const active = j.code === jurisdiction;
              return (
                <button
                  key={j.code}
                  type="button"
                  onClick={() => setJurisdiction(j.code)}
                  className="rounded-sm border px-2 py-1.5 text-center text-xs transition-colors"
                  style={{
                    borderColor: active ? "var(--brass)" : "var(--rule)",
                    background: active ? "var(--paper-deep)" : "transparent",
                    color: active ? "var(--ink)" : "var(--ink-soft)",
                    fontFamily: "var(--font-legal-sans)",
                  }}
                  title={j.hint}
                >
                  <div
                    className="text-xs font-semibold"
                    style={{ color: active ? "var(--brass)" : "var(--ink-soft)" }}
                  >
                    {j.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 中国法域下的法规矩阵 */}
        {jurisdiction === "CN" && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <BookOpen
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--brass)" }}
                  strokeWidth={1.6}
                />
                <span
                  className="text-xs font-semibold"
                  style={{
                    color: "var(--ink)",
                    fontFamily: "var(--font-legal-sans)",
                  }}
                >
                  中国法规矩阵
                </span>
                <span
                  className="text-[10px]"
                  style={{
                    color: "var(--ink-muted)",
                    fontFamily: "var(--font-legal-mono)",
                  }}
                >
                  {cnFrameworks.length}/{config?.cnFrameworks.length ?? 0}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <button
                  type="button"
                  onClick={() =>
                    setCnFrameworks(config?.cnFrameworks.map((f) => f.code) ?? [])
                  }
                  className="hover:underline"
                  style={{
                    color: "var(--brass)",
                    fontFamily: "var(--font-legal-sans)",
                  }}
                >
                  全选
                </button>
                <span style={{ color: "var(--rule)" }}>|</span>
                <button
                  type="button"
                  onClick={() => setCnFrameworks([])}
                  className="hover:underline"
                  style={{
                    color: "var(--ink-muted)",
                    fontFamily: "var(--font-legal-sans)",
                  }}
                >
                  清空
                </button>
              </div>
            </div>

            {/* 场景预设 */}
            {config?.cnPresets && config.cnPresets.length > 0 && (
              <div className="mb-3">
                <div
                  className="mb-1 text-[10px] uppercase tracking-[0.18em]"
                  style={{
                    color: "var(--ink-muted)",
                    fontFamily: "var(--font-legal-sans)",
                  }}
                >
                  场景预设
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {config.cnPresets.map((preset) => (
                    <button
                      key={preset.code}
                      type="button"
                      onClick={() => setCnFrameworks(preset.frameworks)}
                      className="rounded-sm border px-2 py-1 text-[11px] transition-colors hover:border-[var(--brass)]"
                      style={{
                        borderColor: "var(--rule)",
                        color: "var(--ink-soft)",
                        background: "var(--paper)",
                        fontFamily: "var(--font-legal-sans)",
                      }}
                      title={preset.hint}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 核心三法 */}
            <FrameworkGroup
              title={CATEGORY_LABEL.core}
              frameworks={groupedFrameworks.core}
              selected={cnFrameworks}
              onToggle={toggleCnFramework}
            />
            {/* 配套法规 */}
            <FrameworkGroup
              title={CATEGORY_LABEL.regulation}
              frameworks={groupedFrameworks.regulation}
              selected={cnFrameworks}
              onToggle={toggleCnFramework}
            />

            {/* 国家标准（含四组子分类） */}
            <div className="mb-2.5">
              <div
                className="mb-1 flex items-center gap-1.5"
                style={{
                  color: "var(--ink-muted)",
                  fontFamily: "var(--font-legal-sans)",
                }}
              >
                <span className="text-[10px] uppercase tracking-[0.18em]">
                  {CATEGORY_LABEL.gb}
                </span>
                <span className="h-px flex-1" style={{ background: "var(--rule)" }} />
              </div>
              {(["foundation", "pi", "data", "sector"] as const).map((g) => {
                const items = groupedFrameworks.gb[g];
                if (items.length === 0) return null;
                return (
                  <FrameworkSubGroup
                    key={g}
                    title={GROUP_LABEL[g]}
                    frameworks={items}
                    selected={cnFrameworks}
                    onToggle={toggleCnFramework}
                  />
                );
              })}
            </div>

            {/* 实践指南 */}
            {groupedFrameworks.practice.length > 0 && (
              <FrameworkGroup
                title={CATEGORY_LABEL.practice}
                frameworks={groupedFrameworks.practice}
                selected={cnFrameworks}
                onToggle={toggleCnFramework}
              />
            )}
          </div>
        )}

        {/* EU 法规矩阵 */}
        {jurisdiction === "GDPR" &&
          config &&
          config.euFrameworks.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <BookOpen
                    className="h-3.5 w-3.5"
                    style={{ color: "var(--brass)" }}
                    strokeWidth={1.6}
                  />
                  <span
                    className="text-xs font-semibold"
                    style={{
                      color: "var(--ink)",
                      fontFamily: "var(--font-legal-sans)",
                    }}
                  >
                    欧盟法规矩阵
                  </span>
                  <span
                    className="text-[10px]"
                    style={{
                      color: "var(--ink-muted)",
                      fontFamily: "var(--font-legal-mono)",
                    }}
                  >
                    {euFrameworks.length}/{config.euFrameworks.length}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() =>
                      setEuFrameworks(config.euFrameworks.map((f) => f.code))
                    }
                    className="hover:underline"
                    style={{
                      color: "var(--brass)",
                      fontFamily: "var(--font-legal-sans)",
                    }}
                  >
                    全选
                  </button>
                  <span style={{ color: "var(--rule)" }}>|</span>
                  <button
                    type="button"
                    onClick={() => setEuFrameworks([])}
                    className="hover:underline"
                    style={{
                      color: "var(--ink-muted)",
                      fontFamily: "var(--font-legal-sans)",
                    }}
                  >
                    清空
                  </button>
                </div>
              </div>

              {config.euPresets && config.euPresets.length > 0 && (
                <div className="mb-3">
                  <div
                    className="mb-1 text-[10px] uppercase tracking-[0.18em]"
                    style={{
                      color: "var(--ink-muted)",
                      fontFamily: "var(--font-legal-sans)",
                    }}
                  >
                    场景预设
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {config.euPresets.map((preset) => (
                      <button
                        key={preset.code}
                        type="button"
                        onClick={() => setEuFrameworks(preset.frameworks)}
                        className="rounded-sm border px-2 py-1 text-[11px] transition-colors hover:border-[var(--brass)]"
                        style={{
                          borderColor: "var(--rule)",
                          color: "var(--ink-soft)",
                          background: "var(--paper)",
                          fontFamily: "var(--font-legal-sans)",
                        }}
                        title={preset.hint}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(
                ["core", "act", "guideline", "transfer", "sector"] as const
              ).map((cat) => (
                <FrameworkGroup
                  key={cat}
                  title={EU_CATEGORY_LABEL[cat]}
                  frameworks={groupedEuFrameworks[cat]}
                  selected={euFrameworks}
                  onToggle={toggleEuFramework}
                />
              ))}
            </div>
          )}

        {/* 美国法规矩阵 */}
        {jurisdiction === "CCPA" &&
          config &&
          config.usFrameworks.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <BookOpen
                    className="h-3.5 w-3.5"
                    style={{ color: "var(--brass)" }}
                    strokeWidth={1.6}
                  />
                  <span
                    className="text-xs font-semibold"
                    style={{
                      color: "var(--ink)",
                      fontFamily: "var(--font-legal-sans)",
                    }}
                  >
                    美国法规矩阵
                  </span>
                  <span
                    className="text-[10px]"
                    style={{
                      color: "var(--ink-muted)",
                      fontFamily: "var(--font-legal-mono)",
                    }}
                  >
                    {usFrameworks.length}/{config.usFrameworks.length}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() =>
                      setUsFrameworks(config.usFrameworks.map((f) => f.code))
                    }
                    className="hover:underline"
                    style={{
                      color: "var(--brass)",
                      fontFamily: "var(--font-legal-sans)",
                    }}
                  >
                    全选
                  </button>
                  <span style={{ color: "var(--rule)" }}>|</span>
                  <button
                    type="button"
                    onClick={() => setUsFrameworks([])}
                    className="hover:underline"
                    style={{
                      color: "var(--ink-muted)",
                      fontFamily: "var(--font-legal-sans)",
                    }}
                  >
                    清空
                  </button>
                </div>
              </div>

              {config.usPresets && config.usPresets.length > 0 && (
                <div className="mb-3">
                  <div
                    className="mb-1 text-[10px] uppercase tracking-[0.18em]"
                    style={{
                      color: "var(--ink-muted)",
                      fontFamily: "var(--font-legal-sans)",
                    }}
                  >
                    场景预设
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {config.usPresets.map((preset) => (
                      <button
                        key={preset.code}
                        type="button"
                        onClick={() => setUsFrameworks(preset.frameworks)}
                        className="rounded-sm border px-2 py-1 text-[11px] transition-colors hover:border-[var(--brass)]"
                        style={{
                          borderColor: "var(--rule)",
                          color: "var(--ink-soft)",
                          background: "var(--paper)",
                          fontFamily: "var(--font-legal-sans)",
                        }}
                        title={preset.hint}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(
                [
                  "federal",
                  "executive",
                  "state-comprehensive",
                  "state-sector",
                  "agency",
                ] as const
              ).map((cat) => (
                <FrameworkGroup
                  key={cat}
                  title={US_CATEGORY_LABEL[cat]}
                  frameworks={groupedUsFrameworks[cat]}
                  selected={usFrameworks}
                  onToggle={toggleUsFramework}
                />
              ))}
            </div>
          )}

        {/* 监管管控点 · 案例参考 */}
        {jurisdiction === "CN" &&
          config?.controlPoints &&
          config.controlPoints.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setControlPanelOpen((v) => !v)}
                className="flex w-full items-center justify-between border-b pb-1.5 text-left"
                style={{ borderColor: "var(--rule)" }}
              >
                <div className="flex items-center gap-2">
                  <PenLine
                    size={13}
                    strokeWidth={1.6}
                    style={{ color: "var(--vermilion)" }}
                  />
                  <span
                    className="text-xs font-semibold"
                    style={{
                      color: "var(--ink)",
                      fontFamily: "var(--font-legal-sans)",
                    }}
                  >
                    监管管控点 · 案例参考
                  </span>
                  <span
                    className="rounded-sm border px-1.5 py-0.5 text-[10px]"
                    style={{
                      borderColor: "var(--rule)",
                      color: "var(--ink-soft)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {selectedControlPoints.length}/
                    {config.controlPoints.reduce(
                      (acc, g) => acc + g.points.length,
                      0,
                    )}
                  </span>
                </div>
                <span
                  className="text-[11px]"
                  style={{ color: "var(--ink-soft)" }}
                >
                  {controlPanelOpen ? "收起" : "展开"}
                </span>
              </button>

              {controlPanelOpen && (
                <div className="mt-2 space-y-3">
                  {/* 预设按钮 */}
                  {config.controlPresets && config.controlPresets.length > 0 && (
                    <div>
                      <div
                        className="mb-1.5 text-[10px] uppercase tracking-wider"
                        style={{
                          color: "var(--ink-soft)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        场景预设
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {config.controlPresets.map((preset) => (
                          <button
                            key={preset.code}
                            type="button"
                            onClick={() =>
                              setSelectedControlPoints(preset.points)
                            }
                            className="rounded-sm border px-2 py-1 text-[11px] transition-colors hover:bg-[var(--paper-deep)]"
                            style={{
                              borderColor: "var(--rule)",
                              color: "var(--ink)",
                            }}
                            title={preset.hint}
                          >
                            {preset.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setSelectedControlPoints([])}
                          className="rounded-sm border px-2 py-1 text-[11px] transition-colors hover:bg-[var(--paper-deep)]"
                          style={{
                            borderColor: "var(--rule)",
                            color: "var(--ink-soft)",
                          }}
                        >
                          清空
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 分组列表 */}
                  {config.controlPoints.map((group) => (
                    <ControlPointGroupBlock
                      key={group.regulator}
                      group={group}
                      selected={selectedControlPoints}
                      onToggle={(id) =>
                        setSelectedControlPoints((prev) =>
                          prev.includes(id)
                            ? prev.filter((x) => x !== id)
                            : [...prev, id],
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

        {/* 审阅深度 + 委托方视角 */}
        <div className="mt-4 grid gap-3">
          <div>
            <div
              className="mb-1.5 text-xs font-semibold"
              style={{ color: "var(--ink)", fontFamily: "var(--font-legal-sans)" }}
            >
              审阅深度
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {DEPTHS.map((d) => {
                const active = d.code === depth;
                return (
                  <button
                    key={d.code}
                    type="button"
                    onClick={() => setDepth(d.code)}
                    className="rounded-sm border px-2 py-1.5 text-center text-xs transition-colors"
                    style={{
                      borderColor: active ? "var(--brass)" : "var(--rule)",
                      background: active ? "var(--paper-deep)" : "transparent",
                      fontFamily: "var(--font-legal-sans)",
                    }}
                    title={d.hint}
                  >
                    <div
                      className="text-xs font-semibold"
                      style={{
                        color: active ? "var(--brass)" : "var(--ink-soft)",
                      }}
                    >
                      {d.label}
                    </div>
                    <div
                      className="text-[10px]"
                      style={{ color: "var(--ink-muted)" }}
                    >
                      {d.hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              className="mb-1.5 block text-xs font-semibold"
              style={{ color: "var(--ink)", fontFamily: "var(--font-legal-sans)" }}
            >
              委托方视角
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="如：数据控制方 / 数据处理方 / 平台方"
              className="w-full bg-transparent py-1.5 text-sm outline-none"
              style={{
                color: "var(--ink)",
                borderBottom: "1px solid var(--rule)",
                fontFamily: "var(--font-legal-serif)",
              }}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          {!running ? (
            <button
              type="button"
              onClick={handleRun}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-sm px-4 py-2.5 text-sm font-semibold transition-transform hover:-translate-y-[1px]"
              style={{
                background: "var(--ink)",
                color: "var(--paper)",
                boxShadow: "0 2px 0 var(--brass)",
                fontFamily: "var(--font-legal-serif)",
              }}
            >
              <Play className="h-4 w-4" strokeWidth={1.8} />
              开始核阅
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-sm px-4 py-2.5 text-sm font-semibold"
              style={{
                background: "var(--seal)",
                color: "var(--paper)",
                boxShadow: "0 2px 0 var(--ink-soft)",
                fontFamily: "var(--font-legal-serif)",
              }}
            >
              <Square className="h-4 w-4" strokeWidth={1.8} />
              终止批阅
            </button>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-sm border px-3 py-2.5 text-xs"
            style={{
              borderColor: "var(--rule)",
              color: "var(--ink-soft)",
              fontFamily: "var(--font-legal-sans)",
            }}
            title="清空批阅结果"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.6} />
            重置
          </button>
        </div>

        {error && (
          <div
            className="mt-4 rounded-sm border p-3 text-xs"
            style={{
              borderColor: "var(--vermilion)",
              background: "var(--vermilion-wash)",
              color: "var(--seal)",
              fontFamily: "var(--font-legal-sans)",
            }}
          >
            {error}
          </div>
        )}
      </aside>

      {/* 中：审阅意见书 */}
      <section
        className="relative rounded-sm border"
        style={{
          borderColor: "var(--rule)",
          background: "var(--paper)",
          boxShadow: "0 1px 0 var(--rule), 4px 4px 0 var(--paper-shadow)",
        }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-3"
          style={{ borderColor: "var(--rule)" }}
        >
          <div className="flex items-center gap-2">
            <PenLine
              className="h-4 w-4"
              style={{ color: "var(--vermilion)" }}
              strokeWidth={1.8}
            />
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--ink)", fontFamily: "var(--font-legal-serif)" }}
            >
              合规审核意见书
            </span>
            {currentRelation && (
              <span
                className="ml-2 rounded-sm border px-1.5 py-0.5 text-[10px]"
                style={{
                  borderColor: "var(--brass)",
                  color: "var(--brass)",
                  fontFamily: "var(--font-legal-sans)",
                }}
              >
                {currentRelation.label}
              </span>
            )}
            {currentPartyRole && (
              <span
                className="ml-1 rounded-sm px-1.5 py-0.5 text-[10px]"
                style={{
                  background: "var(--vermilion)",
                  color: "var(--paper)",
                  fontFamily: "var(--font-legal-sans)",
                }}
                title={`审阅立场 · Party you represent`}
              >
                代表 · {currentPartyRole.label}
              </span>
            )}
          </div>
          <div
            className="flex items-center gap-4 text-[11px]"
            style={{
              color: "var(--ink-muted)",
              fontFamily: "var(--font-legal-mono)",
            }}
          >
            {startedAt && (
              <span>
                开卷：
                {new Date(startedAt).toLocaleTimeString("zh-CN", {
                  hour12: false,
                })}
              </span>
            )}
            {finishedAt && (
              <span>
                结卷：
                {new Date(finishedAt).toLocaleTimeString("zh-CN", {
                  hour12: false,
                })}
              </span>
            )}
          </div>
        </div>

        {running && <div className="pen-scribble-bar h-[3px]" aria-hidden="true" />}

        <div
          ref={outputRef}
          className="max-h-[720px] overflow-y-auto px-8 py-6 md:px-12 md:py-8"
        >
          {!content && !running && (
            <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
              <div
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border"
                style={{
                  borderColor: "var(--brass-soft)",
                  color: "var(--brass)",
                }}
              >
                <ScrollText className="h-6 w-6" strokeWidth={1.4} />
              </div>
              <div
                className="text-lg font-semibold"
                style={{ color: "var(--ink)", fontFamily: "var(--font-legal-serif)" }}
              >
                台灯已亮，等待卷宗
              </div>
              <p
                className="mt-2 max-w-md text-sm leading-relaxed"
                style={{
                  color: "var(--ink-muted)",
                  fontFamily: "var(--font-legal-serif)",
                }}
              >
                粘贴协议正文，确认 DPA 关系类型与适用法规矩阵，笔已经蘸好朱砂。
              </p>
            </div>
          )}

          {content && (
            <article
              className="legal-prose"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          )}
          {running && (
            <div
              className="mt-2 inline-flex items-center gap-2 text-xs"
              style={{
                color: "var(--vermilion)",
                fontFamily: "var(--font-legal-sans)",
              }}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.6} />
              <span className="pen-caret">正在批阅</span>
            </div>
          )}
        </div>

        {finishedAt && content && (
          <div className="absolute right-6 top-16">
            <div className="seal-stamp text-xs">
              已核阅 · {new Date(finishedAt).toLocaleDateString("zh-CN")}
            </div>
          </div>
        )}
      </section>

      {/* 右：朱批栏 */}
      <aside className="space-y-3">
        {/* 当前关系类型说明 */}
        {currentRelation && (
          <div
            className="rounded-sm border p-4"
            style={{
              borderColor: "var(--vermilion)",
              background: "var(--vermilion-wash)",
            }}
          >
            <div
              className="mb-1 text-[10px] uppercase tracking-[0.24em]"
              style={{
                color: "var(--vermilion)",
                fontFamily: "var(--font-legal-sans)",
              }}
            >
              § 当前 DPA 类型
            </div>
            <div
              className="text-sm font-bold"
              style={{ color: "var(--seal)", fontFamily: "var(--font-legal-serif)" }}
            >
              {currentRelation.label}
            </div>
            <div
              className="mt-1 text-[11px] leading-relaxed"
              style={{ color: "var(--seal)", fontFamily: "var(--font-legal-sans)" }}
            >
              依据：{currentRelation.ref}
            </div>
            {currentPartyRole && (
              <div
                className="mt-2 border-t pt-2"
                style={{ borderColor: "var(--vermilion)" }}
              >
                <div
                  className="text-[10px] uppercase tracking-[0.24em]"
                  style={{
                    color: "var(--vermilion)",
                    fontFamily: "var(--font-legal-sans)",
                  }}
                >
                  § 审阅立场
                </div>
                <div
                  className="mt-0.5 text-sm font-bold"
                  style={{
                    color: "var(--seal)",
                    fontFamily: "var(--font-legal-serif)",
                  }}
                >
                  {currentPartyRole.label}
                  <span
                    className="ml-1.5 text-[11px] font-normal"
                    style={{ color: "var(--seal)" }}
                  >
                    · {currentPartyRole.zh}
                  </span>
                </div>
                <div
                  className="mt-1 text-[11px] leading-snug"
                  style={{
                    color: "var(--seal)",
                    fontFamily: "var(--font-legal-sans)",
                  }}
                >
                  {currentPartyRole.stance}
                </div>
              </div>
            )}
          </div>
        )}

        <div
          className="rounded-sm border p-4"
          style={{
            borderColor: "var(--rule)",
            background: "rgba(247,243,234,0.85)",
          }}
        >
          <div
            className="mb-3 text-xs uppercase tracking-[0.24em]"
            style={{ color: "var(--brass)", fontFamily: "var(--font-legal-sans)" }}
          >
            § 风险摘要
          </div>
          <div className="grid grid-cols-3 gap-2">
            <RiskBadge label="高" count={highCount} tone="high" />
            <RiskBadge label="中" count={mediumCount} tone="medium" />
            <RiskBadge label="低" count={lowCount} tone="low" />
          </div>
        </div>

        {risks.length === 0 && (
          <div
            className="rounded-sm border p-4 text-xs leading-relaxed"
            style={{
              borderColor: "var(--rule)",
              color: "var(--ink-muted)",
              background: "rgba(247,243,234,0.6)",
              fontFamily: "var(--font-legal-serif)",
            }}
          >
            批阅开始后，识别到的每一条风险都会在此以朱批卡片形式浮出。
          </div>
        )}

        <div className="space-y-3">
          {risks.map((r, idx) => (
            <div key={idx} className="annotation-card">
              <div className="mb-2 flex items-center justify-between">
                <div
                  className="text-[11px]"
                  style={{
                    color: "var(--ink-muted)",
                    fontFamily: "var(--font-legal-mono)",
                  }}
                >
                  批注 №{String(idx + 1).padStart(2, "0")}
                </div>
                {r.level && <LevelChip level={r.level} />}
              </div>
              <div
                className="text-sm font-semibold leading-snug"
                style={{ color: "var(--ink)", fontFamily: "var(--font-legal-serif)" }}
              >
                {r.title}
              </div>
              {r.clause && (
                <div
                  className="mt-2 text-xs leading-relaxed"
                  style={{
                    color: "var(--ink-soft)",
                    fontFamily: "var(--font-legal-serif)",
                  }}
                >
                  <span
                    className="mr-1 text-[10px]"
                    style={{
                      color: "var(--brass)",
                      fontFamily: "var(--font-legal-sans)",
                    }}
                  >
                    条款
                  </span>
                  {r.clause}
                </div>
              )}
              {r.basis && (
                <div
                  className="mt-1 text-xs leading-relaxed"
                  style={{
                    color: "var(--brass)",
                    fontFamily: "var(--font-legal-serif)",
                  }}
                >
                  <span
                    className="mr-1 text-[10px]"
                    style={{
                      color: "var(--brass)",
                      fontFamily: "var(--font-legal-sans)",
                    }}
                  >
                    依据
                  </span>
                  {r.basis}
                </div>
              )}
              {r.remedy && (
                <div
                  className="mt-2 text-xs leading-relaxed"
                  style={{
                    color: "var(--seal)",
                    fontFamily: "var(--font-legal-serif)",
                  }}
                >
                  <span
                    className="mr-1 text-[10px]"
                    style={{
                      color: "var(--vermilion)",
                      fontFamily: "var(--font-legal-sans)",
                    }}
                  >
                    整改
                  </span>
                  {r.remedy}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>
      </div>
    </>
  );
}

function RiskBadge({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "high" | "medium" | "low";
}) {
  const styleMap: Record<
    "high" | "medium" | "low",
    { bg: string; fg: string; border: string }
  > = {
    high: { bg: "var(--vermilion)", fg: "var(--paper)", border: "var(--vermilion)" },
    medium: { bg: "transparent", fg: "var(--brass)", border: "var(--brass)" },
    low: { bg: "transparent", fg: "var(--ink-soft)", border: "var(--ink-soft)" },
  };
  const s = styleMap[tone];
  return (
    <div
      className="rounded-sm border px-2 py-3 text-center"
      style={{ borderColor: s.border, background: s.bg }}
    >
      <div
        className="text-[10px] tracking-widest"
        style={{
          color: tone === "high" ? "var(--paper)" : "var(--ink-muted)",
          fontFamily: "var(--font-legal-sans)",
        }}
      >
        {label}
      </div>
      <div
        className="mt-0.5 text-xl font-semibold"
        style={{ color: s.fg, fontFamily: "var(--font-legal-serif)" }}
      >
        {count}
      </div>
    </div>
  );
}

function LevelChip({ level }: { level: "high" | "medium" | "low" }) {
  const map: Record<
    "high" | "medium" | "low",
    { bg: string; fg: string; border: string }
  > = {
    high: { bg: "var(--vermilion)", fg: "var(--paper)", border: "var(--vermilion)" },
    medium: { bg: "transparent", fg: "var(--brass)", border: "var(--brass)" },
    low: { bg: "transparent", fg: "var(--ink-soft)", border: "var(--ink-soft)" },
  };
  const s = map[level];
  return (
    <span
      className="rounded-sm border px-1.5 py-0.5 text-[10px] tracking-widest"
      style={{
        background: s.bg,
        color: s.fg,
        borderColor: s.border,
        fontFamily: "var(--font-legal-sans)",
      }}
    >
      {LEVEL_LABEL[level]}
    </span>
  );
}
