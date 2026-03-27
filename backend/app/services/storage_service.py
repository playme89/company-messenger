import os
import uuid
import aiofiles
from datetime import datetime
from pathlib import Path
from PIL import Image
import io

from app.core.config import settings

ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain", "text/csv",
    "application/zip", "application/x-zip-compressed",
}

IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}


def get_upload_path() -> str:
    now = datetime.now()
    path = os.path.join(settings.UPLOAD_DIR, str(now.year), f"{now.month:02d}")
    os.makedirs(path, exist_ok=True)
    return path


async def save_file(content: bytes, original_filename: str, mime_type: str) -> tuple[str, str | None]:
    """파일 저장 후 (storage_path, thumbnail_path) 반환"""
    if mime_type not in ALLOWED_MIME_TYPES:
        raise ValueError(f"허용되지 않는 파일 형식: {mime_type}")

    ext = Path(original_filename).suffix.lower()
    file_id = str(uuid.uuid4())
    upload_path = get_upload_path()

    file_path = os.path.join(upload_path, f"{file_id}{ext}")
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    # 상대 경로로 변환 (UPLOAD_DIR 기준)
    rel_path = os.path.relpath(file_path, settings.UPLOAD_DIR)
    storage_path = rel_path.replace("\\", "/")

    thumbnail_path = None
    if mime_type in IMAGE_MIME_TYPES:
        thumbnail_path = await create_thumbnail(content, file_id, upload_path, ext)

    return storage_path, thumbnail_path


async def create_thumbnail(content: bytes, file_id: str, upload_path: str, ext: str) -> str | None:
    try:
        img = Image.open(io.BytesIO(content))
        img.thumbnail((settings.THUMBNAIL_WIDTH, settings.THUMBNAIL_HEIGHT))
        thumb_path = os.path.join(upload_path, f"{file_id}_thumb{ext}")
        img.save(thumb_path)
        rel_path = os.path.relpath(thumb_path, settings.UPLOAD_DIR)
        return rel_path.replace("\\", "/")
    except Exception:
        return None


def get_file_url(storage_path: str) -> str:
    return f"/uploads/{storage_path}"
