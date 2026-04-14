import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Zap, Brain, Lock, Cpu, Rocket } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

/**
 * Design Philosophy: Modern Tech Showcase
 * - Dark theme with cyan/blue accents for tech credibility
 * - Asymmetric layouts with strategic whitespace
 * - Smooth animations and glowing effects
 * - Hero-first structure with progressive disclosure
 */

export default function Home() {
  const [activeStage, setActiveStage] = useState<number | null>(null);

  const stages = [
    {
      id: 1,
      title: "Web2 获取",
      subtitle: "Fetch",
      description: "从 B 站、YouTube 等平台批量获取候选视频",
      icon: "🎬",
      details: "系统自动从多个视频平台抓取 DIY、维修等相关视频作为原始素材",
    },
    {
      id: 2,
      title: "智能过滤",
      subtitle: "Filter",
      description: "基于 RynnVLA-001 规则自动筛选高质量视频",
      icon: "🔍",
      details: "利用 YOLOv8-Pose 检测，剔除第三人称视角，保留第一视角操作",
    },
    {
      id: 3,
      title: "自动标注",
      subtitle: "Auto-Label",
      description: "4 阶段 VLM 流水线生成 SFT 训练数据",
      icon: "🏷️",
      details: "运动自适应抽帧 → 动作原语标注 → 接触力学估计 → 任务总结",
    },
    {
      id: 4,
      title: "Web3 上链",
      subtitle: "Trade",
      description: "数据资产化与区块链交易",
      icon: "⛓️",
      details: "将数据链接与密钥上链，实现去中心化存储与透明化激励",
    },
    {
      id: 5,
      title: "机器人部署",
      subtitle: "Deployment",
      description: "π₀.5 SFT 微调与实机验证",
      icon: "🤖",
      details: "在 4+1 DoF 机械臂上进行拧螺丝等精细操作任务验证",
    },
  ];

  const innovations = [
    {
      title: "4 阶段 VLM 标注引擎",
      description: "多阶段 Vision-Language-Action 标注流水线，提取深层机器人学信息",
      icon: <Brain className="w-6 h-6" />,
    },
    {
      title: "混合 VLM 后端",
      description: "视觉模型 + 文本推理模型组合，平衡成本与质量",
      icon: <Zap className="w-6 h-6" />,
    },
    {
      title: "Web3 数据交易",
      description: "去中心化存储与透明化激励机制，解决数据孤岛问题",
      icon: <Lock className="w-6 h-6" />,
    },
    {
      title: "NVIDIA 加速计算",
      description: "GX10 Spark 128GB 统一显存，TensorRT 实时推理加速",
      icon: <Cpu className="w-6 h-6" />,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663068124084/aYQ2cGfDUTXqfFDMBDA23x/robomemologonobackground_dcc38179.png"
              alt="RoboMemo Logo"
              className="w-8 h-8 object-contain"
            />
            <span className="text-lg font-bold">RoboMemo</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#pipeline" className="text-sm hover:text-cyan-400 transition">
              Pipeline
            </a>
            <a href="#innovations" className="text-sm hover:text-cyan-400 transition">
              创新点
            </a>
            <a href="#tech" className="text-sm hover:text-cyan-400 transition">
              技术
            </a>
            <Link href="/console">
              <span className="text-sm px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition cursor-pointer">
                Console
              </span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 via-background to-background" />

        <div className="container relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: Text content */}
            <div className="space-y-6">
              <div className="inline-block px-4 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/5">
                <span className="text-sm text-cyan-300">具身智能 × Web3 × 机器人</span>
              </div>

              <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                <span className="text-cyan-400">RoboMemoClaw</span><br />
                Embodied Data Collection & Trade Platform
              </h1>

              <p className="text-lg text-muted-foreground leading-relaxed">
                具身数据自动采集平台：从 Web2 海量视频中自动提取、过滤、标注高质量具身智能训练数据，通过 Web3
                实现数据资产化与交易，最终服务于 VLA 模型微调与实机部署。
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <a
                  href="https://d2xsxph8kpxj0f.cloudfront.net/310519663068124084/aYQ2cGfDUTXqfFDMBDA23x/RoboMemo_Final_Report_0744720a.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  download="RoboMemoClaw_Final_Report.pdf"
                >
                  <Button
                    size="lg"
                    className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold w-full sm:w-auto"
                  >
                    了解更多 <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </a>
                <a
                  href="https://d2xsxph8kpxj0f.cloudfront.net/310519663068124084/aYQ2cGfDUTXqfFDMBDA23x/RoboMemo_Final_Report_0744720a.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  download="RoboMemoClaw_Final_Report.pdf"
                >
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    查看报告
                  </Button>
                </a>
              </div>
            </div>

            {/* Right: Hero image */}
            <div className="relative h-96 md:h-full">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663068124084/aYQ2cGfDUTXqfFDMBDA23x/nemoclaw-hero-im7iZkQiqd7UTV2pfWWB2A.webp"
                alt="NemoClaw Platform"
                className="w-full h-full object-cover rounded-2xl glow-cyan-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pipeline Section */}
      <section id="pipeline" className="py-20 md:py-32 bg-slate-950/30 border-y border-border">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">RoboMemoClaw Pipeline</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              从 Web2 视频采集到 Web3 资产交易的完整自动化流水线
            </p>
          </div>

          {/* Pipeline visualization */}
          <div className="mb-12">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663068124084/aYQ2cGfDUTXqfFDMBDA23x/nemoclaw-pipeline-Vt8KsPsdWbkZvYieFAQTwh.webp"
              alt="NemoClaw Pipeline"
              className="w-full rounded-2xl glow-cyan"
            />
          </div>

          {/* Interactive stage cards */}
          <div className="grid md:grid-cols-5 gap-4">
            {stages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => setActiveStage(activeStage === stage.id ? null : stage.id)}
                className={`p-4 rounded-lg border transition-all duration-300 text-left ${
                  activeStage === stage.id
                    ? "border-cyan-500 bg-cyan-500/10 glow-cyan"
                    : "border-border hover:border-cyan-500/50 hover:bg-slate-900/50"
                }`}
              >
                <div className="text-3xl mb-2">{stage.icon}</div>
                <h3 className="font-semibold text-sm mb-1">{stage.title}</h3>
                <p className="text-xs text-muted-foreground">{stage.subtitle}</p>
              </button>
            ))}
          </div>

          {/* Expanded stage details */}
          {activeStage && (
            <div className="mt-8 p-6 rounded-lg border border-cyan-500/30 bg-cyan-500/5 animate-in">
              {stages.find((s) => s.id === activeStage) && (
                <div>
                  <h3 className="text-xl font-bold mb-2">
                    {stages.find((s) => s.id === activeStage)?.title}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {stages.find((s) => s.id === activeStage)?.details}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Innovations Section */}
      <section id="innovations" className="py-20 md:py-32">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">技术创新点</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              NemoClaw 在具身智能、数据处理、Web3 交易等多个维度的创新突破
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {innovations.map((innovation, idx) => (
              <Card
                key={idx}
                className="p-6 border-border/50 bg-slate-900/50 hover:border-cyan-500/50 hover:bg-slate-900/80 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20 transition">
                    {innovation.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">{innovation.title}</h3>
                    <p className="text-sm text-muted-foreground">{innovation.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* VLM & Web3 Section */}
      <section id="tech" className="py-20 md:py-32 bg-slate-950/30 border-y border-border">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            {/* VLM Architecture */}
            <div>
              <h2 className="text-3xl font-bold mb-4">4 阶段 VLM 标注引擎</h2>
              <p className="text-muted-foreground mb-6">
                基于 RoboMemo-core 的 AutoLabelPipeline，实现多阶段的 Vision-Language-Action
                标注流水线，提取深层机器人学信息。
              </p>
              <ul className="space-y-3">
                {[
                  "Stage 1: 运动自适应抽帧与阶段分割",
                  "Stage 2: 动作原语标注 (15 种标准动作)",
                  "Stage 3: 接触力学估计 (接触类型、力度)",
                  "Stage 4: 任务总结生成",
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="text-cyan-400 font-bold">✓</span>
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663068124084/aYQ2cGfDUTXqfFDMBDA23x/nemoclaw-vlm-mJ9J9sZQDSacg3y9hbj7B3.webp"
              alt="VLM Architecture"
              className="rounded-2xl glow-cyan"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Web3 Trading */}
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663068124084/aYQ2cGfDUTXqfFDMBDA23x/nemoclaw-web3-aFXNUTjqvy4Vqiojeafs67.webp"
              alt="Web3 Trading"
              className="rounded-2xl glow-cyan order-2 md:order-1"
            />
            <div className="order-1 md:order-2">
              <h2 className="text-3xl font-bold mb-4">Web3 数据交易与资产化</h2>
              <p className="text-muted-foreground mb-6">
                创新性地引入 Web3 机制，解决具身智能领域的"数据孤岛"问题，实现数据确权与透明化激励。
              </p>
              <ul className="space-y-3">
                {[
                  "数据确权：区块链上生成数据指纹",
                  "去中心化存储：降低单一云服务商依赖",
                  "透明化激励：代币激励高质量数据贡献者",
                  "二级市场：实现数据集的买卖与授权",
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="text-cyan-400 font-bold">✓</span>
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* NVIDIA & Future Section */}
      <section className="py-20 md:py-32">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-12">
            {/* NVIDIA */}
            <Card className="p-8 border-border/50 bg-gradient-to-br from-slate-900/50 to-slate-950/50">
              <div className="flex items-center gap-3 mb-4">
                <Cpu className="w-6 h-6 text-cyan-400" />
                <h3 className="text-2xl font-bold">NVIDIA 工具平台</h3>
              </div>
              <ul className="space-y-4">
                <li>
                  <p className="font-semibold text-sm mb-1">GX10 Spark</p>
                  <p className="text-sm text-muted-foreground">
                    128GB 统一显存，同时运行多模态标注与 VLA 微调任务
                  </p>
                </li>
                <li>
                  <p className="font-semibold text-sm mb-1">TensorRT</p>
                  <p className="text-sm text-muted-foreground">
                    加速 π₀.5 实时推理，确保毫秒级动作响应
                  </p>
                </li>
              </ul>
            </Card>

            {/* Future Vision */}
            <Card className="p-8 border-border/50 bg-gradient-to-br from-slate-900/50 to-slate-950/50">
              <div className="flex items-center gap-3 mb-4">
                <Rocket className="w-6 h-6 text-cyan-400" />
                <h3 className="text-2xl font-bold">未来展望</h3>
              </div>
              <ul className="space-y-4">
                <li>
                  <p className="font-semibold text-sm mb-1">全自动化闭环</p>
                  <p className="text-sm text-muted-foreground">
                    24/7 无人值守流水线，从发现视频到自动上链
                  </p>
                </li>
                <li>
                  <p className="font-semibold text-sm mb-1">大规模机器人矩阵</p>
                  <p className="text-sm text-muted-foreground">
                    部署更多低成本机械臂，实现大规模实机验证
                  </p>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 bg-gradient-to-r from-cyan-950/30 via-blue-950/30 to-purple-950/30 border-y border-border">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">准备好探索具身智能的未来了吗？</h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
            RoboMemoClaw 正在重新定义机器人数据的自动采集、标注与交易方式
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/console">
              <Button size="lg" className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold">
                立即开始 <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <a href="mailto:robomemo.hello@gmail.com">
              <Button size="lg" variant="outline">
                联系我们
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-slate-950/50 py-8">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img
                  src="https://d2xsxph8kpxj0f.cloudfront.net/310519663068124084/aYQ2cGfDUTXqfFDMBDA23x/robomemologonobackground_dcc38179.png"
                  alt="RoboMemo"
                  className="w-6 h-6 object-contain"
                />
                <h4 className="font-semibold">RoboMemo</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Embodied Data Collection & Trade Platform
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">产品</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#pipeline" className="hover:text-cyan-400 transition">Pipeline</a></li>
                <li><a href="#innovations" className="hover:text-cyan-400 transition">VLM 引擎</a></li>
                <li><a href="#tech" className="hover:text-cyan-400 transition">Web3 交易</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">资源</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="https://d2xsxph8kpxj0f.cloudfront.net/310519663068124084/aYQ2cGfDUTXqfFDMBDA23x/RoboMemo_Final_Report_0744720a.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    download="RoboMemoClaw_Final_Report.pdf"
                    className="hover:text-cyan-400 transition"
                  >
                    项目报告 PDF
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/RoboMemo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-cyan-400 transition"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="https://d2xsxph8kpxj0f.cloudfront.net/310519663068124084/aYQ2cGfDUTXqfFDMBDA23x/RoboMemo_Final_Report_0744720a.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    download="RoboMemoClaw_Final_Report.pdf"
                    className="hover:text-cyan-400 transition"
                  >
                    技术文档
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">关于</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-cyan-400 transition">团队</a></li>
                <li>
                  <a
                    href="mailto:robomemo.hello@gmail.com"
                    className="hover:text-cyan-400 transition"
                  >
                    robomemo.hello@gmail.com
                  </a>
                </li>
                <li>
                  <a href="/privacy" className="hover:text-cyan-400 transition">隐私政策</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2026 RoboMemoClaw. All rights reserved.
            </p>
            <p className="text-sm text-muted-foreground">
              Built for Hackathon 2026 • <a href="mailto:robomemo.hello@gmail.com" className="hover:text-cyan-400 transition">robomemo.hello@gmail.com</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
