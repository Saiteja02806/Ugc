import json
import sys

import cv2


def clamp(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(
            "Usage: detect-wall-text-video-faces.py <video-path> <seconds>"
        )

    video_path = sys.argv[1]
    seconds = float(sys.argv[2])
    capture = cv2.VideoCapture(video_path)

    if not capture.isOpened():
        raise RuntimeError(f"Could not open video: {video_path}")

    capture.set(cv2.CAP_PROP_POS_MSEC, seconds * 1000)
    ok, frame = capture.read()
    capture.release()

    if not ok or frame is None:
        raise RuntimeError(f"Could not read representative frame: {video_path}")

    frame_height, frame_width = frame.shape[:2]
    grey = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    grey = cv2.equalizeHist(grey)
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    cascade = cv2.CascadeClassifier(cascade_path)

    if cascade.empty():
        raise RuntimeError("OpenCV frontal-face cascade is unavailable.")

    detections = cascade.detectMultiScale(
        grey,
        scaleFactor=1.08,
        minNeighbors=5,
        minSize=(max(36, frame_width // 18), max(36, frame_height // 18)),
    )
    face_boxes = []
    protected_landmarks = []

    for x, y, width, height in detections:
        normalized = {
            "height": clamp(height / frame_height),
            "width": clamp(width / frame_width),
            "x": clamp(x / frame_width),
            "y": clamp(y / frame_height),
        }
        face_boxes.append(normalized)
        protected_landmarks.extend(
            [
                {
                    "x": clamp((x + width * 0.32) / frame_width),
                    "y": clamp((y + height * 0.40) / frame_height),
                },
                {
                    "x": clamp((x + width * 0.68) / frame_width),
                    "y": clamp((y + height * 0.40) / frame_height),
                },
                {
                    "x": clamp((x + width * 0.50) / frame_width),
                    "y": clamp((y + height * 0.73) / frame_height),
                },
            ]
        )

    print(
        json.dumps(
            {
                "detector": "opencv-haar-frontal-v1",
                "faceBoxes": face_boxes,
                "protectedLandmarks": protected_landmarks,
            }
        )
    )


if __name__ == "__main__":
    main()
