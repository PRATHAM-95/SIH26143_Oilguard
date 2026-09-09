"""Gunicorn configuration for production scientific-service.

Run with:
    python -m gunicorn -c gunicorn.conf.py app.main:app

Production server (gunicorn + UvicornWorker) is NOT used for ``npm run dev``
which keeps a single uvicorn process for fast auto-reload; use gunicorn when
you want to serve behind a reverse proxy or run at scale.
"""

from __future__ import annotations

import multiprocessing
import os

# --- Bind ---
BIND = os.getenv("GUNICORN_BIND", "0.0.0.0:8000")

# --- Workers ---
WORKERS = int(os.getenv("GUNICORN_WORKERS", min(4, multiprocessing.cpu_count())))
WORKER_CLASS = "uvicorn.workers.UvicornWorker"
WORKER_CONNECTIONS = int(os.getenv("GUNICORN_WORKER_CONNECTIONS", "200"))

# --- Timeouts ---
# Science simulations can run for up to 10 minutes (2000 particles, 24 h).
TIMEOUT = int(os.getenv("GUNICORN_TIMEOUT", "600"))
GRACEFUL_TIMEOUT = int(os.getenv("GUNICORN_GRACEFUL_TIMEOUT", "600"))
KEEPALIVE = int(os.getenv("GUNICORN_KEEPALIVE", "60"))

# --- Recycling ---
# Recycle workers after N requests to mitigate memory leaks.
MAX_REQUESTS = int(os.getenv("GUNICORN_MAX_REQUESTS", "200"))
MAX_REQUESTS_JITTER = int(os.getenv("GUNICORN_MAX_REQUESTS_JITTER", "20"))

# --- Server mechanics ---
PRELOAD_APP = True

# --- Logging ---
ACCESSLOG = os.getenv("GUNICORN_ACCESSLOG", "-")
ERRORLOG = os.getenv("GUNICORN_ERRORLOG", "-")
LOGLEVEL = os.getenv("GUNICORN_LOG_LEVEL", "info").lower()
ACCESS_LOG_FORMAT = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)sμs'
