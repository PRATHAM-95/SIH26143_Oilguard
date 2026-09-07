"""pytest configuration: expose the scientific-service package on sys.path."""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Ensure `from app...` imports resolve regardless of the invocation cwd.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Silence OpenDrift module-init log chatter under test.
import logging  # noqa: E402

for _n in list(logging.root.manager.loggerDict):
    if _n.startswith("opendrift"):
        logging.getLogger(_n).setLevel(logging.CRITICAL)
logging.getLogger("opendrift").setLevel(logging.CRITICAL)