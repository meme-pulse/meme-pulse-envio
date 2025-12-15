## Meme Pulse Envio Indexer

_Please refer to the [documentation website](https://docs.envio.dev) for a thorough guide on all [Envio](https://envio.dev) indexer features_

### Pre-requisites

- [Node.js (use v18 or newer)](https://nodejs.org/en/download/current)
- [pnpm (use v8 or newer)](https://pnpm.io/installation)
- [Docker desktop](https://www.docker.com/products/docker-desktop/)

### Local Development

```bash
pnpm dev
```

Visit http://localhost:8080 to see the GraphQL Playground, local password is `testing`.

### Generate files from `config.yaml` or `schema.graphql`

```bash
pnpm codegen
```

### Docker Deployment

```bash
docker-compose up -d
```

---

## Railway Deployment Guide

Railway는 docker-compose를 직접 지원하지 않으므로, `docker-compose.yaml`의 3개 서비스를 개별적으로 배포해야 합니다.

### 배포 순서

1. **Postgres** (먼저 배포)
2. **graphql-engine** (Postgres 의존)
3. **Envio Indexer** (Postgres, graphql-engine 의존)

### 방법 1: Railway Dashboard를 통한 배포

#### 1. PostgreSQL 서비스

1. Railway 프로젝트에서 **New → Database → PostgreSQL** 선택
2. 서비스 이름: `Postgres` (또는 원하는 이름)
3. 자동 생성되는 환경변수 확인:
   - `PGHOST`
   - `PGPORT`
   - `PGUSER`
   - `PGPASSWORD`
   - `PGDATABASE`

#### 2. Hasura GraphQL Engine 서비스

1. **New → Docker Image** 선택
2. 서비스 이름: `graphql-engine` (또는 `Hasura`)
3. Docker Image: `hasura/graphql-engine:v2.43.0`
4. 환경변수 설정 (Variables 탭):

```bash
# PostgreSQL 연결 (Railway 변수 참조 사용)
HASURA_GRAPHQL_DATABASE_URL=postgres://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}

# Hasura 설정 (docker-compose.yaml과 동일)
HASURA_GRAPHQL_ENABLE_CONSOLE=true
HASURA_GRAPHQL_ENABLED_LOG_TYPES=startup, http-log, webhook-log, websocket-log, query-log
HASURA_GRAPHQL_NO_OF_RETRIES=10
HASURA_GRAPHQL_ADMIN_SECRET=your-secure-admin-secret-here
HASURA_GRAPHQL_STRINGIFY_NUMERIC_TYPES=true
PORT=8080
HASURA_GRAPHQL_UNAUTHORIZED_ROLE=public
```

5. 포트 노출: Settings → Networking → Generate Domain (포트 8080)

#### 3. Envio Indexer 서비스

1. **New → GitHub Repo** 선택 (또는 Docker Image)
2. 서비스 이름: `indexer` (또는 `envio-indexer`)
3. GitHub 저장소 연결 (또는 Dockerfile 사용)
4. 환경변수 설정 (Variables 탭):

```bash
ENVIO_PG_HOST="${{Postgres.PGHOST}}"
ENVIO_PG_PORT="${{Postgres.PGPORT}}"
ENVIO_PG_USER="${{Postgres.PGUSER}}"
ENVIO_PG_PASSWORD="${{Postgres.PGPASSWORD}}"
ENVIO_PG_DATABASE="${{Postgres.PGDATABASE}}"
ENVIO_PG_PUBLIC_SCHEMA="envio"
ENVIO_INDEXER_HOST="0.0.0.0"
ENVIO_INDEXER_PORT="9898"
CONFIG_FILE="config.yaml"
LOG_LEVEL="trace"
LOG_STRATEGY="console-pretty"
HASURA_GRAPHQL_ENDPOINT="${{graphql-engine.RAILWAY_PRIVATE_DOMAIN}}/v1/metadata"
HASURA_GRAPHQL_ADMIN_SECRET="your-secure-admin-secret-here"
HASURA_SERVICE_HOST="${{graphql-engine.RAILWAY_PRIVATE_DOMAIN}}"
HASURA_SERVICE_PORT="8080"
TUI_OFF="true"
ENVIO_API_TOKEN="ddaf346b-227a-417b-abaf-f066693ace26"
```

5. 리소스 제한 (선택사항): Settings → Resources
   - CPU: 0.8
   - Memory: 800M

### 방법 2: Railway CLI 스크립트 사용 (권장)

자동화된 배포 스크립트를 사용하면 PostgreSQL부터 모든 서비스를 자동으로 배포합니다:

```bash
# Railway CLI 설치
npm install -g @railway/cli

# Railway 로그인
railway login

# 옵션 1: PostgreSQL 자동 배포 (권장)
export HASURA_ADMIN_SECRET="your-secure-secret"
./scripts/deploy-railway.sh

# 옵션 2: 기존 PostgreSQL 사용
export DATABASE_URL="postgres://user:pass@host:5432/dbname"
export HASURA_ADMIN_SECRET="your-secure-secret"
./scripts/deploy-railway.sh
```

**스크립트가 자동으로 수행하는 작업:**

1. ✅ Postgres 데이터베이스 배포 (없는 경우)
2. ✅ graphql-engine 서비스 생성 및 환경변수 설정
3. ✅ Envio Indexer 서비스 생성 및 환경변수 설정
4. ✅ 서비스 간 연결 설정 (Railway 변수 참조 사용)

**주의사항:**

- Postgres가 이미 존재하는 경우 기존 서비스를 사용합니다
- `DATABASE_URL`을 제공하면 Postgres 배포를 건너뜁니다
- graphql-engine Docker 이미지는 Railway 대시보드에서 수동으로 설정해야 합니다: `hasura/graphql-engine:v2.43.0`

### Railway 환경변수 참조 문법

Railway에서는 `${{ServiceName.VARIABLE_NAME}}` 형식으로 다른 서비스의 환경변수를 참조할 수 있습니다:

- `${{Postgres.PGHOST}}` - PostgreSQL 호스트
- `${{Postgres.PGPASSWORD}}` - PostgreSQL 비밀번호
- `${{graphql-engine.RAILWAY_PRIVATE_DOMAIN}}` - Hasura 내부 도메인 (서비스 간 통신용)
- `${{graphql-engine.RAILWAY_PUBLIC_DOMAIN}}` - Hasura 공개 도메인 (외부 접근용)

### 확인 사항

1. ✅ Postgres가 먼저 배포되어 실행 중인지 확인
2. ✅ graphql-engine이 Postgres에 연결되었는지 확인 (로그 확인)
3. ✅ Indexer가 graphql-engine에 연결되었는지 확인 (로그 확인)
4. ✅ Hasura Console 접근: `https://your-graphql-engine-service.railway.app` (포트 8080)

### 주의사항

- ⚠️ `HASURA_GRAPHQL_ADMIN_SECRET`는 프로덕션에서 강력한 비밀번호로 설정하세요
- ⚠️ Railway의 내부 네트워크에서는 `RAILWAY_PRIVATE_DOMAIN` 사용
- ⚠️ 외부 접근이 필요한 경우 포트를 노출해야 합니다
- ⚠️ 서비스 이름은 대소문자를 구분하므로 일관되게 사용하세요 (`Postgres`, `graphql-engine`)
