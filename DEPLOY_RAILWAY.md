# Railway + Vercel 배포 가이드

## 구성 개요

| 서비스 | 플랫폼 | 설명 |
|--------|--------|------|
| PostgreSQL | Railway | 데이터베이스 |
| Redis | Railway | WebSocket pub/sub |
| 백엔드 (FastAPI) | Railway | API 서버 |
| 프론트엔드 (React) | Vercel | 정적 사이트 |

---

## 사전 준비

1. [railway.app](https://railway.app) 계정 생성 (GitHub 계정으로 로그인 권장)
2. [vercel.com](https://vercel.com) 계정 생성 (GitHub 계정으로 로그인 권장)
3. 코드를 GitHub 레포지토리에 push

---

## 1단계: GitHub에 코드 올리기

```bash
cd company-messenger
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/<your-username>/company-messenger.git
git push -u origin main
```

---

## 2단계: Railway - PostgreSQL 추가

1. [railway.app](https://railway.app) 접속 → **New Project**
2. **Add a service** → **Database** → **PostgreSQL** 선택
3. 생성 후 PostgreSQL 서비스 클릭 → **Variables** 탭
4. `DATABASE_URL` 값 복사 (나중에 필요)
   - 형식: `postgresql://user:password@host:port/dbname`
   - **주의**: Railway가 주는 URL은 `postgresql://` 형식이므로 백엔드에서 `postgresql+asyncpg://` 로 변환 필요

---

## 3단계: Railway - Redis 추가

1. 같은 프로젝트에서 **Add a service** → **Database** → **Redis** 선택
2. 생성 후 Redis 서비스 클릭 → **Variables** 탭
3. `REDIS_URL` 값 복사 (나중에 필요)
   - 형식: `redis://default:password@host:port`

---

## 4단계: Railway - 백엔드 배포

1. 같은 프로젝트에서 **Add a service** → **GitHub Repo** 선택
2. `company-messenger` 레포 선택
3. **Root Directory** 설정: `backend`
   - Railway가 `backend/Dockerfile`을 자동 감지하여 빌드함 (별도 Start Command 불필요)
4. **Variables** 탭에서 아래 환경변수 추가:

```
DATABASE_URL=postgresql+asyncpg://user:password@host:port/dbname
REDIS_URL=redis://default:password@host:port
SECRET_KEY=여기에-랜덤-긴-문자열-입력
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
UPLOAD_DIR=/app/storage/uploads
MAX_UPLOAD_SIZE=52428800
CORS_ORIGINS=["https://your-vercel-app.vercel.app"]
```

> `DATABASE_URL`: 2단계에서 복사한 URL의 `postgresql://`을 `postgresql+asyncpg://`로 교체
> `SECRET_KEY`: 랜덤 문자열 생성 → 터미널에서 `python -c "import secrets; print(secrets.token_hex(32))"` 실행
> `CORS_ORIGINS`: Vercel 배포 후 실제 URL로 업데이트 필요

5. **Deploy** 클릭 후 배포 완료 대기
6. 배포 완료 후 **Settings** → **Networking** → **Generate Domain** 클릭
7. 생성된 도메인 복사 (예: `company-messenger-backend.up.railway.app`)

---

## 5단계: DB 마이그레이션 실행

백엔드 배포 후 Railway 쉘에서 마이그레이션 실행:

**방법 A - Railway 웹 콘솔 (권장)**
1. Railway 백엔드 서비스 클릭 → 우측 상단 **Deploy** 탭
2. 최신 배포 항목 클릭 → **View Logs** 옆 **...** → **Open Shell**
3. 쉘에서 실행:
```bash
alembic upgrade head
```

**방법 B - Railway CLI**
```bash
# Railway CLI 설치
npm install -g @railway/cli

# 로그인
railway login

# 프로젝트 연결
cd company-messenger/backend
railway link

# 마이그레이션 실행
railway run alembic upgrade head
```

---

## 6단계: Vercel - 프론트엔드 배포

1. [vercel.com](https://vercel.com) 접속 → **Add New Project**
2. GitHub 레포 `company-messenger` 선택
3. **Root Directory**: `frontend` 로 설정
4. **Environment Variables** 추가:

```
VITE_API_URL=https://company-messenger-backend.up.railway.app
VITE_WS_URL=wss://company-messenger-backend.up.railway.app
```

> 4단계에서 복사한 Railway 백엔드 도메인 사용
> WebSocket은 반드시 `wss://` (https 도메인이면 ws:// 안 됨)
> **이 환경변수를 설정하지 않으면 WebSocket이 Vercel 쪽으로 연결되어 동작하지 않음**

5. **Deploy** 클릭
6. 배포 완료 후 Vercel 도메인 복사 (예: `company-messenger.vercel.app`)

---

## 7단계: 백엔드 CORS 업데이트

Vercel 배포 후 실제 URL을 Railway 백엔드 환경변수에 반영:

1. Railway 백엔드 서비스 → **Variables** 탭
2. `CORS_ORIGINS` 수정:

```
CORS_ORIGINS=["https://company-messenger.vercel.app"]
```

3. 자동으로 재배포됨

---

## 배포 후 확인

| 항목 | URL |
|------|-----|
| API 헬스체크 | `https://<railway-domain>/health` |
| API 문서 | `https://<railway-domain>/docs` |
| 프론트엔드 | `https://<vercel-domain>` |

---

## 알아두어야 할 제약사항

**파일 업로드 (중요)**
Railway는 영구 볼륨을 기본 제공하지 않아 재배포 시 업로드 파일이 삭제됩니다.
- 테스트 목적이라면 그냥 진행해도 됨
- 실 운영 목적이라면 Cloudflare R2 또는 AWS S3 연동 필요 (백엔드에 boto3 이미 설치됨)

**WebSocket 스케일링**
현재 WebSocket 연결 정보가 서버 메모리에만 저장됩니다. Railway 무료 플랜은 단일 인스턴스라 문제없지만, 인스턴스를 2개 이상으로 늘리면 연결이 깨집니다.

---

## 문제 해결

**백엔드 시작 실패**
- Railway 서비스 → **Deployments** 탭 → 로그 확인
- `DATABASE_URL` 형식이 `postgresql+asyncpg://` 인지 확인

**WebSocket 연결 안 됨**
- Vercel 환경변수 `VITE_WS_URL`이 `wss://`로 시작하는지 확인
- Vercel에서 환경변수 변경 후 반드시 **Redeploy** 필요

**CORS 에러**
- `CORS_ORIGINS`에 Vercel 도메인이 정확히 입력되어 있는지 확인
- 끝에 `/` 슬래시 없이 입력

**마이그레이션 실패**
- `DATABASE_URL`이 올바른지 확인
- `alembic upgrade head` 재실행
