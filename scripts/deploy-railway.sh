#!/bin/bash
set -e

# =============================================================================
# Meme Pulse Envio - Railway Deploy Script
# =============================================================================
# Prerequisites:
#   - Railway CLI installed: npm install -g @railway/cli
#   - Logged in: railway login
#   - PostgreSQL already deployed on Railway
#
# Usage:
#   export DATABASE_URL="postgres://user:pass@host:5432/dbname"
#   export HASURA_ADMIN_SECRET="your-secret-key"
#   ./scripts/deploy-railway.sh
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# Validate required environment variables
# =============================================================================
validate_env() {
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL is required"
        log_info "Example: export DATABASE_URL=\"postgres://user:pass@host:5432/dbname\""
        exit 1
    fi

    if [ -z "$HASURA_ADMIN_SECRET" ]; then
        log_warn "HASURA_ADMIN_SECRET not set, using default 'testing'"
        export HASURA_ADMIN_SECRET="testing"
    fi
}

# =============================================================================
# Parse DATABASE_URL into individual components
# Format: postgres://user:password@host:port/database
# =============================================================================
parse_database_url() {
    log_info "Parsing DATABASE_URL..."
    
    # Remove postgres:// prefix
    local url="${DATABASE_URL#postgres://}"
    url="${url#postgresql://}"
    
    # Extract user:password
    local userpass="${url%%@*}"
    export ENVIO_PG_USER="${userpass%%:*}"
    export ENVIO_PG_PASSWORD="${userpass#*:}"
    
    # Extract host:port/database
    local hostportdb="${url#*@}"
    local hostport="${hostportdb%%/*}"
    export ENVIO_PG_DATABASE="${hostportdb#*/}"
    
    # Extract host and port
    if [[ "$hostport" == *":"* ]]; then
        export ENVIO_PG_HOST="${hostport%%:*}"
        export ENVIO_PG_PORT="${hostport#*:}"
    else
        export ENVIO_PG_HOST="$hostport"
        export ENVIO_PG_PORT="5432"
    fi
    
    log_success "Parsed: host=$ENVIO_PG_HOST, port=$ENVIO_PG_PORT, user=$ENVIO_PG_USER, db=$ENVIO_PG_DATABASE"
}

# =============================================================================
# Check Railway CLI
# =============================================================================
check_railway_cli() {
    if ! command -v railway &> /dev/null; then
        log_error "Railway CLI not found. Install with: npm install -g @railway/cli"
        exit 1
    fi
    log_success "Railway CLI found"
}

# =============================================================================
# Initialize or link Railway project
# =============================================================================
init_railway_project() {
    log_info "Linking to Railway project..."
    
    # Link to existing project (cooperative-charisma)
    # If RAILWAY_PROJECT is set, use it; otherwise use default
    local PROJECT_NAME="${RAILWAY_PROJECT:-cooperative-charisma}"
    
    if railway status &> /dev/null; then
        log_success "Already linked to Railway project"
    else
        log_info "Linking to existing project: $PROJECT_NAME"
        railway link -p "$PROJECT_NAME" || {
            log_error "Failed to link to project. Make sure you're logged in: railway login"
            exit 1
        }
    fi
}

# =============================================================================
# Deploy Hasura GraphQL Engine
# =============================================================================
deploy_hasura() {
    log_info "Deploying Hasura GraphQL Engine..."
    
    # Create Hasura service (empty service first)
    log_info "Creating Hasura service..."
    railway add --service hasura 2>/dev/null || log_warn "Hasura service may already exist"
    
    # Link to hasura service
    log_info "Linking to Hasura service..."
    railway link --service hasura 2>/dev/null || true
    
    # Set environment variables for Hasura (Railway CLI v3 syntax)
    log_info "Setting Hasura environment variables..."
    railway variables \
        --set "HASURA_GRAPHQL_DATABASE_URL=$DATABASE_URL" \
        --set "HASURA_GRAPHQL_ENABLE_CONSOLE=true" \
        --set "HASURA_GRAPHQL_ENABLED_LOG_TYPES=startup, http-log, webhook-log, websocket-log, query-log" \
        --set "HASURA_GRAPHQL_NO_OF_RETRIES=10" \
        --set "HASURA_GRAPHQL_ADMIN_SECRET=$HASURA_ADMIN_SECRET" \
        --set "HASURA_GRAPHQL_STRINGIFY_NUMERIC_TYPES=true" \
        --set "HASURA_GRAPHQL_UNAUTHORIZED_ROLE=public" \
        --set "PORT=8080"
    
    log_success "Hasura environment variables set"
    log_warn "Please set Docker image to 'hasura/graphql-engine:v2.43.0' in Railway dashboard for hasura service"
}

# =============================================================================
# Deploy Envio Indexer
# =============================================================================
deploy_indexer() {
    log_info "Deploying Envio Indexer..."
    
    # Create Indexer service (empty service first)
    log_info "Creating Indexer service..."
    railway add --service indexer 2>/dev/null || log_warn "Indexer service may already exist"
    
    # Link to indexer service
    log_info "Linking to Indexer service..."
    railway link --service indexer 2>/dev/null || true
    
    # Get Hasura internal URL (will need to be updated after Hasura deploys)
    local HASURA_INTERNAL_HOST="\${{hasura.RAILWAY_PRIVATE_DOMAIN}}"
    
    # Set environment variables for Indexer (Railway CLI v3 syntax)
    log_info "Setting Indexer environment variables..."
    railway variables \
        --set "ENVIO_PG_HOST=$ENVIO_PG_HOST" \
        --set "ENVIO_PG_PORT=$ENVIO_PG_PORT" \
        --set "ENVIO_PG_USER=$ENVIO_PG_USER" \
        --set "ENVIO_PG_PASSWORD=$ENVIO_PG_PASSWORD" \
        --set "ENVIO_PG_DATABASE=$ENVIO_PG_DATABASE" \
        --set "ENVIO_PG_PUBLIC_SCHEMA=envio" \
        --set "ENVIO_INDEXER_HOST=0.0.0.0" \
        --set "ENVIO_INDEXER_PORT=9898" \
        --set "CONFIG_FILE=config.yaml" \
        --set "LOG_LEVEL=trace" \
        --set "LOG_STRATEGY=console-pretty" \
        --set "HASURA_GRAPHQL_ENDPOINT=http://${HASURA_INTERNAL_HOST}:8080/v1/metadata" \
        --set "HASURA_GRAPHQL_ADMIN_SECRET=$HASURA_ADMIN_SECRET" \
        --set "HASURA_SERVICE_HOST=$HASURA_INTERNAL_HOST" \
        --set "HASURA_SERVICE_PORT=8080" \
        --set "TUI_OFF=true"
    
    log_success "Indexer environment variables set"
    
    # Deploy from current directory
    log_info "Deploying Indexer from Dockerfile..."
    railway up
    
    log_success "Indexer deployed"
}

# =============================================================================
# Main
# =============================================================================
main() {
    echo ""
    echo "=========================================="
    echo "  Meme Pulse Envio - Railway Deployment  "
    echo "=========================================="
    echo ""
    
    check_railway_cli
    validate_env
    parse_database_url
    init_railway_project
    
    echo ""
    log_info "Starting deployment..."
    echo ""
    
    deploy_hasura
    echo ""
    deploy_indexer
    
    echo ""
    echo "=========================================="
    log_success "Deployment completed!"
    echo "=========================================="
    echo ""
    log_info "Next steps:"
    echo "  1. Go to Railway dashboard"
    echo "  2. Set Hasura service Docker image to: hasura/graphql-engine:v2.43.0"
    echo "  3. Update HASURA_GRAPHQL_ENDPOINT in indexer with actual Hasura domain"
    echo "  4. Expose ports if needed (Hasura: 8080, Indexer: 9898)"
    echo ""
    log_info "Check status: railway status"
    log_info "View logs: railway logs --service indexer"
    echo ""
}

main "$@"

