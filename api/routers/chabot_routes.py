from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path
from typing import List, Dict, Any
import numpy as np
import joblib

router = APIRouter()

ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "model"
MODEL_PATH = MODEL_DIR / "disease_model.pkl"
SYMPTOMS_PATH = MODEL_DIR / "symptom_features.pkl"

if not MODEL_PATH.exists() or not SYMPTOMS_PATH.exists():
    raise RuntimeError(
        f"Missing model files. Expected:\n- {MODEL_PATH}\n- {SYMPTOMS_PATH}"
    )

model = joblib.load(MODEL_PATH)
symptom_features: List[str] = joblib.load(SYMPTOMS_PATH)

#clean labels
def pretty_label(token: str) -> str:
    t = (token or "").strip().lower().replace("_", " ")
    return " ".join(
        w.upper() if (len(w) > 1 and w.isupper()) else w.capitalize()
        for w in t.split()
    )

@router.get("/symptoms")
def list_symptoms():
    items = [{"token": s, "label": pretty_label(s)} for s in symptom_features]
    items.sort(key=lambda x: x["label"])
    return {"symptoms": items}

class PredictRequest(BaseModel):
    symptoms: List[str]

class PredictResponse(BaseModel):
    top: List[Dict[str, Any]]
    low_confidence: bool
    message: str

@router.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if not hasattr(model, "predict_proba"):
        raise HTTPException(
            status_code=500,
            detail=(
                "Loaded model does not support probabilities. "
                "Use a probabilistic classifier (e.g., LogisticRegression)."
            ),
        )

    #selected symptoms
    x = np.zeros(len(symptom_features), dtype=int)
    selected = { (s or "").strip().lower() for s in req.symptoms }
    index_map = { s.lower(): i for i, s in enumerate(symptom_features) }

    matched = False
    for s in selected:
        i = index_map.get(s)
        if i is not None:
            x[i] = 1
            matched = True

    if not matched:
        return PredictResponse(
            top=[],
            low_confidence=True,
            message="No known symptoms were recognized. Please choose from /symptoms.",
        )

    X = x.reshape(1, -1)
    proba = model.predict_proba(X)[0]
    classes = list(model.classes_) 

    ranked = sorted(zip(classes, proba), key=lambda t: t[1], reverse=True)[:3]
    top = [{"label": c, "prob": float(p)} for c, p in ranked]

    maxp = float(top[0]["prob"]) if top else 0.0
    low = maxp < 0.45
    msg = (
        "I’m not confident in this result. Consider consulting a clinician."
        if low
        else "This is not a diagnosis. For urgent symptoms, seek medical care."
    )

    return PredictResponse(top=top, low_confidence=low, message=msg)
