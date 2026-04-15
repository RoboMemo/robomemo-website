"""
RynnVLA Pipeline Filter
Classifies video perspective (first-person vs third-person) using:
  - Face detection via OpenCV Haar Cascades
  - Hand/wrist region heuristics (bottom-half dominant motion = egocentric view)

Usage:
  python pipeline_filter.py <video_path> [sample_every_n_frames]

Output (JSON to stdout):
  {
    "video_path": "...",
    "total_frames": 4823,
    "face_frames": 47,
    "wrist_frames": 4159,
    "face_ratio": 0.0097,
    "wrist_ratio": 0.8623,
    "pass_rate": 86.23,
    "decision": "pass",
    "perspective": "first_person",
    "reject_reason": null
  }
"""

import sys
import json
import cv2
import numpy as np
from pathlib import Path


# ─── Constants ────────────────────────────────────────────────────────────────
FACE_RATIO_THRESHOLD = 0.15      # >15% face frames → third-person → reject
WRIST_RATIO_THRESHOLD = 0.30     # <30% wrist frames → too little hand content → reject
FACE_CASCADE_PATH = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
PROFILE_CASCADE_PATH = cv2.data.haarcascades + "haarcascade_profileface.xml"


class PerspectiveFilter:
    def __init__(self):
        self.face_cascade = cv2.CascadeClassifier(FACE_CASCADE_PATH)
        self.profile_cascade = cv2.CascadeClassifier(PROFILE_CASCADE_PATH)

    def detect_face(self, gray_frame: np.ndarray) -> bool:
        """Return True if a prominent face is detected in this frame."""
        h, w = gray_frame.shape
        # Detect frontal faces
        faces = self.face_cascade.detectMultiScale(
            gray_frame,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(int(w * 0.06), int(h * 0.06)),  # face must be at least 6% of frame width
        )
        if len(faces) > 0:
            # Only count if the face is reasonably large (not a tiny face in the background)
            for (_, _, fw, fh) in faces:
                if fw * fh > (w * h * 0.005):  # face area > 0.5% of frame
                    return True

        # Also check profile faces
        profiles = self.profile_cascade.detectMultiScale(
            gray_frame,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(int(w * 0.06), int(h * 0.06)),
        )
        if len(profiles) > 0:
            for (_, _, pw, ph) in profiles:
                if pw * ph > (w * h * 0.005):
                    return True

        return False

    def detect_wrist_view(self, frame: np.ndarray, prev_frame: np.ndarray | None) -> bool:
        """
        Estimate whether this frame is from a wrist/egocentric perspective.
        Heuristic: in first-person tool-use videos, motion is concentrated in the
        lower-centre portion of the frame (hands operating in front of the operator).
        We use:
          1. Skin-tone presence in the lower 60% of the frame
          2. Motion in lower-centre region (if prev_frame available)
        """
        h, w = frame.shape[:2]
        lower_region = frame[int(h * 0.3):, :]  # lower 70% of frame

        # Skin tone detection in HSV
        hsv = cv2.cvtColor(lower_region, cv2.COLOR_BGR2HSV)
        lower_skin = np.array([0, 20, 70], dtype=np.uint8)
        upper_skin = np.array([25, 255, 255], dtype=np.uint8)
        skin_mask = cv2.inRange(hsv, lower_skin, upper_skin)
        skin_ratio = skin_mask.sum() / (255 * skin_mask.size)

        if skin_ratio > 0.04:  # at least 4% skin-like pixels in lower region
            return True

        # Motion in lower-centre area (egocentric videos have hand motion there)
        if prev_frame is not None:
            prev_lower = prev_frame[int(h * 0.3):, int(w * 0.15):int(w * 0.85)]
            curr_lower = frame[int(h * 0.3):, int(w * 0.15):int(w * 0.85)]
            prev_gray = cv2.cvtColor(prev_lower, cv2.COLOR_BGR2GRAY)
            curr_gray = cv2.cvtColor(curr_lower, cv2.COLOR_BGR2GRAY)
            diff = cv2.absdiff(prev_gray, curr_gray)
            motion_ratio = (diff > 15).sum() / diff.size
            if motion_ratio > 0.05:  # >5% pixels changed
                return True

        return False

    def filter_video(self, video_path: str, sample_every: int = 5) -> dict:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return {"error": f"Cannot open video: {video_path}"}

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)

        face_frame_count = 0
        wrist_frame_count = 0
        sampled_count = 0
        prev_frame = None
        frame_idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_every == 0:
                small = cv2.resize(frame, (320, 180))
                gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

                if self.detect_face(gray):
                    face_frame_count += 1

                if self.detect_wrist_view(small, prev_frame):
                    wrist_frame_count += 1

                prev_frame = small
                sampled_count += 1

            frame_idx += 1

        cap.release()

        if sampled_count == 0:
            return {"error": "No frames could be sampled"}

        # Scale counts back to approximate full-video counts
        scale = total_frames / sampled_count
        estimated_face_frames = int(face_frame_count * scale)
        estimated_wrist_frames = int(wrist_frame_count * scale)

        face_ratio = face_frame_count / sampled_count
        wrist_ratio = wrist_frame_count / sampled_count
        pass_rate = wrist_ratio * 100

        # Decision logic
        if face_ratio > FACE_RATIO_THRESHOLD:
            decision = "reject"
            perspective = "third_person"
            reject_reason = f"人脸帧占比过高 ({face_ratio*100:.1f}%)，判定为第三人称视角"
        elif wrist_ratio < WRIST_RATIO_THRESHOLD:
            decision = "reject"
            perspective = "unknown"
            reject_reason = f"手腕/手部帧占比过低 ({wrist_ratio*100:.1f}%)，视角不明确"
        else:
            decision = "pass"
            perspective = "first_person"
            reject_reason = None

        return {
            "video_path": video_path,
            "total_frames": total_frames,
            "sampled_frames": sampled_count,
            "face_frames": estimated_face_frames,
            "wrist_frames": estimated_wrist_frames,
            "face_ratio": round(face_ratio, 4),
            "wrist_ratio": round(wrist_ratio, 4),
            "pass_rate": round(pass_rate, 2),
            "decision": decision,
            "perspective": perspective,
            "reject_reason": reject_reason,
            "fps": fps,
        }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python pipeline_filter.py <video_path> [sample_every_n]"}))
        sys.exit(1)

    video_path = sys.argv[1]
    sample_every = int(sys.argv[2]) if len(sys.argv) > 2 else 5

    f = PerspectiveFilter()
    result = f.filter_video(video_path, sample_every)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
