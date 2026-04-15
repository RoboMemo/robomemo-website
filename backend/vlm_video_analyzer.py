"""
VLM Video Analyzer for Structured VQA Generation
Uses state-of-the-art Vision Language Models to decompose videos into 7 types of structured annotations:
1. Temporal - Time relationships
2. Spatial - Spatial relationships
3. Attribute - Object attributes
4. Mechanics - Force and contact information
5. Reasoning - Action reasoning
6. Summary - Scene summary
7. Trajectory - Motion trajectory

Each annotation is grounded in visual evidence with temporal consistency.
"""

import sys
import json
import cv2
import numpy as np
from PIL import Image
from pathlib import Path
from typing import List, Dict, Any, Tuple
import base64
import io
from datetime import timedelta

# Support for multiple VLM backends
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    from google import genai as google_genai
    from google.genai import types as genai_types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


class VideoFrameExtractor:
    """Extract frames from video with temporal information"""

    @staticmethod
    def compute_motion_scores(video_path: str, sample_every: int = 4) -> Tuple[List[float], int, float]:
        """Compute per-frame motion magnitude via frame difference to guide adaptive sampling."""
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)

        scores = []
        prev_gray = None
        frame_idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % sample_every == 0:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                gray = cv2.resize(gray, (160, 90))  # Fast resize for speed
                if prev_gray is not None:
                    diff = cv2.absdiff(gray, prev_gray).astype(np.float32)
                    scores.append(float(diff.mean()))
                else:
                    scores.append(0.0)
                prev_gray = gray
            frame_idx += 1

        cap.release()
        return scores, total_frames, fps

    @staticmethod
    def motion_adaptive_indices(total_frames: int, num_frames: int,
                                motion_scores: List[float], sample_every: int = 4) -> List[int]:
        """
        Select frame indices weighted by motion magnitude.
        High-motion intervals get more frames; static scenes get fewer.
        Always include first and last frame.
        """
        if len(motion_scores) == 0:
            return list(np.linspace(0, total_frames - 1, num_frames, dtype=int))

        # Map motion scores back to full-resolution frame indices
        score_frame_indices = [i * sample_every for i in range(len(motion_scores))]
        scores_arr = np.array(motion_scores, dtype=np.float64)

        # Smooth to avoid micro-jitter dominance
        kernel = np.ones(5) / 5
        if len(scores_arr) >= 5:
            scores_arr = np.convolve(scores_arr, kernel, mode='same')

        # Add small baseline so static regions still get some coverage
        scores_arr = scores_arr + scores_arr.max() * 0.15
        scores_arr = scores_arr / scores_arr.sum()

        # Sample without replacement, weighted
        chosen_score_indices = np.random.choice(
            len(score_frame_indices),
            size=min(num_frames - 2, len(score_frame_indices)),
            replace=False,
            p=scores_arr
        )
        chosen_frame_indices = sorted(set(
            [0] + [score_frame_indices[i] for i in chosen_score_indices] + [total_frames - 1]
        ))

        # Trim or pad to exactly num_frames
        if len(chosen_frame_indices) > num_frames:
            # Trim by removing indices with lowest motion contribution
            while len(chosen_frame_indices) > num_frames:
                # Never remove first/last
                candidates = chosen_frame_indices[1:-1]
                remove = candidates[len(candidates) // 2]
                chosen_frame_indices.remove(remove)
        elif len(chosen_frame_indices) < num_frames:
            extra = np.linspace(0, total_frames - 1, num_frames, dtype=int)
            combined = sorted(set(chosen_frame_indices) | set(extra.tolist()))
            chosen_frame_indices = combined[:num_frames]

        return chosen_frame_indices

    @staticmethod
    def extract_frames_with_timestamps(
        video_path: str,
        num_frames: int = 32,
        include_temporal_context: bool = True,
        motion_adaptive: bool = True,
    ) -> List[Dict[str, Any]]:
        """Extract frames with timestamp and temporal context.

        When motion_adaptive=True (default), frames are sampled proportionally
        to motion magnitude so that action-dense moments receive denser coverage.
        """
        # Phase 1: compute motion scores for adaptive sampling
        if motion_adaptive:
            try:
                motion_scores, total_frames_ms, fps_ms = VideoFrameExtractor.compute_motion_scores(
                    video_path, sample_every=4
                )
                frame_indices = VideoFrameExtractor.motion_adaptive_indices(
                    total_frames_ms, num_frames, motion_scores, sample_every=4
                )
                use_adaptive = True
            except Exception:
                use_adaptive = False
        else:
            use_adaptive = False

        # Phase 2: extract selected frames
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        duration = total_frames / fps if fps > 0 else 0

        if not use_adaptive:
            frame_indices = list(np.linspace(0, total_frames - 1, num_frames, dtype=int))

        frames_data = []
        for idx, frame_idx in enumerate(frame_indices):
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret:
                continue

            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(frame_rgb)
            timestamp = frame_idx / fps if fps > 0 else 0

            frame_info = {
                'frame_idx': int(frame_idx),
                'sequence_idx': idx,
                'timestamp': timestamp,
                'timestamp_str': str(timedelta(seconds=timestamp)),
                'image': pil_image,
                'relative_position': idx / (len(frame_indices) - 1) if len(frame_indices) > 1 else 0,
                'sampling_mode': 'motion_adaptive' if use_adaptive else 'uniform',
            }
            frames_data.append(frame_info)

        cap.release()

        if include_temporal_context:
            for i, frame_data in enumerate(frames_data):
                frame_data['temporal_context'] = {
                    'is_first': i == 0,
                    'is_last': i == len(frames_data) - 1,
                    'prev_frame_idx': frames_data[i-1]['frame_idx'] if i > 0 else None,
                    'next_frame_idx': frames_data[i+1]['frame_idx'] if i < len(frames_data) - 1 else None
                }

        return frames_data, {'total_frames': total_frames, 'fps': fps, 'duration': duration,
                             'sampling_mode': 'motion_adaptive' if use_adaptive else 'uniform'}


class VLMAnalyzer:
    """Base class for VLM-based video analysis"""
    
    # ── Grounding helper doc injected into every prompt ──────────────────────
    _GROUNDING_SCHEMA = """
GROUNDING SCHEMA — required in every annotated item:
Every claim must include a "grounding" object with:
  - frame_indices: list of integer frame indices (from the sequence you were shown) that visually support this claim
  - timestamps: matching human-readable timestamps e.g. ["0:02", "0:03.5"]
  - bboxes: list of {"x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1, "label": "string"} in normalised [0,1] coords (x/y = top-left corner). Include bounding boxes for every relevant object region. If unsure, omit or use approximate values.
  - description: one sentence describing what the visual evidence shows
  - confidence: float 0.0–1.0 reflecting how certain you are based on the visual evidence

Example grounding object:
{
  "frame_indices": [24, 36, 48],
  "timestamps": ["0:02", "0:03", "0:04"],
  "bboxes": [{"x": 0.30, "y": 0.40, "width": 0.15, "height": 0.20, "label": "gripper"}],
  "description": "Frames 24-48: gripper jaws visibly closing around cup edge",
  "confidence": 0.91
}
"""

    VQA_PROMPT_TEMPLATE = """
You are an expert video analyst specialising in embodied AI data annotation.
The video may show: (a) a robot manipulator performing a task, or (b) a human performing a manual / craft / tool-use task.
Detect the domain first, then produce structured annotations that are ACCURATE to what you observe.

VIDEO CONTEXT:
- Total frames: {total_frames}
- Duration: {duration:.2f} seconds
- FPS: {fps:.2f}
- Frame sampling: {sampling_mode} (frames are denser around high-motion moments)
- Frames are labelled with [Frame N/M @ timestamp] markers in the sequence you received.

""" + _GROUNDING_SCHEMA.strip() + """

DOMAIN DETECTION (fill in before annotating):
- "domain": "robot_manipulation" | "human_manipulation" | "human_tool_use" | "other"
- "subject": describe who/what performs the action (e.g. "robotic arm with parallel-jaw gripper", "human right hand", "human using Phillips screwdriver")

CATEGORIES TO ANALYSE:

1. TEMPORAL — chronological action sequence; what happens before/after what
2. SPATIAL — spatial relationships (left/right/above/below/near) between the agent, tools, and objects
3. ATTRIBUTE — object and tool properties: color, material, shape, size, state changes
4. MECHANICS — contact type, force level (light/medium/strong), contact points, force profile over time
   • For robot: gripper forces, torque, compliance
   • For human tool-use: hand force, tool-object engagement, friction
5. REASONING — why each action is performed this way; strategy and constraints
6. SUMMARY — high-level task description, start state, end state, milestones, success/failure
   • state whether this is suitable as embodied-AI training data and why
7. TRAJECTORY — motion path: type (linear/curved/rotational), velocity (slow/medium/fast), waypoints

OUTPUT FORMAT — return ONLY valid JSON (no markdown):
{{
  "domain": "human_tool_use",
  "subject": "human right hand with Phillips-head screwdriver",
  "temporal": {{
    "action_sequence": [
      {{
        "action": "Approach screw with screwdriver",
        "timestamp": "0:02",
        "frame_range": [12, 36],
        "description": "Hand moves screwdriver tip toward screw head from upper left",
        "grounding": {{
          "frame_indices": [12, 24, 36],
          "timestamps": ["0:02", "0:03", "0:04"],
          "bboxes": [{{"x": 0.35, "y": 0.30, "width": 0.15, "height": 0.20, "label": "screwdriver-tip"}}],
          "description": "Frames 12-36: screwdriver tip visibly approaching screw head",
          "confidence": 0.93
        }}
      }}
    ],
    "relationships": ["Approach BEFORE Alignment", "Alignment BEFORE Insert & Rotate"]
  }},
  "spatial": {{
    "key_relationships": [
      {{
        "timestamp": "0:03",
        "relationship": "Screwdriver tip centred over screw head",
        "details": "Tool axis aligned with screw axis within ~5 degrees",
        "grounding": {{
          "frame_indices": [36, 42],
          "timestamps": ["0:04", "0:04.5"],
          "bboxes": [
            {{"x": 0.38, "y": 0.28, "width": 0.10, "height": 0.08, "label": "screwdriver-tip"}},
            {{"x": 0.40, "y": 0.30, "width": 0.06, "height": 0.06, "label": "screw-head"}}
          ],
          "description": "Overhead view shows tip and screw head overlapping",
          "confidence": 0.90
        }}
      }}
    ],
    "workspace_description": "Tabletop workspace, first-person perspective, ~30x20 cm visible area"
  }},
  "attribute": {{
    "objects": [
      {{
        "name": "Phillips screw",
        "properties": {{"material": "metal", "head_type": "Phillips #2", "size": "M4 approx"}},
        "state_changes": ["Loose → Partially tightened at t=0:04", "Partially tightened → Fully tightened at t=0:08"],
        "grounding": {{
          "frame_indices": [0, 60, 180],
          "timestamps": ["0:00", "0:04", "0:08"],
          "bboxes": [{{"x": 0.38, "y": 0.29, "width": 0.06, "height": 0.06, "label": "screw"}}],
          "description": "Screw visible throughout; rotation of screwdriver head visible in mid frames",
          "confidence": 0.95
        }}
      }}
    ]
  }},
  "mechanics": {{
    "contacts": [
      {{
        "timestamp": "0:03",
        "contact_type": "Tool-fastener engagement (Phillips bit in cross recess)",
        "force_level": "light-to-medium",
        "contact_points": "Four lobes of Phillips head recess",
        "friction_coefficient": "~0.15–0.25 (steel-on-steel with slight camout risk)",
        "grounding": {{
          "frame_indices": [60, 72],
          "timestamps": ["0:03", "0:03.5"],
          "bboxes": [{{"x": 0.37, "y": 0.28, "width": 0.07, "height": 0.07, "label": "contact-region"}}],
          "description": "Screwdriver bit seated in screw head recess, hand applying downward pressure",
          "confidence": 0.85
        }}
      }}
    ],
    "force_profile": "~0 N at approach; axial pre-load ~5–15 N during rotation to prevent cam-out; torque ~0.5–1.5 Nm for M4 screw into wood/metal"
  }},
  "reasoning": {{
    "action_justifications": [
      {{
        "action": "Slow approach and careful alignment before insertion",
        "reason": "Phillips head requires tip-recess alignment to prevent cam-out and surface damage",
        "constraints": ["Avoid stripping screw head", "Maintain axial force to keep engagement"],
        "grounding": {{
          "frame_indices": [0, 24],
          "timestamps": ["0:00", "0:02"],
          "bboxes": [],
          "description": "Deliberate slow approach visible in first 24 frames",
          "confidence": 0.82
        }}
      }}
    ],
    "overall_strategy": "Manual screw-fastening: align → seat under axial pre-load → rotate CW while maintaining downward pressure"
  }},
  "summary": {{
    "task_description": "Human tightens a Phillips screw using a hand screwdriver",
    "start_state": "Screw partially inserted, screwdriver held above",
    "end_state": "Screw fully tightened flush with surface",
    "success": true,
    "key_milestones": ["Tip engagement at 0:03", "First full rotation at 0:05", "Final tightened at 0:08"],
    "duration": "{duration:.1f} seconds",
    "training_data_assessment": "Suitable as SFT demonstration for dexterous tool-use tasks; first-person viewpoint provides good end-effector perspective",
    "grounding_start": {{
      "frame_indices": [0, 6],
      "timestamps": ["0:00", "0:00.2"],
      "bboxes": [{{"x": 0.38, "y": 0.29, "width": 0.06, "height": 0.06, "label": "screw-initial"}}],
      "description": "Initial state: screw visible, screwdriver approaching",
      "confidence": 0.97
    }},
    "grounding_end": {{
      "frame_indices": [175, 180],
      "timestamps": ["0:07.8", "0:08"],
      "bboxes": [{{"x": 0.38, "y": 0.29, "width": 0.06, "height": 0.06, "label": "screw-final"}}],
      "description": "Final state: screw fully seated, screwdriver lifted away",
      "confidence": 0.96
    }}
  }},
  "trajectory": {{
    "motion_segments": [
      {{
        "segment": "Approach",
        "time_range": "0:00-0:03",
        "motion_type": "linear_with_tilt_correction",
        "velocity": "slow",
        "waypoints": ["Above workspace", "Aligned over screw", "Tip seated in recess"],
        "grounding": {{
          "frame_indices": [0, 18, 36],
          "timestamps": ["0:00", "0:01", "0:02"],
          "bboxes": [{{"x": 0.30, "y": 0.20, "width": 0.35, "height": 0.30, "label": "approach-path"}}],
          "description": "Straight downward approach with minor tilt correction",
          "confidence": 0.88
        }}
      }},
      {{
        "segment": "Rotation",
        "time_range": "0:03-0:08",
        "motion_type": "rotational_CW",
        "velocity": "slow-to-medium",
        "waypoints": ["First turn", "Second turn", "Third turn (tightened)"],
        "grounding": {{
          "frame_indices": [60, 100, 140],
          "timestamps": ["0:03", "0:05", "0:07"],
          "bboxes": [{{"x": 0.25, "y": 0.25, "width": 0.20, "height": 0.20, "label": "wrist-rotation"}}],
          "description": "Clockwise wrist rotation visible across frames 60-140",
          "confidence": 0.91
        }}
      }}
    ],
    "overall_path": "Vertical descent → rotational about screw axis (CW) with maintained axial pressure"
  }},
  "visual_evidence": {{
    "key_frames": [
      {{"frame_idx": 0,  "timestamp": "0:00", "significance": "Initial state"}},
      {{"frame_idx": 36, "timestamp": "0:02", "significance": "Tip aligned with screw"}},
      {{"frame_idx": 60, "timestamp": "0:03", "significance": "Engagement confirmed"}},
      {{"frame_idx": 120, "timestamp": "0:05", "significance": "Mid-rotation progress"}}
    ]
  }},
  "confidence_scores": {{
    "temporal":   0.0,
    "spatial":    0.0,
    "attribute":  0.0,
    "mechanics":  0.0,
    "reasoning":  0.0,
    "summary":    0.0,
    "trajectory": 0.0
  }}
}}

IMPORTANT RULES:
- Replace ALL example values with your ACTUAL observations from the video.
- If the video shows a ROBOT, use robot-appropriate terminology (gripper, end-effector, joint, torque sensor).
- If the video shows a HUMAN, use human-appropriate terminology (hand, wrist, finger, tool grip).
- Do NOT hallucinate objects, actions, or forces not visible in the frames.
- Confidence scores must reflect your genuine certainty (0.0–1.0) per category.
- Return ONLY the JSON object. No markdown. No explanation outside the JSON.
"""

    def __init__(self, api_key: str, model_name: str = "auto"):
        """Initialize VLM analyzer with API key"""
        self.api_key = api_key
        self.model_name = model_name
        
    def analyze_video(self, video_path: str, num_frames: int = 32) -> Dict[str, Any]:
        """Analyze video and generate structured VQA annotations"""
        raise NotImplementedError("Subclass must implement analyze_video")
    
    @staticmethod
    def image_to_base64(image: Image.Image, format: str = "JPEG") -> str:
        """Convert PIL Image to base64 string"""
        buffer = io.BytesIO()
        image.save(buffer, format=format)
        return base64.b64encode(buffer.getvalue()).decode('utf-8')


class GeminiAnalyzer(VLMAnalyzer):
    """Gemini 2.5 Pro Analyzer using new google-genai SDK"""

    MODEL = "gemini-2.5-pro-preview-05-06"

    def __init__(self, api_key: str):
        super().__init__(api_key, self.MODEL)
        if not GEMINI_AVAILABLE:
            raise ImportError("google-genai not installed. Install: pip install google-genai")
        self.client = google_genai.Client(api_key=api_key)

    def analyze_video(self, video_path: str, num_frames: int = 32) -> Dict[str, Any]:
        """Analyze video using Gemini 2.5 Pro"""
        print(f"Extracting {num_frames} frames from video...")
        frames_data, video_info = VideoFrameExtractor.extract_frames_with_timestamps(
            video_path, num_frames
        )

        print(f"Analyzing with {self.MODEL} ({len(frames_data)} frames)...")

        prompt = self.VQA_PROMPT_TEMPLATE.format(
            total_frames=video_info['total_frames'],
            duration=video_info['duration'],
            fps=video_info['fps'],
            sampling_mode=video_info.get('sampling_mode', 'uniform'),
        )

        # Build content parts: interleave timestamp labels + images
        contents = []
        for i, frame_data in enumerate(frames_data):
            # Inline image bytes
            buf = io.BytesIO()
            frame_data['image'].save(buf, format='JPEG', quality=85)
            contents.append(
                genai_types.Part.from_bytes(
                    data=buf.getvalue(),
                    mime_type='image/jpeg'
                )
            )
            # Add timestamp label every 8 frames
            if i % 8 == 0:
                contents.append(
                    genai_types.Part.from_text(
                        f"[Frame {i+1}/{len(frames_data)} @ {frame_data['timestamp_str']}]"
                    )
                )
        # Final prompt
        contents.append(genai_types.Part.from_text(prompt))

        try:
            response = self.client.models.generate_content(
                model=self.MODEL,
                contents=contents,
                config=genai_types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=8192,
                    thinking_config=genai_types.ThinkingConfig(thinking_budget=5000),
                ),
            )

            result_text = response.text

            # Strip markdown fences if present
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0]
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0]

            analysis = json.loads(result_text.strip())
            analysis['metadata'] = {
                'video_path': video_path,
                'video_info': video_info,
                'num_frames_analyzed': len(frames_data),
                'model': self.MODEL,
                'frame_timestamps': [f['timestamp_str'] for f in frames_data]
            }
            return analysis

        except Exception as e:
            return {
                'error': str(e),
                'video_path': video_path,
                'model': self.MODEL
            }


class ClaudeAnalyzer(VLMAnalyzer):
    """Claude 3 Opus/Sonnet Vision Analyzer"""
    
    def __init__(self, api_key: str, model: str = "claude-3-5-sonnet-20241022"):
        super().__init__(api_key, model)
        if not ANTHROPIC_AVAILABLE:
            raise ImportError("anthropic not installed. Install: pip install anthropic")
        
        self.client = anthropic.Anthropic(api_key=api_key)
    
    def analyze_video(self, video_path: str, num_frames: int = 32) -> Dict[str, Any]:
        """Analyze video using Claude"""
        print(f"Extracting {num_frames} frames from video...")
        frames_data, video_info = VideoFrameExtractor.extract_frames_with_timestamps(
            video_path, num_frames
        )
        
        print(f"Analyzing with Claude ({len(frames_data)} frames)...")
        
        # Prepare prompt
        prompt = self.VQA_PROMPT_TEMPLATE.format(
            total_frames=video_info['total_frames'],
            duration=video_info['duration'],
            fps=video_info['fps'],
            sampling_mode=video_info.get('sampling_mode', 'uniform'),
        )

        # Prepare content with frames
        content = []
        for i, frame_data in enumerate(frames_data):
            base64_image = self.image_to_base64(frame_data['image'])
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": base64_image
                }
            })
            # Add timestamp context every few frames
            if i % 8 == 0:
                content.append({
                    "type": "text",
                    "text": f"[Frame {i+1}/{len(frames_data)} at {frame_data['timestamp_str']}]"
                })
        
        content.append({
            "type": "text",
            "text": prompt
        })
        
        try:
            response = self.client.messages.create(
                model=self.model_name,
                max_tokens=4096,
                temperature=0.2,
                messages=[{
                    "role": "user",
                    "content": content
                }]
            )
            
            result_text = response.content[0].text
            
            # Parse JSON response
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0]
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0]
            
            analysis = json.loads(result_text.strip())
            
            # Add metadata
            analysis['metadata'] = {
                'video_path': video_path,
                'video_info': video_info,
                'num_frames_analyzed': len(frames_data),
                'model': self.model_name,
                'frame_timestamps': [f['timestamp_str'] for f in frames_data]
            }
            
            return analysis
            
        except Exception as e:
            return {
                'error': str(e),
                'video_path': video_path,
                'model': self.model_name
            }


class GPT4VisionAnalyzer(VLMAnalyzer):
    """GPT-4 Vision Analyzer"""
    
    def __init__(self, api_key: str, model: str = "gpt-4o"):
        super().__init__(api_key, model)
        if not OPENAI_AVAILABLE:
            raise ImportError("openai not installed. Install: pip install openai")
        
        self.client = openai.OpenAI(api_key=api_key)
    
    def analyze_video(self, video_path: str, num_frames: int = 32) -> Dict[str, Any]:
        """Analyze video using GPT-4 Vision"""
        print(f"Extracting {num_frames} frames from video...")
        frames_data, video_info = VideoFrameExtractor.extract_frames_with_timestamps(
            video_path, num_frames
        )
        
        print(f"Analyzing with {self.model_name} ({len(frames_data)} frames)...")
        
        # Prepare prompt
        prompt = self.VQA_PROMPT_TEMPLATE.format(
            total_frames=video_info['total_frames'],
            duration=video_info['duration'],
            fps=video_info['fps'],
            sampling_mode=video_info.get('sampling_mode', 'uniform'),
        )

        # Prepare content with frames
        content = [{"type": "text", "text": prompt}]
        
        for i, frame_data in enumerate(frames_data):
            base64_image = self.image_to_base64(frame_data['image'])
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{base64_image}",
                    "detail": "high"
                }
            })
        
        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[{
                    "role": "user",
                    "content": content
                }],
                max_tokens=4096,
                temperature=0.2
            )
            
            result_text = response.choices[0].message.content
            
            # Parse JSON response
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0]
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0]
            
            analysis = json.loads(result_text.strip())
            
            # Add metadata
            analysis['metadata'] = {
                'video_path': video_path,
                'video_info': video_info,
                'num_frames_analyzed': len(frames_data),
                'model': self.model_name,
                'frame_timestamps': [f['timestamp_str'] for f in frames_data]
            }
            
            return analysis
            
        except Exception as e:
            return {
                'error': str(e),
                'video_path': video_path,
                'model': self.model_name
            }


class OllamaAnalyzer(VLMAnalyzer):
    """本地 Ollama VLM 分析器 — 无需 API Key，完全离线运行"""

    VISION_TAGS = ["llava", "llama3.2-vision", "minicpm-v", "bakllava", "moondream", "minicpm"]

    def __init__(self, model: str = "llama3.2-vision:latest",
                 ollama_url: str = "http://localhost:11434"):
        super().__init__(api_key="local", model_name=model)
        self.model = model
        self.ollama_url = ollama_url.rstrip("/")

    @classmethod
    def list_vision_models(cls, ollama_url: str = "http://localhost:11434") -> list:
        """从 Ollama 获取已安装的视觉模型列表"""
        import requests as _req
        try:
            r = _req.get(f"{ollama_url}/api/tags", timeout=5)
            r.raise_for_status()
            all_models = r.json().get("models", [])
            vision = [
                {"name": m["name"], "size": m.get("size", 0),
                 "modified_at": m.get("modified_at", "")}
                for m in all_models
                if any(tag in m["name"].lower() for tag in cls.VISION_TAGS)
            ]
            # 如果没有识别到，返回全部
            return vision if vision else [
                {"name": m["name"], "size": m.get("size", 0)} for m in all_models
            ]
        except Exception:
            return []

    def analyze_video(self, video_path: str, num_frames: int = 16) -> Dict[str, Any]:
        """使用 Ollama 本地视觉模型分析视频"""
        import requests as _req

        # 本地模型建议 8–16 帧，避免超时与上下文溢出
        num_frames = min(num_frames, 16)

        print(f"提取 {num_frames} 帧...")
        frames_data, video_info = VideoFrameExtractor.extract_frames_with_timestamps(
            video_path, num_frames
        )
        print(f"使用 Ollama/{self.model} 分析 ({len(frames_data)} 帧)...")

        prompt = self.VQA_PROMPT_TEMPLATE.format(
            total_frames=video_info['total_frames'],
            duration=video_info['duration'],
            fps=video_info['fps'],
            sampling_mode=video_info.get('sampling_mode', 'uniform'),
        )
        # 把时间戳信息注入 prompt 开头（本地模型无法交替图像与文本）
        ts_ctx = " | ".join(
            f"Frame{i+1}={fd['timestamp_str']}" for i, fd in enumerate(frames_data)
        )
        full_prompt = f"帧时间戳: {ts_ctx}\n\n{prompt}"

        # base64 图像列表（纯 base64，不含 data URI 前缀）
        images = [
            self.image_to_base64(fd['image'], format='JPEG')
            for fd in frames_data
        ]

        payload = {
            "model": self.model,
            "messages": [
                {"role": "user", "content": full_prompt, "images": images}
            ],
            "stream": False,
            "options": {
                "temperature": 0.2,
                "num_predict": 4096,
                "num_ctx": 8192,
            },
        }

        try:
            resp = _req.post(
                f"{self.ollama_url}/api/chat",
                json=payload,
                timeout=600,        # 本地模型最多等 10 分钟
            )
            resp.raise_for_status()
            result_text = resp.json()["message"]["content"]

            # 去掉 Markdown 代码块
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0]
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0]

            # 提取 JSON 主体
            start = result_text.find("{")
            end = result_text.rfind("}") + 1
            if start >= 0 and end > start:
                result_text = result_text[start:end]

            analysis = json.loads(result_text.strip())
            analysis['metadata'] = {
                'video_path': video_path,
                'video_info': video_info,
                'num_frames_analyzed': len(frames_data),
                'model': f"ollama/{self.model}",
                'frame_timestamps': [f['timestamp_str'] for f in frames_data],
                'local': True,
            }
            return analysis

        except json.JSONDecodeError as e:
            # 本地模型有时 JSON 不完整，保存原始文本供调试
            return {
                'error': f'JSON 解析失败: {e}',
                'raw_response': result_text[:3000],
                'video_path': video_path,
                'model': f"ollama/{self.model}",
                'metadata': {'model': f"ollama/{self.model}", 'local': True},
            }
        except Exception as e:
            return {
                'error': str(e),
                'video_path': video_path,
                'model': f"ollama/{self.model}",
            }


def create_analyzer(provider: str = "gemini", api_key: str = None, model: str = None) -> VLMAnalyzer:
    """Factory function to create appropriate analyzer"""
    if provider == "gemini":
        return GeminiAnalyzer(api_key)
    elif provider == "claude":
        model = model or "claude-3-5-sonnet-20241022"
        return ClaudeAnalyzer(api_key, model)
    elif provider == "openai":
        model = model or "gpt-4o"
        return GPT4VisionAnalyzer(api_key, model)
    elif provider in ("local", "ollama"):
        model = model or "llama3.2-vision:latest"
        return OllamaAnalyzer(model)
    else:
        raise ValueError(f"Unknown provider: {provider}. Choose from: gemini, claude, openai, local")


def main():
    """Main entry point for CLI usage"""
    if len(sys.argv) < 4:
        print(json.dumps({
            "error": "Usage: python vlm_video_analyzer.py <provider> <api_key> <video_path> [num_frames] [model]",
            "providers": ["gemini", "claude", "openai", "local"]
        }))
        return
    
    provider = sys.argv[1]
    api_key = sys.argv[2]
    video_path = sys.argv[3]
    num_frames = int(sys.argv[4]) if len(sys.argv) > 4 else 32
    model = sys.argv[5] if len(sys.argv) > 5 else None
    
    try:
        # Create analyzer
        analyzer = create_analyzer(provider, api_key, model)
        
        # Analyze video
        result = analyzer.analyze_video(video_path, num_frames)
        
        # Print result
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "traceback": str(e.__traceback__)
        }))


if __name__ == "__main__":
    main()
