from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    # DB
    DATABASE_URL: str = "postgresql+asyncpg://messenger:messenger_pass@localhost:5432/messenger_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # JWT
    SECRET_KEY: str = "change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # 파일 업로드
    UPLOAD_DIR: str = "./storage/uploads"
    MAX_UPLOAD_SIZE: int = 52428800  # 50MB

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:80"]

    # 썸네일
    THUMBNAIL_WIDTH: int = 320
    THUMBNAIL_HEIGHT: int = 240

    class Config:
        env_file = ".env"

        @classmethod
        def parse_env_var(cls, field_name: str, raw_val: str):
            if field_name == "CORS_ORIGINS":
                try:
                    return json.loads(raw_val)
                except Exception:
                    return [raw_val]
            return raw_val


settings = Settings()
