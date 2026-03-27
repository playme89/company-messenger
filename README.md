# Company Messenger

사내 메신저 + 일정표 웹 애플리케이션

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS + Vite |
| Backend | FastAPI (Python) + Uvicorn |
| DB | PostgreSQL 16 |
| 캐시/실시간 | Redis 7 |
| 파일 저장 | 로컬 파일시스템 |
| 인증 | JWT Access Token (15분) + Refresh Token (7일) |
| 실시간 | WebSocket + Redis Pub/Sub |
| 배포 | Docker Compose + Nginx |

## 주요 기능

- **일정표 (간트 차트)** — 사람별 작업기간/작업내용, 드래그로 날짜 변경, 부서별 그룹핑
- **채팅 (Slack 스타일)** — 채널(공개/비공개), DM, 쓰레드 답글, 이모지 반응
- **파일 공유** — 드래그앤드롭 업로드, 이미지 인라인 미리보기
- **메시지 검색** — 채널 내/전체 메시지 검색
- **온/오프라인 상태** — 실시간 접속 상태 표시

## 빠른 시작

### 사전 요구사항
- Docker & Docker Compose 설치

### 실행

```bash
# 1. 프로젝트 폴더로 이동
cd company-messenger

# 2. 환경변수 설정 (선택, 기본값으로도 실행 가능)
cp backend/.env.example backend/.env

# 3. Docker Compose 실행
docker compose up -d

# 4. DB 마이그레이션
docker compose exec backend alembic upgrade head

# 5. 브라우저에서 접속
# http://localhost
```

### 개발 모드 (로컬)

**백엔드:**
```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --port 8000
```

**프론트엔드:**
```bash
cd frontend
npm install
npm run dev
```

## 프로젝트 구조

```
company-messenger/
├── backend/               # FastAPI 백엔드
│   ├── app/
│   │   ├── core/          # 설정, DB, Redis, 보안, 의존성
│   │   ├── models/        # SQLAlchemy ORM 모델
│   │   ├── schemas/       # Pydantic 스키마
│   │   ├── routers/       # API 엔드포인트
│   │   ├── services/      # 비즈니스 로직
│   │   └── websocket/     # WebSocket 관리
│   ├── alembic/           # DB 마이그레이션
│   └── storage/           # 업로드 파일
├── frontend/              # React 프론트엔드
│   └── src/
│       ├── api/           # API 호출 함수
│       ├── components/    # UI 컴포넌트
│       ├── hooks/         # Custom Hooks
│       ├── pages/         # 페이지 컴포넌트
│       ├── stores/        # Zustand 전역 상태
│       └── types/         # TypeScript 타입
└── nginx/                 # Nginx 설정
```

## API 문서

서버 실행 후 http://localhost:8000/docs 에서 Swagger UI를 통해 API 문서를 확인할 수 있습니다.

## 환경변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| SECRET_KEY | change-this-in-production | JWT 서명 키 (운영 시 반드시 변경) |
| DATABASE_URL | postgresql+asyncpg://... | PostgreSQL 연결 URL |
| REDIS_URL | redis://redis:6379 | Redis 연결 URL |
| MAX_UPLOAD_SIZE | 52428800 (50MB) | 최대 업로드 파일 크기 |
