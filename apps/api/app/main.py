import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db
from app.routers import health, meetings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Granola TR API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_origin_regex=settings.extension_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Chrome treats a chrome-extension:// page as a more "public" address space than
    # localhost, so it sends a Private Network Access preflight (Access-Control-Request-
    # Private-Network) before every request the extension makes to this local backend.
    # Without this, Starlette answers "Disallowed CORS private-network" and Chrome blocks
    # the request client-side — the browser's own frontend page never hits this because
    # localhost-to-localhost isn't a cross-address-space request in the first place.
    allow_private_network=True,
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc: Exception):
    logger.exception("Unhandled error")
    return JSONResponse(status_code=500, content={"detail": "Sunucuda beklenmeyen bir hata oluştu."})


app.include_router(health.router)
app.include_router(meetings.router)
