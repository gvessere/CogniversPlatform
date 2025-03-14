import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import database
import routers.auth as auth
import routers.users as users
import routers.interactions as interactions
import routers.questionnaires as questionnaires
import routers.processors as processors
import routers.sessions as sessions
import routers.address as address
import json
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api")

# Environment configuration
ENV = os.getenv("ENV", "development")
DEBUG = ENV.lower() != "production"

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        if not DEBUG:
            # Skip detailed logging in production
            return await call_next(request)
        
        request_id = f"{time.time()}-{id(request)}"
        
        # Log request details
        client_host = request.client.host if request.client else "unknown"
        logger.info(f"[{request_id}] Request: {request.method} {request.url.path} from {client_host}")
        
        # Log headers (excluding sensitive ones)
        headers = dict(request.headers)
        if "authorization" in headers:
            headers["authorization"] = "Bearer [FILTERED]"
        if "cookie" in headers:
            headers["cookie"] = "[FILTERED]"
        logger.info(f"[{request_id}] Headers: {json.dumps(headers)}")
        
        # Log query parameters
        if request.query_params:
            logger.info(f"[{request_id}] Query params: {json.dumps(dict(request.query_params))}")
        
        # Try to log request body for specific content types
        if request.headers.get("content-type") == "application/json":
            try:
                body = await request.json()
                # Filter sensitive fields
                if isinstance(body, dict):
                    filtered_body = body.copy()
                    for sensitive_field in ["password", "token", "secret"]:
                        if sensitive_field in filtered_body:
                            filtered_body[sensitive_field] = "[FILTERED]"
                    logger.info(f"[{request_id}] Body: {json.dumps(filtered_body)}")
            except Exception as e:
                logger.info(f"[{request_id}] Could not parse request body: {str(e)}")
        
        # Process the request and catch any errors
        try:
            start_time = time.time()
            response = await call_next(request)
            process_time = time.time() - start_time
            
            # Log response details
            status_code = response.status_code
            logger.info(f"[{request_id}] Response: {status_code} (took {process_time:.4f}s)")
            
            # For error responses, try to log more details
            if status_code >= 400:
                # We need to read the response body without consuming it
                response_body = b""
                async for chunk in response.body_iterator:
                    response_body += chunk
                
                # Try to parse as JSON
                try:
                    body_str = response_body.decode("utf-8")
                    body_json = json.loads(body_str)
                    logger.info(f"[{request_id}] Error response: {json.dumps(body_json)}")
                except Exception:
                    # If not JSON, log as string (truncated if too long)
                    body_str = response_body.decode("utf-8", errors="replace")
                    if len(body_str) > 1000:
                        body_str = body_str[:1000] + "... [truncated]"
                    logger.info(f"[{request_id}] Error response body: {body_str}")
                
                # Create a new response with the same body
                from starlette.responses import Response
                return Response(
                    content=response_body,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type
                )
            
            return response
        except Exception as e:
            logger.exception(f"[{request_id}] Unhandled exception: {str(e)}")
            raise

app = FastAPI()

# Custom exception handlers to preserve original error messages
@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    Custom handler for HTTP exceptions to preserve the original error detail
    """
    logger.info(f"HTTP exception: {exc.status_code} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Custom handler for validation errors to provide more detailed error messages
    """
    logger.info(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()}
    )

# Add the request logging middleware if in debug mode
if DEBUG:
    app.add_middleware(RequestLoggingMiddleware)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup() -> None:
    await database.init_db()
    logger.info(f"Application started in {ENV} mode")
    if DEBUG:
        logger.info("Debug request logging is ENABLED")
    else:
        logger.info("Debug request logging is DISABLED")

    # Register routers
    app.include_router(users.router)
    app.include_router(auth.router)
    app.include_router(interactions.router)
    app.include_router(questionnaires.router)
    app.include_router(processors.router)
    app.include_router(sessions.router)
    app.include_router(address.router)