from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.dashboard import router as dashboard_router
from app.api.apartments import router as apartments_router
from app.api.auth import router as auth_router
from app.api.razorpay_payments import router as razorpay_router
from app.api.maintenance_rollover import router as maintenance_rollover_router


app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True, "name": settings.app_name, "env": settings.app_env}


app.include_router(dashboard_router)
app.include_router(apartments_router)
app.include_router(auth_router)
app.include_router(razorpay_router)
app.include_router(maintenance_rollover_router)

