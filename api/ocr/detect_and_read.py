from ultralytics import YOLO
import cv2, numpy as np
import easyocr, json, sys, os

MODEL_PATH = r"./ocr/weights/best.pt"
model = YOLO(MODEL_PATH)
reader = easyocr.Reader(['en'], gpu=False)

def read_brand_from_image(path):
    im = cv2.imread(path)
    if im is None:
        return {"brand":"", "conf":0.0, "note":"image not found", "path": path}

    res = model.predict(source=im, imgsz=960, conf=0.25, verbose=False)
    if not res or len(res[0].boxes) == 0:
        return {"brand":"", "conf":0.0, "note":"no brand bbox", "path": path}

    boxes = res[0].boxes
    i = int(boxes.conf.argmax().item())
    x1,y1,x2,y2 = boxes.xyxy[i].cpu().numpy().astype(int)
    conf = float(boxes.conf[i].item())

    h,w = im.shape[:2]
    x1,y1 = max(0,x1), max(0,y1)
    x2,y2 = min(w-1,x2), min(h-1,y2)
    crop = im[y1:y2, x1:x2]

    # light, grayscale
    g = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    g = cv2.medianBlur(g, 3)
    text = " ".join(reader.readtext(g, detail=0)).strip()


    return {"brand": text, "conf": conf, "bbox":[int(x1),int(y1),int(x2),int(y2)], "path": path}

if __name__ == "__main__":
    path = sys.argv[1]
    print(json.dumps(read_brand_from_image(path), ensure_ascii=False, indent=2))
