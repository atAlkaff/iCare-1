from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse
import cv2, numpy as np, re, os
from ocr.get_data_opendfda import get_data_from_openfda
from ocr.detect_and_read import read_brand_from_image

router = APIRouter()

GENERIC_DROP = {"extra","maximum","strength","tablets","tablet","capsule","caplets","mg","ml","iu"}

def first_strong_token(s: str) -> str:
    toks = re.sub(r"[^A-Za-z0-9]+", " ", s).split()
    toks = [t for t in toks if t.lower() not in GENERIC_DROP]
    for t in toks:
        if t and t[0].isalpha():
            return t
    return toks[0] if toks else ""

@router.post("/brand-info")
async def extract_brand_and_info(file: UploadFile = File(...)):
    data = await file.read()
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        cv2.imwrite(tmp.name, img)
        det = read_brand_from_image(tmp.name)
    try:
        os.remove(tmp.name)
    except Exception:
        pass

    brand_raw = (det or {}).get("brand", "").strip()
    token = first_strong_token(brand_raw)

    sections = get_data_from_openfda(token) if token else {}

    out = {
        "brand_raw": brand_raw,
        "brand_token": token,
        "bbox": (det or {}).get("bbox"),
        "detector_conf": float((det or {}).get("conf", 0.0)),
        "dailymed": {"setid": None, "sections": sections or {}},
    }
    return JSONResponse(out)
