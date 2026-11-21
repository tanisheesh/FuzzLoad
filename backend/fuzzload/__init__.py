"""FuzzLoad Python SDK public package export.

Usage:
    from fuzzload import FuzzLoadRouter, UpstreamTarget
"""

from app.cli import FuzzLoadRouter, UpstreamTarget

__all__ = ["FuzzLoadRouter", "UpstreamTarget"]
__version__ = "1.0.0"
