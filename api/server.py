from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.chabot_routes import router as chatbot_router
from routers.ocr_routes import router as ocr_router


app = FastAPI(title="iCare API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chatbot_router, tags=["chatbot"])
app.include_router(ocr_router,     prefix="/ocr",     tags=["ocr"])

