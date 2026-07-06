from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, class_allocations, classes, contracts, events, memberships, organizations
from app.config import settings

app = FastAPI(title="Dog Agility Judge Portal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(organizations.router, prefix="/api/v1")
app.include_router(memberships.router, prefix="/api/v1")
app.include_router(events.router, prefix="/api/v1")
app.include_router(classes.router, prefix="/api/v1")
app.include_router(contracts.router, prefix="/api/v1")
app.include_router(class_allocations.router, prefix="/api/v1")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
