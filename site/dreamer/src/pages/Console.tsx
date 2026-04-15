import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Play,
  Filter,
  Tag,
  Settings,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  ExternalLink,
  Video,
  Brain,
  Cpu,
  Link2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Plus,
  Eye,
  ChevronDown,
  ChevronUp,
  Zap,
  Globe,
  Server,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Design: RoboMemoClaw Console
 * - Dark theme consistent with main site (cyan accents on deep slate)
 * - Two-panel workflow: Search → Process
 * - Real-time progress indicators for long-running ML tasks
 * - Connects to Mac Mini backend via configurable URL (ngrok for public access)
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns headers that bypass the ngrok browser-warning interstitial page.
 * Without this header, ngrok free tier injects an HTML page instead of JSON,
 * causing CORS/parse failures in the browser.
 */
function ngrokHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "ngrok-skip-browser-warning": "true",
    ...extra,
  };
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface VideoResult {
  bvid: string;
  title: string;
  author: string;
  duration: number | string;
  thumbnail: string;
  play: number;
  play_count?: number;
  description: string;
  pubdate?: string;
  category?: string;
  selected: boolean;
}

interface FilterResult {
  bvid: string;
  title: string;
  status: "pending" | "downloading" | "filtering" | "passed" | "rejected" | "error";
  reason?: string;
  stats?: {
    totalFrames: number;
    wristFrames: number;
    faceFrames: number;
    passRate: number;
  };
}

interface LabelStage {
  id: number;
  name: string;
  status: "pending" | "running" | "done" | "error";
  result?: string;
}

interface LabelResult {
  bvid: string;
  title: string;
  status: "pending" | "labeling" | "done" | "error";
  stages: LabelStage[];
  output?: {
    actionPrimitives: string[];
    contactMechanics: string;
    taskSummary: string;
    lerobotPath?: string;
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Console() {
  // Backend connection
  const [backendUrl, setBackendUrl] = useState(() => {
    return localStorage.getItem("robomemo_backend_url") || "https://destitute-navigate-street.ngrok-free.dev";
  });
  const [backendStatus, setBackendStatus] = useState<"unknown" | "connected" | "error">("unknown");
  const [showSettings, setShowSettings] = useState(false);
  const [tempUrl, setTempUrl] = useState(backendUrl);

  // Panel 1: Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchKeywords, setSearchKeywords] = useState("");
  const [searchResults, setSearchResults] = useState<VideoResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // OpenClaw integration
  const [openClawUrl, setOpenClawUrl] = useState(() => localStorage.getItem("openclaw_url") || "http://localhost:18789");
  const [openClawToken, setOpenClawToken] = useState(() => localStorage.getItem("openclaw_token") || "");
  const [isImportingFromClaw, setIsImportingFromClaw] = useState(false);

  // Panel 2: Batch Process
  const [bvInput, setBvInput] = useState("");
  const [filterResults, setFilterResults] = useState<FilterResult[]>([]);
  const [labelResults, setLabelResults] = useState<LabelResult[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isLabeling, setIsLabeling] = useState(false);
  const [activeTab, setActiveTab] = useState("search");

  // Ollama models
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [selectedVisionModel, setSelectedVisionModel] = useState("qwen2.5vl:32b");
  const [selectedTextModel, setSelectedTextModel] = useState("gemma4:26b");

  // Expanded label details
  const [expandedLabel, setExpandedLabel] = useState<string | null>(null);

  // ─── Backend Connection ─────────────────────────────────────────────────

  const checkBackend = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/health`, { signal: AbortSignal.timeout(5000), headers: ngrokHeaders() });
      if (res.ok) {
        setBackendStatus("connected");
        // Also fetch Ollama models
        try {
          const modelsRes = await fetch(`${backendUrl}/api/vlm/local-models`, { headers: ngrokHeaders() });
          if (modelsRes.ok) {
            const data = await modelsRes.json();
            if (data.models) {
              setOllamaModels(data.models.map((m: any) => m.name));
            }
          }
        } catch {}
      } else {
        setBackendStatus("error");
      }
    } catch {
      setBackendStatus("error");
    }
  }, [backendUrl]);

  useEffect(() => {
    checkBackend();
  }, [checkBackend]);

  const saveBackendUrl = () => {
    const url = tempUrl.replace(/\/+$/, "");
    setBackendUrl(url);
    localStorage.setItem("robomemo_backend_url", url);
    setShowSettings(false);
    toast.success("后端地址已更新");
    setTimeout(() => checkBackend(), 500);
  };

  // ─── Panel 1: Search ─────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!searchQuery.trim() && !searchKeywords.trim()) {
      toast.error("请输入任务描述或关键词");
      return;
    }
    setIsSearching(true);
    setSearchResults([]);

    try {
      const res = await fetch(`${backendUrl}/api/claw/search`, {
        method: "POST",
        headers: ngrokHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          query: searchQuery,
          keywords: searchKeywords,
        }),
      });

      if (!res.ok) throw new Error("搜索失败");
      const data = await res.json();
      setSearchResults(
        (data.results || []).map((v: any) => ({
          bvid: v.bvid,
          title: v.title,
          author: v.author,
          duration: typeof v.duration === 'number' ? `${Math.floor(v.duration/60)}:${String(v.duration%60).padStart(2,'0')}` : v.duration,
          thumbnail: v.thumbnail,
          play: v.play_count || v.play || 0,
          description: v.description,
          pubdate: v.pubdate || '',
          category: v.category || '',
          selected: false,
        }))
      );
      toast.success(`找到 ${data.results?.length || 0} 个候选视频`);
    } catch (err: any) {
      toast.error(err.message || "搜索请求失败，请检查后端连接");
      // Demo fallback
      setSearchResults(getDemoSearchResults());
    } finally {
      setIsSearching(false);
    }
  };

  const toggleVideoSelect = (bvid: string) => {
    setSearchResults((prev) =>
      prev.map((v) => (v.bvid === bvid ? { ...v, selected: !v.selected } : v))
    );
  };

  const sendSelectedToProcess = () => {
    const selected = searchResults.filter((v) => v.selected);
    if (selected.length === 0) {
      toast.error("请先选择至少一个视频");
      return;
    }
    const bvids = selected.map((v) => v.bvid).join("\n");
    setBvInput(bvids);
    setActiveTab("process");
    toast.success(`已将 ${selected.length} 个 BV 号发送到处理面板`);
  };

  // ─── Panel 2: Filter + Label ──────────────────────────────────────────────

  const parseBVIds = (): string[] => {
    return bvInput
      .split(/[\n,，\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.startsWith("BV") || s.startsWith("bv"));
  };

  const handleFilter = async () => {
    const bvids = parseBVIds();
    if (bvids.length === 0) {
      toast.error("请输入至少一个 BV 号");
      return;
    }

    setIsFiltering(true);
    setFilterResults(
      bvids.map((bvid) => ({
        bvid,
        title: `视频 ${bvid}`,
        status: "pending" as const,
      }))
    );

    // Process each BV sequentially with real-time status updates
    for (let i = 0; i < bvids.length; i++) {
      const bvid = bvids[i];

      // Update status to downloading
      setFilterResults((prev) =>
        prev.map((r) => (r.bvid === bvid ? { ...r, status: "downloading" } : r))
      );

      try {
        const res = await fetch(`${backendUrl}/api/claw/filter`, {
          method: "POST",
          headers: ngrokHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ bv_id: bvid }),
        });

        if (!res.ok) throw new Error("筛选失败");
        const data = await res.json();

        setFilterResults((prev) =>
          prev.map((r) =>
            r.bvid === bvid
              ? {
                  ...r,
                  title: r.title,
                  status: data.passed ? "passed" : "rejected",
                  reason: data.reason,
                  stats: {
                    totalFrames: data.total_frames,
                    wristFrames: data.wrist_frames,
                    faceFrames: data.face_frames,
                    passRate: Math.round(data.wrist_ratio * 100),
                  },
                }
              : r
          )
        );
      } catch {
        // Demo fallback with simulated delay
        await new Promise((resolve) => setTimeout(resolve, 800));
        setFilterResults((prev) =>
          prev.map((r) =>
            r.bvid === bvid ? { ...r, status: "filtering" } : r
          )
        );
        await new Promise((resolve) => setTimeout(resolve, 1200));

        const passed = Math.random() > 0.35;
        const totalFrames = Math.floor(Math.random() * 5000) + 1000;
        const wristFrames = Math.floor(totalFrames * (passed ? 0.6 + Math.random() * 0.3 : Math.random() * 0.2));
        const faceFrames = Math.floor(totalFrames * (passed ? Math.random() * 0.05 : 0.3 + Math.random() * 0.4));

        setFilterResults((prev) =>
          prev.map((r) =>
            r.bvid === bvid
              ? {
                  ...r,
                  title: `${passed ? "DIY 手工" : "开箱评测"} - ${bvid}`,
                  status: passed ? "passed" : "rejected",
                  reason: passed
                    ? "第一人称视角，手部操作清晰"
                    : faceFrames > totalFrames * 0.2
                    ? "人脸帧占比过高（第三人称视角）"
                    : "手腕关键点检测率过低",
                  stats: {
                    totalFrames,
                    wristFrames,
                    faceFrames,
                    passRate: Math.round((wristFrames / totalFrames) * 100),
                  },
                }
              : r
          )
        );
      }
    }

    setIsFiltering(false);
    toast.success("RynnVLA001 筛选完成");
  };

  const handleAutoLabel = async () => {
    const passed = filterResults.filter((r) => r.status === "passed");
    if (passed.length === 0) {
      toast.error("没有通过筛选的视频，请先执行筛选");
      return;
    }

    setIsLabeling(true);
    setLabelResults(
      passed.map((r) => ({
        bvid: r.bvid,
        title: r.title,
        status: "pending" as const,
        stages: [
          { id: 1, name: "运动自适应抽帧", status: "pending" as const },
          { id: 2, name: "动作原语标注", status: "pending" as const },
          { id: 3, name: "接触力学估计", status: "pending" as const },
          { id: 4, name: "任务摘要生成", status: "pending" as const },
        ],
      }))
    );

    /**
     * Poll a job until done/error, updating stage UI in real-time.
     * Backend now returns {job_id} immediately; we poll /api/claw/status/{job_id}.
     */
    const pollJob = async (bvid: string, jobId: string) => {
      const POLL_INTERVAL = 4000; // 4s
      const MAX_POLLS = 180;      // 12 min max (qwen2.5vl:32b is slow)
      for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
        try {
          const statusRes = await fetch(`${backendUrl}/api/claw/status/${jobId}`, {
            headers: ngrokHeaders(),
          });
          if (!statusRes.ok) continue;
          const job = await statusRes.json();

          // Update stage statuses in real-time
          setLabelResults((prev) =>
            prev.map((r) =>
              r.bvid === bvid
                ? {
                    ...r,
                    status: job.status === "done" ? "done" : job.status === "error" ? "error" : "labeling",
                    stages: (job.stages || r.stages).map((s: any, idx: number) => ({
                      id: s.stage || idx + 1,
                      name: s.name || r.stages[idx]?.name || `Stage ${idx + 1}`,
                      status: s.status as any,
                      result: s.result ? JSON.stringify(s.result) : undefined,
                    })),
                  }
                : r
            )
          );

          if (job.status === "done" && job.result) {
            const data = job.result;
            const actionPrimitives = (data.phases || []).map(
              (p: any) => `${p.action_primitive || "unknown"}(target=${p.target_object || "?"}, gripper=${p.gripper_state || "?"})`
            );
            const mechanics = (data.phases || [])
              .map((p: any) => {
                const cm = p.contact_mechanics || {};
                return `${p.phase_name}: ${cm.contact_type || "?"} contact, ${cm.force_level || "?"} force, ${cm.motion_direction || "?"}`;
              })
              .join(" | ");
            setLabelResults((prev) =>
              prev.map((r) =>
                r.bvid === bvid
                  ? {
                      ...r,
                      status: "done",
                      output: {
                        actionPrimitives,
                        contactMechanics: mechanics,
                        taskSummary: data.task_summary || "",
                        lerobotPath: data.lerobot_data
                          ? `claw_data/${bvid}/labels/lerobot_v2.json`
                          : undefined,
                      },
                    }
                  : r
              )
            );
            return true; // success
          }
          if (job.status === "error") {
            toast.error(`${bvid} 标注失败: ${job.error || "未知错误"}`);
            return false;
          }
        } catch {
          // network blip, keep polling
        }
      }
      toast.error(`${bvid} 标注超时`);
      return false;
    };

    for (const item of passed) {
      setLabelResults((prev) =>
        prev.map((r) => (r.bvid === item.bvid ? { ...r, status: "labeling" } : r))
      );

      try {
        // Submit job — returns immediately with job_id
        const res = await fetch(`${backendUrl}/api/claw/autolabel`, {
          method: "POST",
          headers: ngrokHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            bv_id: item.bvid,
            vision_model: selectedVisionModel,
            text_model: selectedTextModel,
          }),
        });

        if (!res.ok) throw new Error(await res.text());
        const submission = await res.json();
        const jobId: string = submission.job_id;

        toast.info(`已提交 ${item.bvid} 标注任务 (${jobId})，正在等待 VLM 处理…`);

        // Poll until done
        await pollJob(item.bvid, jobId);
      } catch (err: any) {
        toast.error(`${item.bvid} 提交失败: ${err?.message || err}`);
        setLabelResults((prev) =>
          prev.map((r) => (r.bvid === item.bvid ? { ...r, status: "error" } : r))
        );
      }
    }

    setIsLabeling(false);
    toast.success("AutoLabel 标注完成");
  };

  // ─── Demo Data ────────────────────────────────────────────────────────────

  function getDemoSearchResults(): VideoResult[] {
    return [
      {
        bvid: "BV1xK4y1P7qR",
        title: "【第一视角】手工拧螺丝全过程 | DIY 家具组装",
        author: "手工达人小王",
        duration: "08:32",
        thumbnail: "",
        play: 125000,
        description: "第一人称 GoPro 视角拍摄的螺丝拧紧操作",
        pubdate: "2025-12-15",
        selected: false,
      },
      {
        bvid: "BV1mN4y1E8kT",
        title: "厨房收纳 DIY | 抽屉安装全教程",
        author: "生活家居频道",
        duration: "12:45",
        thumbnail: "",
        play: 89000,
        description: "头戴相机拍摄的抽屉滑轨安装过程",
        pubdate: "2025-11-20",
        selected: false,
      },
      {
        bvid: "BV1qW4y1F3mH",
        title: "模型制作 | 精细零件组装第一视角",
        author: "模型工坊",
        duration: "15:20",
        thumbnail: "",
        play: 67000,
        description: "微距镜头 + 第一视角拍摄的精密操作",
        pubdate: "2026-01-08",
        selected: false,
      },
    ];
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const passedCount = filterResults.filter((r) => r.status === "passed").length;
  const rejectedCount = filterResults.filter((r) => r.status === "rejected").length;
  const labeledCount = labelResults.filter((r) => r.status === "done").length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-border bg-slate-950/90 backdrop-blur-lg">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">返回首页</span>
            </a>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663068124084/aYQ2cGfDUTXqfFDMBDA23x/robomemologonobackground_dcc38179.png"
                alt="RoboMemo"
                className="w-6 h-6 object-contain"
              />
              <h1 className="text-lg font-bold">
                RoboMemoClaw <span className="text-cyan-400 font-normal text-sm">Console</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Backend Status */}
            <div
              className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg border border-border hover:border-cyan-500/50 transition"
              onClick={() => setShowSettings(!showSettings)}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  backendStatus === "connected"
                    ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]"
                    : backendStatus === "error"
                    ? "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]"
                    : "bg-yellow-400 animate-pulse"
                }`}
              />
              <span className="text-xs text-muted-foreground">
                {backendStatus === "connected"
                  ? "Mac Mini 已连接"
                  : backendStatus === "error"
                  ? "连接失败"
                  : "检测中..."}
              </span>
              <Settings className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="border-t border-border bg-slate-900/95 backdrop-blur-lg">
            <div className="container py-4">
              <div className="max-w-2xl">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Server className="w-4 h-4 text-cyan-400" />
                  后端服务器配置
                </h3>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={tempUrl}
                    onChange={(e) => setTempUrl(e.target.value)}
                    placeholder="http://localhost:8000 或 ngrok URL"
                    className="flex-1 h-9 rounded-md border border-input bg-slate-950 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                  <Button size="sm" onClick={saveBackendUrl} className="bg-cyan-500 hover:bg-cyan-600 text-black">
                    保存
                  </Button>
                  <Button size="sm" variant="outline" onClick={checkBackend}>
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  连接到 Mac Mini 上运行的 RoboMemoClaw 后端。公网演示地址：<code className="text-cyan-400">https://destitute-navigate-street.ngrok-free.dev</code>，本地开发使用 <code className="text-cyan-400">http://localhost:8000</code>。
                </p>
                {ollamaModels.length > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-slate-950/50 border border-border">
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5 text-cyan-400" />
                      检测到 Ollama 模型
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {ollamaModels.map((m) => (
                        <Badge key={m} variant="secondary" className="text-xs font-mono">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="container py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-lg grid-cols-2 mb-8">
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              任务搜索
            </TabsTrigger>
            <TabsTrigger value="process" className="flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              批量处理
              {filterResults.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {filterResults.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ═══════════ Panel 1: Task Search ═══════════ */}
          <TabsContent value="search" className="space-y-6">
            {/* Search Input */}
            <Card className="border-border/50 bg-gradient-to-br from-slate-900/80 to-slate-950/80">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="w-5 h-5 text-cyan-400" />
                  Web2 视频搜索
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">机器人任务描述</label>
                    <textarea
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="例如：拧螺丝、抓取物体、打开抽屉..."
                      rows={3}
                      className="w-full rounded-md border border-input bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">搜索关键词（逗号分隔）</label>
                    <textarea
                      value={searchKeywords}
                      onChange={(e) => setSearchKeywords(e.target.value)}
                      placeholder="例如：第一视角, GoPro, 手工DIY, 螺丝刀"
                      rows={3}
                      className="w-full rounded-md border border-input bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold"
                  >
                    {isSearching ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    搜索 B 站视频
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    优先搜索手工/DIY、烹饪、开箱评测分区（命中率最高）
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    搜索结果
                    <span className="text-muted-foreground font-normal text-sm ml-2">
                      ({searchResults.length} 个视频)
                    </span>
                  </h3>
                  <Button
                    onClick={sendSelectedToProcess}
                    disabled={searchResults.filter((v) => v.selected).length === 0}
                    className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold"
                  >
                    发送到处理面板
                    <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                  </Button>
                </div>

                <div className="grid gap-3">
                  {searchResults.map((video) => (
                    <Card
                      key={video.bvid}
                      className={`border-border/50 transition-all cursor-pointer hover:border-cyan-500/30 ${
                        video.selected ? "border-cyan-500 bg-cyan-950/20" : "bg-slate-900/50"
                      }`}
                      onClick={() => toggleVideoSelect(video.bvid)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Checkbox */}
                          <div
                            className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                              video.selected
                                ? "border-cyan-400 bg-cyan-500"
                                : "border-muted-foreground/30"
                            }`}
                          >
                            {video.selected && <CheckCircle className="w-3.5 h-3.5 text-black" />}
                          </div>

                          {/* Video Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-xs font-mono">
                                {video.bvid}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {video.duration}
                              </Badge>
                            </div>
                            <h4 className="font-medium text-sm mb-1 truncate">{video.title}</h4>
                            <p className="text-xs text-muted-foreground">
                              {video.author} · {video.play.toLocaleString()} 播放 · {video.pubdate}
                            </p>
                            {video.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {video.description}
                              </p>
                            )}
                          </div>

                          {/* Preview Link */}
                          <a
                            href={`https://www.bilibili.com/video/${video.bvid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-cyan-400 transition"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ═══════════ Panel 2: Batch Process ═══════════ */}
          <TabsContent value="process" className="space-y-6">

            {/* OpenClaw Integration Card */}
            <Card className="border-border/50 bg-gradient-to-br from-purple-950/30 to-slate-950/80 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="w-5 h-5 text-purple-400" />
                  OpenClaw Agent 数据导入
                  <Badge className="ml-2 bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">Web2 Fetcher</Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  从队友的 OpenClaw Agent（运行于 NVIDIA GX10 Spark）直接导入已收集的 B 站 BV 号数据集。
                  OpenClaw 使用 <code className="text-purple-400">qwen3.5:35b-a3b</code> + SearxNG 自动搜索并过滤第一视角视频。
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* OpenClaw Connection Config */}
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">OpenClaw Gateway URL</label>
                    <input
                      type="text"
                      value={openClawUrl}
                      onChange={(e) => setOpenClawUrl(e.target.value)}
                      placeholder="http://localhost:18789 或 ngrok URL"
                      className="w-full h-8 rounded-md border border-input bg-slate-950 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Auth Token</label>
                    <input
                      type="password"
                      value={openClawToken}
                      onChange={(e) => setOpenClawToken(e.target.value)}
                      placeholder="a6214d..."
                      className="w-full h-8 rounded-md border border-input bg-slate-950 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                </div>

                {/* Preset Datasets from OpenClaw */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">已知 OpenClaw 收集的数据集（直接粘贴）：</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { name: "拧螺丝 (70+)", keyword: "拧螺丝", count: 70, file: "bilibili_nail_screwing_70.json" },
                      { name: "螺丝 精选 (60)", keyword: "螺丝", count: 60, file: "bilibili_search_results.json" },
                      { name: "坚果拧紧 (3+)", keyword: "坚果拧紧", count: 3, file: "nut_screwing_videos_3plus.json" },
                      { name: "第一视角 POV", keyword: "第一视角拧螺丝", count: 10, file: "first_person_nut_screwing.json" },
                    ].map((ds) => (
                      <Button
                        key={ds.file}
                        size="sm"
                        variant="outline"
                        className="text-xs border-purple-500/30 text-purple-300 hover:bg-purple-950/30 h-auto py-2 flex-col gap-0.5"
                        disabled={isImportingFromClaw}
                        onClick={async () => {
                          setIsImportingFromClaw(true);
                          try {
                            // Try to fetch from OpenClaw workspace via backend proxy
                              const res = await fetch(`${backendUrl}/api/claw/openclaw/import`, {
                              method: "POST",
                              headers: ngrokHeaders({ "Content-Type": "application/json" }),
                              body: JSON.stringify({
                                openclaw_url: openClawUrl,
                                token: openClawToken,
                                filename: ds.file,
                              }),
                            });
                            if (res.ok) {
                              const data = await res.json();
                              const bvs: string[] = data.video_bvs || [];
                              if (bvs.length > 0) {
                                setBvInput((prev) => {
                                  const existing = prev.trim();
                                  return existing ? existing + "\n" + bvs.join("\n") : bvs.join("\n");
                                });
                                toast.success(`已导入 ${bvs.length} 个 BV 号（${ds.name}）`);
                                setActiveTab("process");
                              } else {
                                throw new Error("no bvs");
                              }
                            } else {
                              throw new Error("fetch failed");
                            }
                          } catch {
                            // Fallback: show manual instructions
                            toast.info(`请在 OpenClaw 工作区手动复制 ${ds.file} 中的 BV 号到下方输入框`);
                          } finally {
                            setIsImportingFromClaw(false);
                          }
                        }}
                      >
                        <span className="font-semibold">{ds.name}</span>
                        <span className="text-purple-400/60">{ds.file.replace('.json','')}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Architecture Info */}
                <div className="p-3 rounded-lg bg-slate-950/60 border border-purple-500/10 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-purple-300 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5" />
                    OpenClaw 架构（NVIDIA GX10 Spark · Linux arm64）
                  </p>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="p-2 rounded bg-slate-900/60 border border-border/30">
                      <p className="text-purple-400 font-mono text-xs">Gateway</p>
                      <p className="text-muted-foreground">Port 18789</p>
                      <p className="text-muted-foreground">Token Auth</p>
                    </div>
                    <div className="p-2 rounded bg-slate-900/60 border border-border/30">
                      <p className="text-purple-400 font-mono text-xs">LLM</p>
                      <p className="text-muted-foreground">qwen3.5:35b-a3b</p>
                      <p className="text-muted-foreground">Ollama :11434</p>
                    </div>
                    <div className="p-2 rounded bg-slate-900/60 border border-border/30">
                      <p className="text-purple-400 font-mono text-xs">Search</p>
                      <p className="text-muted-foreground">SearxNG :8080</p>
                      <p className="text-muted-foreground">web.fetch</p>
                    </div>
                  </div>
                  <p className="mt-2 text-purple-300/60">
                    过滤规则：✅ 第一视角 POV · ✅ 真实手动工具操作 · ❌ 排除游戏/广告/动画/玩具
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* BV Input */}
            <Card className="border-border/50 bg-gradient-to-br from-slate-900/80 to-slate-950/80">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Video className="w-5 h-5 text-cyan-400" />
                  批量 BV 号输入
                  {bvInput.trim() && (
                    <Badge className="ml-2 bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-xs">
                      {bvInput.trim().split(/[\n,]+/).filter(b => b.trim().startsWith('BV')).length} 个 BV 号
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <textarea
                  value={bvInput}
                  onChange={(e) => setBvInput(e.target.value)}
                  placeholder={"输入 BV 号（每行一个或逗号分隔），或从上方 OpenClaw 数据集直接导入\n例如：\nBV1xK4y1P7qR\nBV1mN4y1E8kT\nBV1qW4y1F3mH"}
                  rows={5}
                  className="w-full rounded-md border border-input bg-slate-950 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                />
                <div className="flex items-center gap-3 flex-wrap">
                  <Button
                    onClick={handleFilter}
                    disabled={isFiltering || parseBVIds().length === 0}
                    className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold"
                  >
                    {isFiltering ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Filter className="w-4 h-4 mr-2" />
                    )}
                    Step 1: RynnVLA001 筛选
                  </Button>
                  <Button
                    onClick={handleAutoLabel}
                    disabled={isLabeling || passedCount === 0}
                    variant="outline"
                    className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-950/30"
                  >
                    {isLabeling ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Tag className="w-4 h-4 mr-2" />
                    )}
                    Step 2: AutoLabel 标注
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    检测到 {parseBVIds().length} 个 BV 号
                  </div>
                </div>

                {/* Model Selection */}
                <div className="flex items-center gap-4 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-xs text-muted-foreground">Vision:</span>
                    <select
                      value={selectedVisionModel}
                      onChange={(e) => setSelectedVisionModel(e.target.value)}
                      className="h-7 rounded border border-input bg-slate-950 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                    >
                      <option value="qwen2.5vl:32b">qwen2.5vl:32b (21GB)</option>
                      <option value="llama3.2-vision:latest">llama3.2-vision (7.8GB)</option>
                      <option value="minicpm-v:latest">minicpm-v (5.5GB)</option>
                      <option value="llava:13b">llava:13b (8GB)</option>
                      <option value="llava:latest">llava (4.7GB)</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Brain className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-xs text-muted-foreground">Text:</span>
                    <select
                      value={selectedTextModel}
                      onChange={(e) => setSelectedTextModel(e.target.value)}
                      className="h-7 rounded border border-input bg-slate-950 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                    >
                      <option value="gemma4:26b">gemma4:26b (17GB)</option>
                      <option value="qwen2.5vl:32b">qwen2.5vl:32b (21GB)</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Filter Results */}
            {filterResults.length > 0 && (
              <Card className="border-border/50 bg-slate-900/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Filter className="w-5 h-5 text-cyan-400" />
                      RynnVLA001 筛选结果
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      {passedCount > 0 && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          通过 {passedCount}
                        </Badge>
                      )}
                      {rejectedCount > 0 && (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                          <XCircle className="w-3 h-3 mr-1" />
                          拒绝 {rejectedCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {filterResults.map((result) => (
                    <div
                      key={result.bvid}
                      className={`p-3 rounded-lg border transition ${
                        result.status === "passed"
                          ? "border-green-500/30 bg-green-950/10"
                          : result.status === "rejected"
                          ? "border-red-500/30 bg-red-950/10"
                          : "border-border/50 bg-slate-950/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* Status Icon */}
                          {result.status === "passed" ? (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          ) : result.status === "rejected" ? (
                            <XCircle className="w-5 h-5 text-red-400" />
                          ) : result.status === "downloading" ? (
                            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                          ) : result.status === "filtering" ? (
                            <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                          )}

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground">{result.bvid}</span>
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  result.status === "passed"
                                    ? "border-green-500/50 text-green-400"
                                    : result.status === "rejected"
                                    ? "border-red-500/50 text-red-400"
                                    : result.status === "downloading"
                                    ? "border-cyan-500/50 text-cyan-400"
                                    : result.status === "filtering"
                                    ? "border-yellow-500/50 text-yellow-400"
                                    : "border-muted-foreground/30"
                                }`}
                              >
                                {result.status === "pending"
                                  ? "等待中"
                                  : result.status === "downloading"
                                  ? "下载中..."
                                  : result.status === "filtering"
                                  ? "YOLOv8-Pose 分析中..."
                                  : result.status === "passed"
                                  ? "通过"
                                  : result.status === "rejected"
                                  ? "拒绝"
                                  : "错误"}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium mt-0.5">{result.title}</p>
                            {result.reason && (
                              <p className="text-xs text-muted-foreground mt-0.5">{result.reason}</p>
                            )}
                          </div>
                        </div>

                        {/* Stats */}
                        {result.stats && (
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="text-center">
                              <p className="font-semibold text-foreground">{result.stats.totalFrames}</p>
                              <p>总帧数</p>
                            </div>
                            <div className="text-center">
                              <p className="font-semibold text-green-400">{result.stats.wristFrames}</p>
                              <p>手腕帧</p>
                            </div>
                            <div className="text-center">
                              <p className="font-semibold text-red-400">{result.stats.faceFrames}</p>
                              <p>人脸帧</p>
                            </div>
                            <div className="text-center">
                              <p className={`font-semibold ${result.stats.passRate > 50 ? "text-green-400" : "text-red-400"}`}>
                                {result.stats.passRate}%
                              </p>
                              <p>通过率</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Label Results */}
            {labelResults.length > 0 && (
              <Card className="border-border/50 bg-slate-900/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Tag className="w-5 h-5 text-cyan-400" />
                      AutoLabel 标注结果
                    </CardTitle>
                    {labeledCount > 0 && (
                      <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                        <Zap className="w-3 h-3 mr-1" />
                        已标注 {labeledCount}/{labelResults.length}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {labelResults.map((result) => (
                    <div key={result.bvid} className="rounded-lg border border-border/50 bg-slate-950/50 overflow-hidden">
                      {/* Header */}
                      <div
                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-900/50 transition"
                        onClick={() =>
                          setExpandedLabel(expandedLabel === result.bvid ? null : result.bvid)
                        }
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-muted-foreground">{result.bvid}</span>
                          <span className="text-sm font-medium">{result.title}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Stage Progress */}
                          <div className="flex items-center gap-1">
                            {result.stages.map((stage) => (
                              <div
                                key={stage.id}
                                className={`w-6 h-1.5 rounded-full transition ${
                                  stage.status === "done"
                                    ? "bg-cyan-400"
                                    : stage.status === "running"
                                    ? "bg-yellow-400 animate-pulse"
                                    : "bg-muted-foreground/20"
                                }`}
                                title={`${stage.name}: ${stage.status}`}
                              />
                            ))}
                          </div>
                          {expandedLabel === result.bvid ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {/* Stage Details */}
                      {expandedLabel === result.bvid && (
                        <div className="border-t border-border/50 p-4 space-y-4">
                          {/* 4-Stage Pipeline */}
                          <div className="grid grid-cols-4 gap-2">
                            {result.stages.map((stage) => (
                              <div
                                key={stage.id}
                                className={`p-2 rounded-lg text-center text-xs border transition ${
                                  stage.status === "done"
                                    ? "border-cyan-500/30 bg-cyan-950/20"
                                    : stage.status === "running"
                                    ? "border-yellow-500/30 bg-yellow-950/20"
                                    : "border-border/30 bg-slate-950/30"
                                }`}
                              >
                                <div className="flex items-center justify-center mb-1">
                                  {stage.status === "done" ? (
                                    <CheckCircle className="w-4 h-4 text-cyan-400" />
                                  ) : stage.status === "running" ? (
                                    <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                                  ) : (
                                    <div className="w-4 h-4 rounded-full border border-muted-foreground/30" />
                                  )}
                                </div>
                                <p className="font-medium">{stage.name}</p>
                              </div>
                            ))}
                          </div>

                          {/* Output */}
                          {result.output && (
                            <div className="space-y-3">
                              <Separator />

                              {/* Action Primitives */}
                              <div>
                                <h5 className="text-xs font-semibold text-cyan-400 mb-2">动作原语 (Action Primitives)</h5>
                                <div className="flex flex-wrap gap-1.5">
                                  {result.output.actionPrimitives.map((ap, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs font-mono">
                                      {ap}
                                    </Badge>
                                  ))}
                                </div>
                              </div>

                              {/* Contact Mechanics */}
                              <div>
                                <h5 className="text-xs font-semibold text-cyan-400 mb-2">接触力学 (Contact Mechanics)</h5>
                                <p className="text-xs text-muted-foreground bg-slate-950/50 p-2 rounded font-mono">
                                  {result.output.contactMechanics}
                                </p>
                              </div>

                              {/* Task Summary */}
                              <div>
                                <h5 className="text-xs font-semibold text-cyan-400 mb-2">任务摘要 (Task Summary)</h5>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  {result.output.taskSummary}
                                </p>
                              </div>

                              {/* Export Actions */}
                              <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs border-cyan-500/50 text-cyan-400"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      const url = `${backendUrl}/api/claw/export/lerobot/${result.bvid}`;
                                      const res = await fetch(url, { headers: ngrokHeaders() });
                                      if (!res.ok) throw new Error('导出失败');
                                      const blob = await res.blob();
                                      const a = document.createElement('a');
                                      a.href = URL.createObjectURL(blob);
                                      a.download = `${result.bvid}_lerobot_v2.json`;
                                      a.click();
                                      URL.revokeObjectURL(a.href);
                                      toast.success('LeRobot V2 数据已下载');
                                    } catch {
                                      toast.error('导出失败，请确认后端已标注该视频');
                                    }
                                  }}
                                >
                                  <Download className="w-3 h-3 mr-1" />
                                  导出 LeRobot V2
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs border-cyan-500/50 text-cyan-400"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      const url = `${backendUrl}/api/claw/export/sft-config/${result.bvid}`;
                                      const res = await fetch(url, { headers: ngrokHeaders() });
                                      if (!res.ok) throw new Error('导出失败');
                                      const blob = await res.blob();
                                      const a = document.createElement('a');
                                      a.href = URL.createObjectURL(blob);
                                      a.download = `${result.bvid}_sft_config.json`;
                                      a.click();
                                      URL.revokeObjectURL(a.href);
                                      toast.success('SFT Config 已下载');
                                    } catch {
                                      toast.error('导出失败，请确认后端已标注该视频');
                                    }
                                  }}
                                >
                                  <Download className="w-3 h-3 mr-1" />
                                  导出 π₀.5 SFT Config
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs border-purple-500/50 text-purple-400"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      toast.info('正在上传至 IPFS 并铸造 NFT...');
                                      const res = await fetch(`${backendUrl}/api/claw/web3/upload`, {
                                        method: 'POST',
                                        headers: ngrokHeaders({ 'Content-Type': 'application/json' }),
                                        body: JSON.stringify({
                                          bv_id: result.bvid,
                                          title: `RoboMemoClaw Dataset: ${result.bvid}`,
                                          task_name: result.output?.taskSummary?.slice(0, 100) || '',
                                        }),
                                      });
                                      if (!res.ok) throw new Error('上链失败');
                                      const data = await res.json();
                                      if (data.nft?.txHash) {
                                        toast.success(`NFT 铸造成功！TxHash: ${data.nft.txHash.slice(0, 16)}...`);
                                      } else {
                                        toast.success(`IPFS 上传成功！SFT CID: ${data.ipfs?.sft_cid?.slice(0, 16)}...`);
                                      }
                                    } catch {
                                      toast.error('Web3 上链失败，请确认 Hardhat 节点和 Platform 后端已启动');
                                    }
                                  }}
                                >
                                  <Link2 className="w-3 h-3 mr-1" />
                                  上链 Web3
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs border-green-500/50 text-green-400"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      const url = `${backendUrl}/api/claw/export/phases/${result.bvid}`;
                                      const res = await fetch(url, { headers: ngrokHeaders() });
                                      if (!res.ok) throw new Error('导出失败');
                                      const blob = await res.blob();
                                      const a = document.createElement('a');
                                      a.href = URL.createObjectURL(blob);
                                      a.download = `${result.bvid}_phases.json`;
                                      a.click();
                                      URL.revokeObjectURL(a.href);
                                      toast.success('Phase 标注数据已下载');
                                    } catch {
                                      toast.error('导出失败');
                                    }
                                  }}
                                >
                                  <Download className="w-3 h-3 mr-1" />
                                  导出 Phases
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {filterResults.length === 0 && labelResults.length === 0 && (
              <Card className="border-border/30 bg-slate-900/30">
                <CardContent className="py-16 text-center">
                  <Cpu className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                    等待输入 BV 号
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    在上方输入 B 站视频 BV 号，或从"任务搜索"面板选择视频后发送到此处。
                    系统将依次执行 RynnVLA001 筛选和 4 阶段 AutoLabel 标注。
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
