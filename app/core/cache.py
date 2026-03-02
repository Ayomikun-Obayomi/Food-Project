"""
Cache layer — uses an in-memory dict when Redis is unavailable.
"""
import json
import time
from typing import Any, Optional

_memory_cache: dict[str, tuple[Any, float]] = {}


async def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    _memory_cache[key] = (value, time.time() + ttl)


async def cache_get(key: str) -> Optional[Any]:
    entry = _memory_cache.get(key)
    if entry is None:
        return None
    value, expires_at = entry
    if time.time() > expires_at:
        del _memory_cache[key]
        return None
    return value


async def cache_delete(key: str) -> None:
    _memory_cache.pop(key, None)
