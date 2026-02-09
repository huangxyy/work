import base64
from typing import Tuple
from urllib.request import urlopen

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from paddleocr import PaddleOCR
from pydantic import BaseModel

app = FastAPI(title="OCR Service")

ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False, use_space_char=True)


class OcrRequest(BaseModel):
  image_url: str | None = None
  image_base64: str | None = None
  preprocess: bool | None = False


@app.get("/health")
async def health():
  return {"status": "ok"}


def decode_base64(data: str) -> bytes:
  if data.startswith("data:") and "," in data:
    data = data.split(",", 1)[1]
  return base64.b64decode(data)


def load_image(payload: OcrRequest) -> Tuple[np.ndarray, bool]:
  if payload.image_base64:
    raw = decode_base64(payload.image_base64)
  elif payload.image_url:
    try:
      with urlopen(payload.image_url, timeout=10) as response:
        raw = response.read()
    except Exception as error:
      raise HTTPException(status_code=400, detail=f"Failed to download image: {error}") from error
  else:
    raise HTTPException(status_code=400, detail="image_url or image_base64 required")

  data = np.frombuffer(raw, dtype=np.uint8)
  image = cv2.imdecode(data, cv2.IMREAD_COLOR)
  if image is None:
    raise HTTPException(status_code=400, detail="Invalid image data")

  return image, bool(payload.preprocess)


def preprocess_image(image: np.ndarray) -> np.ndarray:
  gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
  gray = cv2.GaussianBlur(gray, (3, 3), 0)
  _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
  return cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)


def extract_lines(result: list) -> list:
  if not result:
    return []

  if (
    len(result) == 1
    and isinstance(result[0], list)
    and result[0]
    and isinstance(result[0][0], list)
    and len(result[0][0]) == 2
  ):
    return result[0]

  return result


@app.post("/ocr")
async def run_ocr(payload: OcrRequest):
  image, should_preprocess = load_image(payload)
  if should_preprocess:
    image = preprocess_image(image)

  result = ocr.ocr(image, cls=True)
  lines = extract_lines(result)

  texts = []
  confidences = []
  for line in lines:
    if not line or len(line) < 2:
      continue
    text_block = line[1]
    if isinstance(text_block, (list, tuple)) and text_block:
      text = text_block[0]
      confidence = text_block[1] if len(text_block) > 1 else None
      if text:
        texts.append(text)
      if isinstance(confidence, (float, int)):
        confidences.append(float(confidence))

  merged_text = "\n".join(texts).strip()
  avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

  return {"text": merged_text, "confidence": avg_confidence}


if __name__ == "__main__":
  import uvicorn

  uvicorn.run("main:app", host="0.0.0.0", port=8000)
