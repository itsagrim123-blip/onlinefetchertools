from __future__ import annotations

import ipaddress
import re
from urllib.parse import parse_qs, urlparse, urlunparse


def validate_url(raw_url: str) -> str:
    if not raw_url or not isinstance(raw_url, str):
        raise ValueError("Invalid URL")

    value = raw_url.strip()
    if len(value) < 8:
        raise ValueError("Invalid URL")

    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Unsupported URL")
    if not parsed.netloc:
        raise ValueError("Invalid URL")

    hostname = parsed.hostname or ""
    if not hostname:
        raise ValueError("Invalid URL")

    hostname = hostname.lower()
    if hostname in {"localhost", "0.0.0.0", "::1"} or hostname.endswith(".localhost"):
        raise ValueError("Unsupported URL")

    try:
        ip = ipaddress.ip_address(hostname)
    except ValueError:
        ip = None
    if ip and (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved):
        raise ValueError("Unsupported URL")

    if re.search(r"(?:^|\.)localhost($|\.)", hostname):
        raise ValueError("Unsupported URL")

    if not re.match(r"^[A-Za-z0-9.-]+(\.[A-Za-z0-9.-]+)+(:\d+)?(/.*)?$", parsed.netloc):
        raise ValueError("Invalid URL")

    return normalize_youtube_url(value)


def normalize_youtube_url(value: str) -> str:
    parsed = urlparse(value)
    hostname = (parsed.hostname or "").lower()
    if hostname in {"youtube.com", "www.youtube.com", "m.youtube.com"}:
        video_id = parse_qs(parsed.query).get("v", [None])[0]
        if parsed.path.startswith("/shorts/"):
            video_id = parsed.path.split("/", 2)[2].split("/", 1)[0]
        if video_id:
            return f"https://www.youtube.com/watch?v={video_id}"
    if hostname in {"youtu.be", "www.youtu.be"}:
        video_id = parsed.path.strip("/").split("/", 1)[0]
        if video_id:
            return f"https://www.youtube.com/watch?v={video_id}"
    return value


WINDOWS_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}


def sanitize_filename(name: str | None, fallback: str = "download") -> str:
    original = (name or fallback).strip()
    if not original:
        original = fallback

    path_traversal_count = len(re.findall(r"(?:^|[\\/])\.\.(?:[\\/]|$)", original))
    base = re.sub(r"^(?:[.]{1,2}[\\/])+", "", original)
    base = base.replace("/", "_").replace("\\", "_")
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", base)
    base = re.sub(r"_+", "_", base)

    if "." in base:
        stem, ext = base.rsplit(".", 1)
        stem = stem.strip(".")
        if path_traversal_count <= 1:
            stem = stem.rstrip("_")
        if not stem:
            stem = fallback
        if stem.upper() in WINDOWS_RESERVED_NAMES:
            stem = f"file_{stem}"
        ext = ext.strip("._")
        if not ext:
            return stem.strip("._") or fallback
        return f"{stem}.{ext}"

    cleaned = base.strip("._") or fallback
    if path_traversal_count <= 1:
        cleaned = cleaned.rstrip("_")
    if cleaned.upper() in WINDOWS_RESERVED_NAMES:
        cleaned = f"file_{cleaned}"
    return cleaned
