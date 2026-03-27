from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.message import MessageFile
from app.services.storage_service import save_file, get_file_url

router = APIRouter()


@router.post("/file")
async def upload_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = await file.read()

    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail=f"파일 크기는 {settings.MAX_UPLOAD_SIZE // 1024 // 1024}MB를 초과할 수 없습니다")

    mime_type = file.content_type or "application/octet-stream"

    try:
        storage_path, thumbnail_path = await save_file(content, file.filename or "file", mime_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 임시 파일 레코드 생성 (message_id는 나중에 연결)
    file_record = MessageFile(
        message_id="",  # 메시지 전송 시 연결
        user_id=current_user.id,
        file_name=file.filename or "file",
        file_size=len(content),
        mime_type=mime_type,
        storage_path=storage_path,
        thumbnail_path=thumbnail_path,
    )
    db.add(file_record)
    await db.commit()
    await db.refresh(file_record)

    return {
        "file_id": file_record.id,
        "file_name": file_record.file_name,
        "file_size": file_record.file_size,
        "mime_type": file_record.mime_type,
        "url": get_file_url(storage_path),
        "thumbnail_url": get_file_url(thumbnail_path) if thumbnail_path else None,
    }
