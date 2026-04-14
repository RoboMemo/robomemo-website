"""
RoboMemoClaw Backend — FastAPI claw_server.py
Runs on Mac Mini (or any local machine). Exposed via ngrok for public demo.

Endpoints consumed by Console.tsx:
  GET  /api/health                        — health check
  POST /api/claw/search                   — Bilibili video search
  POST /api/claw/filter                   — per-BV perspective filter (download + OpenCV)
  POST /api/claw/autolabel                — submit async VLM label job, returns {job_id}
  GET  /api/claw/status/{job_id}          — poll job progress
  GET  /api/claw/export/lerobot/{bvid}    — download LeRobot V2 JSON
  GET  /api/claw/export/sft-config/{bvid} — download π₀.5 SFT JSONL
  GET  /api/claw/export/phases/{bvid}     — download phase breakdown JSON
  GET  /api/claw/export/summary           — list all completed jobs
  POST /api/claw/web3/upload              — upload to IPFS + mint NFT (proxies Platform)
  GET  /api/claw/web3/status              — Web3 connection status
  POST /api/claw/openclaw/import          — import BV list from OpenClaw agent
  GET  /api/vlm/local-models              — list installed Ollama vision models

Usage:
  pip install fastapi uvicorn httpx yt-dlp opencv-python-headless
  uvicorn claw_server:app --host 0.0.0.0 --port 8000 --reload
"""

import asyncio
import json
import os
import subprocess
import sys
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

app = FastAPI(title="RoboMemoClaw Server", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Config ───────────────────────────────────────────────────────────────────

DATA_DIR = Path(os.environ.get("CLAW_DATA_DIR", "./claw_data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Platform backend URL (for Web3 proxying)
PLATFORM_URL = os.environ.get("PLATFORM_URL", "http://localhost:3001")

# Paths to Python scripts (relative to this file)
SCRIPT_DIR = Path(__file__).parent
VLM_SCRIPT = SCRIPT_DIR / "vlm_video_analyzer.py"
FILTER_SCRIPT = SCRIPT_DIR / "pipeline_filter.py"

# ─── In-memory job store ──────────────────────────────────────────────────────

class Stage:
    def __init__(self, stage: int, name: str):
        self.stage = stage
        self.name = name
        self.status = "pending"
        self.result: Optional[Any] = None

class Job:
    def __init__(self, bvid: str, vision_model: str, text_model: str):
        self.job_id = str(uuid.uuid4())[:8]
        self.bvid = bvid
        self.vision_model = vision_model
        self.text_model = text_model
        self.status = "pending"   # pending | running | done | error
        self.error: Optional[str] = None
        self.result: Optional[Dict] = None
        self.stages = [
            Stage(1, "运动自适应抽帧"),
            Stage(2, "动作原语标注"),
            Stage(3, "接触力学估计"),
            Stage(4, "任务摘要生成"),
        ]
        self.created_at = datetime.utcnow().isoformat()

    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "bvid": self.bvid,
            "status": self.status,
            "error": self.error,
            "result": self.result,
            "stages": [
                {"stage": s.stage, "name": s.name, "status": s.status, "result": s.result}
                for s in self.stages
            ],
            "created_at": self.created_at,
        }

JOBS: Dict[str, Job] = {}

# ─── Pydantic models ──────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str = ""
    keywords: str = ""

class FilterRequest(BaseModel):
    bv_id: str

class AutolabelRequest(BaseModel):
    bv_id: str
    vision_model: str = "qwen2.5vl:32b"
    text_model: str = "gemma4:26b"

class OpenClawImportRequest(BaseModel):
    openclaw_url: str
    token: str = ""
    filename: str

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _run_python(script: Path, *args: str, timeout: int = 600) -> dict:
    """Run a Python script, capture stdout as JSON."""
    result = subprocess.run(
        [sys.executable, str(script), *args],
        capture_output=True, text=True, timeout=timeout
    )
    try:
        return json.loads(result.stdout.strip())
    except json.JSONDecodeError:
        raise RuntimeError(f"Script output parse error: {result.stderr or result.stdout[:300]}")

async def _download_bv(bvid: str, out_dir: Path) -> Path:
    """Download Bilibili video using yt-dlp. Returns path to downloaded file."""
    out_dir.mkdir(parents=True, exist_ok=True)
    # Check if already downloaded
    existing = list(out_dir.glob(f"{bvid}.*"))
    if existing:
        return existing[0]

    proc = await asyncio.create_subprocess_exec(
        "yt-dlp",
        f"https://www.bilibili.com/video/{bvid}",
        "-o", str(out_dir / f"{bvid}.%(ext)s"),
        "--no-playlist",
        "--format", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format", "mp4",
        "--quiet",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
    if proc.returncode != 0:
        raise RuntimeError(f"yt-dlp failed: {stderr.decode()[:300]}")

    files = list(out_dir.glob(f"{bvid}.*"))
    if not files:
        raise RuntimeError(f"No file found after download for {bvid}")
    return files[0]

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "jobs_in_memory": len(JOBS),
        "gcp": {"enabled": False},
    }


@app.post("/api/claw/search")
async def search_bilibili(req: SearchRequest):
    """Search Bilibili for videos matching the task description."""
    query = f"{req.query} {req.keywords}".strip()
    if not query:
        raise HTTPException(400, "query or keywords required")

    # Use bilibili search API (no auth needed for basic search)
    search_url = "https://api.bilibili.com/x/web-interface/search/all/v2"
    params = {"keyword": query, "page": 1}
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Referer": "https://www.bilibili.com",
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(search_url, params=params, headers=headers)
            data = resp.json()

        results = []
        for item in data.get("data", {}).get("result", []):
            if item.get("result_type") == "video":
                for v in item.get("data", []):
                    results.append({
                        "bvid": v.get("bvid", ""),
                        "title": v.get("title", "").replace("<em class=\"keyword\">", "").replace("</em>", ""),
                        "author": v.get("author", ""),
                        "duration": v.get("duration", ""),
                        "thumbnail": v.get("pic", ""),
                        "play_count": v.get("play", 0),
                        "description": v.get("description", ""),
                        "pubdate": v.get("pubdate", ""),
                        "category": v.get("typename", ""),
                    })

        return {"results": results[:20], "query": query}

    except Exception as e:
        # Fallback: return demo results
        return {
            "results": [
                {"bvid": "BV1xK4y1P7qR", "title": "【第一视角】手工拧螺丝全过程", "author": "手工达人小王",
                 "duration": "08:32", "thumbnail": "", "play_count": 125000, "description": "第一人称 GoPro 视角拍摄"},
                {"bvid": "BV1mN4y1E8kT", "title": "厨房收纳 DIY | 抽屉安装全教程", "author": "生活家居频道",
                 "duration": "12:45", "thumbnail": "", "play_count": 89000, "description": "头戴相机拍摄"},
                {"bvid": "BV1qW4y1F3mH", "title": "模型制作 | 精细零件组装第一视角", "author": "模型工坊",
                 "duration": "15:20", "thumbnail": "", "play_count": 67000, "description": "微距镜头第一视角"},
            ],
            "query": query,
            "error": str(e),
            "fallback": True,
        }


@app.post("/api/claw/filter")
async def filter_video(req: FilterRequest):
    """Download BV and run perspective filter (face + wrist detection)."""
    bvid = req.bv_id
    bv_dir = DATA_DIR / bvid

    try:
        video_path = await _download_bv(bvid, bv_dir)
    except Exception as e:
        return {
            "passed": False,
            "reason": f"下载失败: {str(e)[:200]}",
            "total_frames": 0, "wrist_frames": 0, "face_frames": 0, "wrist_ratio": 0, "face_ratio": 0,
        }

    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None, lambda: _run_python(FILTER_SCRIPT, str(video_path))
        )
        # Save filter result
        (bv_dir / "filter_result.json").write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
        return {
            "passed": result.get("decision") == "pass",
            "reason": result.get("reject_reason") or "第一人称视角，手部操作清晰",
            "total_frames": result.get("total_frames", 0),
            "wrist_frames": result.get("wrist_frames", 0),
            "face_frames": result.get("face_frames", 0),
            "wrist_ratio": result.get("wrist_ratio", 0),
            "face_ratio": result.get("face_ratio", 0),
            "pass_rate": result.get("pass_rate", 0),
            "perspective": result.get("perspective", "unknown"),
        }
    except Exception as e:
        return {
            "passed": False,
            "reason": f"过滤器错误: {str(e)[:200]}",
            "total_frames": 0, "wrist_frames": 0, "face_frames": 0, "wrist_ratio": 0, "face_ratio": 0,
        }


@app.post("/api/claw/autolabel")
async def submit_autolabel(req: AutolabelRequest, background_tasks: BackgroundTasks):
    """Submit async VLM annotation job. Returns job_id immediately."""
    job = Job(bvid=req.bv_id, vision_model=req.vision_model, text_model=req.text_model)
    JOBS[job.job_id] = job

    background_tasks.add_task(_run_autolabel_job, job)
    return {"job_id": job.job_id, "bvid": req.bv_id, "status": "pending"}


async def _run_autolabel_job(job: Job):
    """Background task: run 4-stage VLM annotation pipeline."""
    bvid = job.bvid
    bv_dir = DATA_DIR / bvid
    bv_dir.mkdir(parents=True, exist_ok=True)

    job.status = "running"

    try:
        # ── Stage 1: Motion-adaptive frame extraction ────────────────────────
        job.stages[0].status = "running"

        # Find or download video
        existing = list(bv_dir.glob(f"{bvid}.*"))
        if not existing:
            try:
                video_path = await _download_bv(bvid, bv_dir)
            except Exception as e:
                raise RuntimeError(f"下载失败: {e}")
        else:
            video_path = existing[0]

        job.stages[0].status = "done"
        job.stages[0].result = {"video_path": str(video_path), "method": "motion_adaptive"}

        # ── Stage 2-4: VLM analysis (vision model does frame description, ────
        #               text model does action primitives + mechanics + summary)
        job.stages[1].status = "running"

        # Determine provider from vision model name
        provider = "local"  # Use Ollama by default
        api_key = "local"

        # Run vlm_video_analyzer.py
        analysis = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: _run_python(
                VLM_SCRIPT,
                provider, api_key, str(video_path), "32", job.vision_model,
                timeout=720  # 12 min max for large models
            )
        )

        if "error" in analysis:
            raise RuntimeError(analysis["error"])

        job.stages[1].status = "done"
        job.stages[2].status = "running"

        # Extract contact mechanics
        mechanics_phases = []
        for contact in (analysis.get("mechanics", {}).get("contacts") or []):
            mechanics_phases.append({
                "phase_name": contact.get("timestamp", ""),
                "contact_type": contact.get("contact_type", ""),
                "force_level": contact.get("force_level", ""),
                "motion_direction": contact.get("contact_points", ""),
            })

        job.stages[2].status = "done"
        job.stages[2].result = {"contacts": len(mechanics_phases)}
        job.stages[3].status = "running"

        # Build phases from temporal sequence
        phases = []
        for i, action in enumerate(analysis.get("temporal", {}).get("action_sequence", [])):
            phase = {
                "phase_name": action.get("action", f"Phase {i+1}"),
                "action_primitive": _infer_primitive_name(action.get("action", "")),
                "target_object": _extract_target(action.get("description", "")),
                "gripper_state": "engaged",
                "contact_mechanics": mechanics_phases[i] if i < len(mechanics_phases) else {},
            }
            phases.append(phase)

        task_summary = analysis.get("summary", {}).get("task_description", "")
        subject = analysis.get("subject", "")

        job.stages[3].status = "done"
        job.stages[3].result = {"task_summary": task_summary[:100]}

        # Build final result
        result = {
            "bvid": bvid,
            "domain": analysis.get("domain", "human_manipulation"),
            "subject": subject,
            "task_summary": task_summary,
            "phases": phases,
            "contact_mechanics": mechanics_phases,
            "lerobot_data": True,
            "analysis": analysis,
        }

        # Persist
        labels_dir = bv_dir / "labels"
        labels_dir.mkdir(exist_ok=True)
        (labels_dir / "result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))

        # LeRobot V2 format
        lerobot = _to_lerobot_v2(result)
        (labels_dir / "lerobot_v2.json").write_text(json.dumps(lerobot, ensure_ascii=False, indent=2))

        # π₀.5 SFT config
        sft = _to_sft_config(result)
        (labels_dir / "pi05_sft.jsonl").write_text("\n".join(json.dumps(l, ensure_ascii=False) for l in sft))

        job.result = result
        job.status = "done"

    except Exception as e:
        job.status = "error"
        job.error = str(e)
        for s in job.stages:
            if s.status == "running":
                s.status = "error"


def _infer_primitive_name(action_text: str) -> str:
    t = action_text.lower()
    if any(w in t for w in ["approach", "move", "reach"]): return "approach"
    if any(w in t for w in ["align", "position", "orient"]): return "align"
    if any(w in t for w in ["grasp", "grip", "pick", "grab"]): return "grasp"
    if any(w in t for w in ["insert", "push in"]): return "insert"
    if any(w in t for w in ["rotat", "turn", "spin", "twist"]): return "rotate"
    if any(w in t for w in ["lift", "raise"]): return "lift"
    if any(w in t for w in ["place", "put", "release", "set"]): return "place"
    if any(w in t for w in ["retract", "withdraw", "pull back"]): return "retract"
    if any(w in t for w in ["verify", "check", "inspect"]): return "verify"
    return "manipulate"


def _extract_target(desc: str) -> str:
    import re
    m = re.search(r"(?:toward|with|on|the)\s+([\w\s-]+?)(?:\s+at|\s+to|,|\.|$)", desc, re.I)
    if m:
        return m.group(1).strip().lower()[:30]
    return "object"


def _to_lerobot_v2(result: dict) -> dict:
    return {
        "format": "lerobot_v2",
        "version": "2.0",
        "episode_id": result["bvid"],
        "task": result.get("task_summary", ""),
        "language_instruction": result.get("task_summary", ""),
        "domain": result.get("domain", "human_manipulation"),
        "subject": result.get("subject", ""),
        "actions": [
            {
                "step": i,
                "primitive": p["action_primitive"],
                "target": p.get("target_object", ""),
                "contact_mechanics": p.get("contact_mechanics", {}),
            }
            for i, p in enumerate(result.get("phases", []))
        ],
        "source_video": result["bvid"],
        "annotated_by": "RoboMemoClaw AutoLabel",
        "created_at": datetime.utcnow().isoformat(),
    }


def _to_sft_config(result: dict) -> List[dict]:
    task = result.get("task_summary", "")
    phases = result.get("phases", [])
    lines = []
    for i, p in enumerate(phases):
        lines.append({
            "id": f"{result['bvid']}_step{i}",
            "source_video": result["bvid"],
            "language_instruction": task,
            "action_primitive": p["action_primitive"],
            "target_object": p.get("target_object", ""),
            "step_index": i,
            "total_steps": len(phases),
            "contact_mechanics": p.get("contact_mechanics", {}),
            "model_target": "pi0.5",
            "split": "train",
        })
    return lines


@app.get("/api/claw/status/{job_id}")
async def get_job_status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, f"Job {job_id} not found")
    return job.to_dict()


@app.get("/api/claw/export/lerobot/{bvid}")
async def export_lerobot(bvid: str):
    p = DATA_DIR / bvid / "labels" / "lerobot_v2.json"
    if not p.exists():
        raise HTTPException(404, f"No LeRobot data for {bvid}. Run autolabel first.")
    return FileResponse(p, filename=f"{bvid}_lerobot_v2.json", media_type="application/json")


@app.get("/api/claw/export/sft-config/{bvid}")
async def export_sft(bvid: str):
    p = DATA_DIR / bvid / "labels" / "pi05_sft.jsonl"
    if not p.exists():
        raise HTTPException(404, f"No SFT config for {bvid}. Run autolabel first.")
    return FileResponse(p, filename=f"{bvid}_sft_config.jsonl", media_type="application/x-ndjson")


@app.get("/api/claw/export/phases/{bvid}")
async def export_phases(bvid: str):
    p = DATA_DIR / bvid / "labels" / "result.json"
    if not p.exists():
        raise HTTPException(404, f"No phases data for {bvid}. Run autolabel first.")
    return FileResponse(p, filename=f"{bvid}_phases.json", media_type="application/json")


@app.get("/api/claw/export/summary")
async def export_summary():
    completed = []
    for job in JOBS.values():
        if job.status == "done":
            completed.append({
                "job_id": job.job_id,
                "bvid": job.bvid,
                "task_summary": (job.result or {}).get("task_summary", ""),
                "created_at": job.created_at,
            })
    return {"completed": completed, "total": len(completed)}


@app.get("/api/claw/export/list")
async def export_list():
    items = []
    for bv_dir in DATA_DIR.iterdir():
        if (bv_dir / "labels" / "result.json").exists():
            result = json.loads((bv_dir / "labels" / "result.json").read_text())
            items.append({
                "bvid": bv_dir.name,
                "task_summary": result.get("task_summary", ""),
                "domain": result.get("domain", ""),
            })
    return {"items": items}


@app.post("/api/claw/web3/upload")
async def web3_upload(payload: dict):
    """Proxy Web3 upload to Platform backend."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(f"{PLATFORM_URL}/api/web3/upload", json=payload)
        return resp.json()


@app.get("/api/claw/web3/status")
async def web3_status():
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{PLATFORM_URL}/api/web3/status")
        return resp.json()


@app.post("/api/claw/openclaw/import")
async def openclaw_import(req: OpenClawImportRequest):
    """Fetch a BV list JSON file from the OpenClaw agent workspace."""
    url = req.openclaw_url.rstrip("/") + "/workspace/" + req.filename
    headers = {}
    if req.token:
        headers["Authorization"] = f"Bearer {req.token}"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers=headers)
            data = resp.json()

        bvs = []
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    bvs.append(item.get("bvid") or item.get("bv_id") or "")
                elif isinstance(item, str) and item.startswith("BV"):
                    bvs.append(item)
        bvs = [b for b in bvs if b]
        return {"video_bvs": bvs, "filename": req.filename}
    except Exception as e:
        raise HTTPException(502, f"OpenClaw import failed: {e}")


@app.get("/api/vlm/local-models")
async def local_models():
    """List Ollama vision models."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get("http://localhost:11434/api/tags")
            data = resp.json()
        VISION_TAGS = ["llava", "llama3.2-vision", "minicpm-v", "bakllava", "moondream",
                       "qwen2.5vl", "qwen2-vl", "minicpm"]
        all_models = data.get("models", [])
        vision = [m for m in all_models if any(t in m["name"].lower() for t in VISION_TAGS)]
        return {"available": True, "models": vision or all_models}
    except Exception:
        return {"available": False, "models": []}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("claw_server:app", host="0.0.0.0", port=8000, reload=True)
