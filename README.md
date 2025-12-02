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

Railway에서는 3개의 서비스를 개별적으로 배포해야 합니다.

### 1. PostgreSQL 서비스

1. Railway 프로젝트에서 **Add New Service** → **Database** → **PostgreSQL** 선택
2. 생성된 PostgreSQL의 환경변수 확인:
   - `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

### 2. Hasura GraphQL Engine 서비스

1. **Add New Service** → **Docker Image** 선택
2. 이미지: `hasura/graphql-engine:v2.43.0`
3. 환경변수 설정:

```
HASURA_GRAPHQL_DATABASE_URL=postgres://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}
HASURA_GRAPHQL_ENABLE_CONSOLE=true
HASURA_GRAPHQL_ADMIN_SECRET=<your-admin-secret>
HASURA_GRAPHQL_STRINGIFY_NUMERIC_TYPES=true
HASURA_GRAPHQL_UNAUTHORIZED_ROLE=public
PORT=8080
```

### 3. Envio Indexer 서비스

1. **Add New Service** → **GitHub Repo** 선택 (또는 Docker Image)
2. 환경변수 설정:

```
ENVIO_PG_HOST=<postgres-host>
ENVIO_PG_PORT=5432
ENVIO_PG_USER=<postgres-user>
ENVIO_PG_PASSWORD=<postgres-password>
ENVIO_PG_DATABASE=<postgres-database>
ENVIO_PG_PUBLIC_SCHEMA=envio
ENVIO_INDEXER_HOST=0.0.0.0
ENVIO_INDEXER_PORT=9898
CONFIG_FILE=config.yaml
LOG_LEVEL=trace
LOG_STRATEGY=console-pretty
HASURA_GRAPHQL_ENDPOINT=http://<hasura-service>:8080/v1/metadata
HASURA_GRAPHQL_ADMIN_SECRET=<your-admin-secret>
HASURA_SERVICE_HOST=<hasura-service>
HASURA_SERVICE_PORT=8080
TUI_OFF=true
```

### Railway 환경변수 참조

Railway에서는 `${{PostgreSQL.PGHOST}}` 형식으로 다른 서비스의 환경변수를 참조할 수 있습니다.

예시:

```
ENVIO_PG_HOST=${{PostgreSQL.PGHOST}}
ENVIO_PG_PASSWORD=${{PostgreSQL.PGPASSWORD}}
HASURA_GRAPHQL_ENDPOINT=http://${{Hasura.RAILWAY_PRIVATE_DOMAIN}}:8080/v1/metadata
```
