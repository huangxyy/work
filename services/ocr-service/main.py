from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Mock OCR Service")


class OcrRequest(BaseModel):
  image_url: str | None = None
  image_base64: str | None = None
  preprocess: bool | None = False


@app.get("/health")
async def health():
  return {"status": "ok"}


@app.post("/ocr")
async def run_ocr(payload: OcrRequest):
  text = payload.image_url or payload.image_base64
  return {"text": text or "mock ocr result", "confidence": 0.9}


if __name__ == "__main__":
  import uvicorn

  uvicorn.run("main:app", host="0.0.0.0", port=8000)