#!/bin/bash
set -e

# =============================================================================
# Meme Pulse Envio - Railway Deploy Script
# =============================================================================
# Prerequisites:
#   - Railway CLI installed: npm install -g @railway/cli
#   - Logged in: railway login
#
# Usage:
#   # Option 1: Auto-deploy PostgreSQL (recommended)
#   export HASURA_ADMIN_SECRET="your-secret-key"
#   ./scripts/deploy-railway.sh
#
#   # Option 2: Use existing PostgreSQL
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
# Log all Railway services (names) in the linked project
# =============================================================================
log_all_services() {
    log_info "Listing all Railway services in this project..."

    local all_services
    all_services="$(railway service list 2>/dev/null || echo "")"

    if [ -z "$all_services" ]; then
        log_warn "Could not retrieve service list via Railway CLI"
        return 0
    fi

    echo "$all_services" | while IFS= read -r line; do
        [ -n "$line" ] && log_info "  $line"
    done
}

# =============================================================================
# Validate required environment variables
# =============================================================================
validate_env() {
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
# Find all PostgreSQL services
# =============================================================================
find_postgres_services() {
    log_info "Searching for PostgreSQL services..." >&2
    
    local services=()
    local seen_services=""
    
    # Get all services from Railway
    local all_services
    all_services="$(railway service list 2>/dev/null || railway status 2>/dev/null || echo "")"
    
    if [ -n "$all_services" ]; then
        # Parse service list - try different formats
        while IFS= read -r line; do
            if [ -n "$line" ] && ! echo "$line" | grep -qiE "(NAME|SERVICE|---)"; then
                # Try to extract service name (could be first column or word)
                local svc_name=$(echo "$line" | awk '{print $1}' | tr -d ' ' | head -1)
                
                # Alternative: extract from different positions
                if [ -z "$svc_name" ] || [ "$svc_name" == "" ]; then
                    svc_name=$(echo "$line" | awk '{print $NF}' | tr -d ' ')
                fi
                
                # Log all extracted service names
                if [ -n "$svc_name" ]; then
                    log_info "  Checking service: $svc_name" >&2
                    
                    # Check if already seen
                    if echo "$seen_services" | grep -q "^$svc_name$"; then
                        continue
                    fi
                    
                    # Check if it's actually a PostgreSQL service by checking variables
                    local vars_output=$(railway variables --service "$svc_name" 2>/dev/null)
                    local exit_code=$?
                    if [ $exit_code -eq 0 ] && [ -n "$vars_output" ]; then
                        # Check if it has PostgreSQL-related variables
                        if echo "$vars_output" | grep -qiE "(DATABASE_URL|PGHOST|PGPORT|PGUSER|PGPASSWORD|PGDATABASE|POSTGRES)"; then
                            # Double check it's not an error message
                            if ! echo "$vars_output" | grep -qiE "(error|not found|failed|invalid)"; then
                                services+=("$svc_name")
                                seen_services="${seen_services}${seen_services:+$'\n'}$svc_name"
                            fi
                        fi
                    fi
                fi
            fi
        done <<< "$all_services"
    fi
    
    # Also check common exact service names as fallback
    log_info "Checking common PostgreSQL service names..." >&2
    for svc_name in "PostgreSQL" "postgres" "postgresql" "Postgres"; do
        # Check if already found
        if echo "$seen_services" | grep -q "^$svc_name$"; then
            continue
        fi
        
        local vars_output=$(railway variables --service "$svc_name" 2>/dev/null)
        local exit_code=$?
        if [ $exit_code -eq 0 ] && [ -n "$vars_output" ]; then
            # Check if it has PostgreSQL-related variables
            if echo "$vars_output" | grep -qiE "(DATABASE_URL|PGHOST|PGPORT|PGUSER|PGPASSWORD|PGDATABASE|POSTGRES)"; then
                # Double check it's not an error message
                if ! echo "$vars_output" | grep -qiE "(error|not found|failed|invalid)"; then
                    services+=("$svc_name")
                    seen_services="${seen_services}${seen_services:+$'\n'}$svc_name"
                fi
            fi
        fi
    done
    
    # Return unique services (one per line) - only valid service names
    if [ ${#services[@]} -gt 0 ]; then
        for svc in "${services[@]}"; do
            # Only output valid service names (not log messages)
            if [[ "$svc" =~ ^[a-zA-Z0-9_-]+$ ]] && [[ ! "$svc" =~ ^\[.*\] ]]; then
                echo "$svc"
            fi
        done | sort -u
    fi
}

# =============================================================================
# Get DATABASE_URL from a PostgreSQL service
# =============================================================================
get_database_url_from_service() {
    local svc_name="$1"
    log_info "Retrieving DATABASE_URL from service: $svc_name" >&2
    
    local vars_output=$(railway variables --service "$svc_name" 2>/dev/null)
    if [ $? -eq 0 ]; then
        # Try to get DATABASE_URL
        local db_url=$(echo "$vars_output" | grep -i "DATABASE_URL" | head -1 | awk -F'=' '{print $2}' | tr -d ' ' | sed 's/"//g')
        
        if [ -z "$db_url" ]; then
            # Try to construct from individual PG variables
            local pghost=$(echo "$vars_output" | grep -i "PGHOST" | head -1 | awk -F'=' '{print $2}' | tr -d ' ' | sed 's/"//g')
            local pgport=$(echo "$vars_output" | grep -i "PGPORT" | head -1 | awk -F'=' '{print $2}' | tr -d ' ' | sed 's/"//g')
            local pguser=$(echo "$vars_output" | grep -i "PGUSER" | head -1 | awk -F'=' '{print $2}' | tr -d ' ' | sed 's/"//g')
            local pgpassword=$(echo "$vars_output" | grep -i "PGPASSWORD" | head -1 | awk -F'=' '{print $2}' | tr -d ' ' | sed 's/"//g')
            local pgdatabase=$(echo "$vars_output" | grep -i "PGDATABASE" | head -1 | awk -F'=' '{print $2}' | tr -d ' ' | sed 's/"//g')
            
            if [ -n "$pghost" ] && [ -n "$pguser" ] && [ -n "$pgpassword" ] && [ -n "$pgdatabase" ]; then
                pgport=${pgport:-5432}
                db_url="postgres://${pguser}:${pgpassword}@${pghost}:${pgport}/${pgdatabase}"
            fi
        fi
        
        echo "$db_url"
    fi
}

# =============================================================================
# Deploy PostgreSQL Database
# =============================================================================
deploy_postgres() {
    log_info "Checking for PostgreSQL service..."

    # Always show services early so the user can make an informed choice.
    # Requirement: print all service names in logs when PostgreSQL already exists.
    log_all_services
    
    # Check if DATABASE_URL is provided (user wants to use existing database)
    if [ -n "$DATABASE_URL" ]; then
        log_info "DATABASE_URL provided, skipping PostgreSQL deployment"
        log_info "Using provided DATABASE_URL"
        return 0
    fi
    
    # Find all PostgreSQL services
    local postgres_services=()
    while IFS= read -r service; do
        # Filter out log messages and empty lines, only keep valid service names
        if [ -n "$service" ] && [[ "$service" =~ ^[a-zA-Z0-9_-]+$ ]]; then
            postgres_services+=("$service")
        fi
    done < <(find_postgres_services 2>/dev/null)
    
    if [ ${#postgres_services[@]} -gt 0 ]; then
        echo ""
        log_info "Found ${#postgres_services[@]} PostgreSQL service(s):"
        echo ""
        
        local index=1
        local service_names=()
        local service_urls=()
        
        for svc_name in "${postgres_services[@]}"; do
            local db_url=$(get_database_url_from_service "$svc_name")
            service_names+=("$svc_name")
            service_urls+=("$db_url")
            
            if [ -n "$db_url" ]; then
                # Mask password in display
                local display_url=$(echo "$db_url" | sed 's/:[^@]*@/:***@/')
                echo "  [$index] $svc_name"
                echo "       URL: $display_url"
            else
                echo "  [$index] $svc_name (could not retrieve DATABASE_URL)"
            fi
            echo ""
            ((index++))
        done
        
        echo "  [$index] Deploy new PostgreSQL database"
        echo ""
        
        # Ask user to choose
        while true; do
            local prompt_text="[INPUT] Select PostgreSQL service to use (1-$index): "
            echo -ne "${BLUE}${prompt_text}${NC}"
            read choice
            
            if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le $index ]; then
                if [ "$choice" -eq $index ]; then
                    # User chose to deploy new PostgreSQL
                    break
                else
                    # User chose an existing service
                    local selected_index=$((choice-1))
                    local selected_service="${service_names[$selected_index]}"
                    local selected_db_url="${service_urls[$selected_index]}"
                    
                    if [ -n "$selected_db_url" ]; then
                        export DATABASE_URL="$selected_db_url"
                        export SELECTED_POSTGRES_SERVICE="$selected_service"
                        log_success "Selected PostgreSQL service: $selected_service"
                        log_success "Using DATABASE_URL from $selected_service"
                        return 0
                    else
                        log_error "Could not retrieve DATABASE_URL from $selected_service"
                        log_info "Please set DATABASE_URL manually:"
                        log_info "  export DATABASE_URL=\"postgres://user:pass@host:5432/dbname\""
                        exit 1
                    fi
                fi
            else
                log_error "Invalid choice. Please enter a number between 1 and $index"
            fi
        done
    fi
    
    # Deploy new PostgreSQL database (user selected this option or no services found)
    if [ ${#postgres_services[@]} -eq 0 ]; then
        log_info "No PostgreSQL services found. Deploying new PostgreSQL database..."
    else
        log_info "Deploying new PostgreSQL database as requested..."
    fi
    log_warn "This will create a new PostgreSQL database service on Railway"
    
    # Link back to project root before adding service
    railway link 2>/dev/null || true
    
    # Add PostgreSQL database
    log_info "Creating PostgreSQL database service..."
    log_info "Note: This may require interactive confirmation in Railway CLI"
    
    if railway add --database postgres 2>&1 | tee /tmp/railway_add.log; then
        log_success "PostgreSQL database service created"
        
        log_info "Waiting for PostgreSQL to be ready..."
        sleep 15
        
        # Try to get DATABASE_URL from Railway variables (try multiple service name variations)
        log_info "Retrieving DATABASE_URL from Railway..."
        local db_url=""
        
        for svc_name in "PostgreSQL" "postgres" "postgresql" "Postgres"; do
            local vars_output=$(railway variables --service "$svc_name" 2>/dev/null)
            if [ $? -eq 0 ]; then
                db_url=$(echo "$vars_output" | grep -i "DATABASE_URL" | head -1 | awk -F'=' '{print $2}' | tr -d ' ' | sed 's/"//g')
                if [ -n "$db_url" ]; then
                    log_info "Found DATABASE_URL in service: $svc_name"
                    break
                fi
            fi
        done
        
        if [ -n "$db_url" ]; then
            export DATABASE_URL="$db_url"
            # Try to determine the service name that was created
            for svc_name in "PostgreSQL" "postgres" "postgresql" "Postgres"; do
                local check_vars=$(railway variables --service "$svc_name" 2>/dev/null)
                if [ $? -eq 0 ] && echo "$check_vars" | grep -qi "DATABASE_URL"; then
                    export SELECTED_POSTGRES_SERVICE="$svc_name"
                    break
                fi
            done
            log_success "Retrieved DATABASE_URL from Railway"
        else
            log_warn "Could not automatically retrieve DATABASE_URL"
            log_info "Please set DATABASE_URL manually:"
            log_info "  1. Go to Railway dashboard → PostgreSQL service → Variables"
            log_info "  2. Copy DATABASE_URL value"
            log_info "  3. Run: export DATABASE_URL=\"<your-database-url>\""
            log_info "  4. Re-run this script"
            exit 1
        fi
    else
        log_error "Failed to deploy PostgreSQL"
        log_info "This might be because:"
        log_info "  - Railway CLI requires interactive confirmation"
        log_info "  - Network timeout or connection issue"
        log_info ""
        log_info "You can:"
        log_info "  1. Add PostgreSQL manually via Railway dashboard (New → Database → PostgreSQL)"
        log_info "  2. Or provide DATABASE_URL: export DATABASE_URL=\"postgres://user:pass@host:5432/dbname\""
        exit 1
    fi
}

# =============================================================================
# Deploy Hasura GraphQL Engine
# =============================================================================
deploy_hasura() {
    log_info "Deploying Hasura GraphQL Engine..."
    
    # Get the selected PostgreSQL service name (default to PostgreSQL if not set)
    local pg_service="${SELECTED_POSTGRES_SERVICE:-PostgreSQL}"
    if [ -n "$SELECTED_POSTGRES_SERVICE" ]; then
        log_info "Using Railway PostgreSQL service: $pg_service"
    else
        log_info "Using DATABASE_URL provided externally (not a Railway service reference)"
    fi
    
    # Create Hasura service (empty service first)
    log_info "Creating Hasura service..."
    railway add --service hasura 2>/dev/null || log_warn "Hasura service may already exist"
    
    # Link to hasura service
    log_info "Linking to Hasura service..."
    railway link --service hasura 2>/dev/null || true
    
    # Set environment variables for Hasura (Railway CLI v3 syntax)
    log_info "Setting Hasura environment variables..."

    # Security note: if you provide DATABASE_URL externally, it will be stored as a Hasura service variable.
    # If you're using a Railway-managed Postgres service, we prefer Railway variable references to avoid duplicating secrets.
    if [ -n "$SELECTED_POSTGRES_SERVICE" ]; then
        railway variables \
            --set "HASURA_GRAPHQL_DATABASE_URL=postgres://\${{${pg_service}.PGUSER}}:\${{${pg_service}.PGPASSWORD}}@\${{${pg_service}.PGHOST}}:\${{${pg_service}.PGPORT}}/\${{${pg_service}.PGDATABASE}}" \
            --set "HASURA_GRAPHQL_ENABLE_CONSOLE=true" \
            --set "HASURA_GRAPHQL_ENABLED_LOG_TYPES=startup, http-log, webhook-log, websocket-log, query-log" \
            --set "HASURA_GRAPHQL_NO_OF_RETRIES=10" \
            --set "HASURA_GRAPHQL_ADMIN_SECRET=$HASURA_ADMIN_SECRET" \
            --set "HASURA_GRAPHQL_STRINGIFY_NUMERIC_TYPES=true" \
            --set "HASURA_GRAPHQL_UNAUTHORIZED_ROLE=public" \
            --set "PORT=8080"
    else
        railway variables \
            --set "HASURA_GRAPHQL_DATABASE_URL=$DATABASE_URL" \
            --set "HASURA_GRAPHQL_ENABLE_CONSOLE=true" \
            --set "HASURA_GRAPHQL_ENABLED_LOG_TYPES=startup, http-log, webhook-log, websocket-log, query-log" \
            --set "HASURA_GRAPHQL_NO_OF_RETRIES=10" \
            --set "HASURA_GRAPHQL_ADMIN_SECRET=$HASURA_ADMIN_SECRET" \
            --set "HASURA_GRAPHQL_STRINGIFY_NUMERIC_TYPES=true" \
            --set "HASURA_GRAPHQL_UNAUTHORIZED_ROLE=public" \
            --set "PORT=8080"
    fi
    
    log_success "Hasura environment variables set"
    log_warn "Please set Docker image to 'hasura/graphql-engine:v2.43.0' in Railway dashboard for hasura service"
    log_info "After deployment, expose port 8080 in Railway dashboard (Settings → Networking)"
}

# =============================================================================
# Deploy Envio Indexer
# =============================================================================
deploy_indexer() {
    log_warn "Indexer deployment is intentionally skipped by this script."
    log_info "Per your workflow, deploy the Indexer from Railway UI (GitHub Repo / Dockerfile) after Postgres+Hasura are ready."
    return 0
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
    init_railway_project
    
    echo ""
    log_info "Starting deployment..."
    echo ""
    
    # Deploy PostgreSQL first (if needed)
    deploy_postgres
    echo ""
    
    # Parse DATABASE_URL if available
    if [ -n "$DATABASE_URL" ]; then
        parse_database_url
    else
        log_warn "DATABASE_URL not available. Some services may not work correctly."
        log_info "Please set DATABASE_URL manually or check Railway dashboard"
    fi
    echo ""
    
    # Deploy Hasura
    deploy_hasura
    echo ""
    
    echo ""
    echo "=========================================="
    log_success "Deployment completed!"
    echo "=========================================="
    echo ""
    log_info "Next steps:"
    echo "  1. Go to Railway dashboard"
    echo "  2. Set Hasura service Docker image to: hasura/graphql-engine:v2.43.0"
    echo "  3. Expose port if needed (Hasura: 8080)"
    echo "  4. Deploy Indexer via Railway UI (this script does not deploy it)"
    echo "  5. Verify all services are running and connected"
    echo ""
    log_info "Useful commands:"
    echo "  - Check status: railway status"
    echo "  - View logs: railway logs --service <service-name>"
    echo "  - View all services: railway service list"
    echo "  - View variables: railway variables --service <service-name>"
    echo ""
}

main "$@"

