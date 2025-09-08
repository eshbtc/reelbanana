#!/bin/bash

# Service Monitoring and Rollback Script
# Usage: ./scripts/monitor-services.sh [action]
# Actions: check, rollback, status

set -e

PROJECT_ID="reel-banana-35a54"
REGION="us-central1"

# Service configurations (using functions instead of associative arrays for compatibility)
get_service_port() {
  case $1 in
    "upload-assets") echo "8083" ;;
    "narrate") echo "8080" ;;
    "align-captions") echo "8081" ;;
    "render") echo "8082" ;;
    "compose-music") echo "8084" ;;
    "api-key-service") echo "8085" ;;
    "polish") echo "8086" ;;
    "stripe-service") echo "8087" ;;
    *) echo "" ;;
  esac
}

get_all_services() {
  echo "upload-assets narrate align-captions render compose-music api-key-service polish stripe-service"
}

ACTION=${1:-check}

echo "🔍 ReelBanana Service Monitor"
echo "=============================="
echo ""

# Function to get service URL
get_service_url() {
  local service_name=$1
  gcloud run services describe "reel-banana-$service_name" --region=$REGION --format="value(status.url)" 2>/dev/null || echo ""
}

# Function to check service health
check_service_health() {
  local service_name=$1
  local url=$2
  
  if [ -z "$url" ]; then
    echo "❌ $service_name: Not deployed"
    return 1
  fi
  
  # Test health endpoint
  if curl -f -s --max-time 10 "$url/health" > /dev/null 2>&1; then
    echo "✅ $service_name: Healthy ($url)"
    return 0
  else
    echo "❌ $service_name: Unhealthy ($url)"
    return 1
  fi
}

# Function to check service dependencies
check_service_dependencies() {
  local service_name=$1
  local url=$2
  
  if [ -z "$url" ]; then
    echo "❌ $service_name: Not deployed - cannot check dependencies"
    return 1
  fi
  
  echo "🔍 Checking dependencies for $service_name..."
  
  # Get basic health response (no auth required)
  local health_response=$(curl -s --max-time 10 "$url/health" 2>/dev/null || echo "{}")
  
  # Service-specific dependency checks
  case "$service_name" in
    "narrate")
      echo "  🎤 ElevenLabs API:"
      if echo "$health_response" | grep -q '"elevenlabsConfigured":true'; then
        echo "    ✅ ElevenLabs API key configured"
      else
        echo "    ❌ ElevenLabs API key not configured"
      fi
      ;;
    "render")
      echo "  🎬 FAL Configuration:"
      if echo "$health_response" | grep -q '"falConfigured":true'; then
        echo "    ✅ FAL API key configured"
      else
        echo "    ❌ FAL API key not configured"
      fi
      if echo "$health_response" | grep -q '"falModel":"'; then
        echo "    ✅ FAL render model configured"
      else
        echo "    ❌ FAL render model not configured"
      fi
      ;;
    "compose-music")
      echo "  🎵 Music Generation:"
      if echo "$health_response" | grep -q '"elevenLabsMusicConfigured":true'; then
        echo "    ✅ ElevenLabs Music API configured"
      else
        echo "    ❌ ElevenLabs Music API not configured"
      fi
      if echo "$health_response" | grep -q '"aiConfigured":true'; then
        echo "    ✅ AI configuration ready"
      else
        echo "    ❌ AI configuration not ready"
      fi
      ;;
    "polish")
      echo "  ✨ Polish Configuration:"
      if echo "$health_response" | grep -q '"usingApiKeyService":true'; then
        echo "    ✅ API Key Service integration configured"
      else
        echo "    ❌ API Key Service integration not configured"
      fi
      if echo "$health_response" | grep -q '"hasDefaultFalKey":true'; then
        echo "    ✅ Default FAL API key configured"
      else
        echo "    ❌ Default FAL API key not configured"
      fi
      ;;
    "api-key-service")
      echo "  🔐 KMS Configuration:"
      if echo "$health_response" | grep -q '"kmsConfigured":true'; then
        echo "    ✅ KMS Key Ring configured"
        echo "    ✅ API key encryption/decryption ready"
      else
        echo "    ❌ KMS Key Ring not configured"
        echo "    ❌ API key encryption/decryption unavailable"
      fi
      ;;
    "stripe-service")
      echo "  💳 Stripe Configuration:"
      if echo "$health_response" | grep -q '"stripe":"connected"'; then
        echo "    ✅ Stripe API keys configured"
      else
        echo "    ❌ Stripe API keys not configured"
      fi
      ;;
  esac
  
  # Firebase connection check not available in basic health endpoints
  # This would require authenticated access to /health/detailed
  
  # Check bucket configurations
  echo "  🪣 Storage:"
  if echo "$health_response" | grep -q '"bucket":"'; then
    echo "    ✅ Storage bucket configured"
  else
    echo "    ❌ Storage bucket not configured"
  fi
}

# Function to get service status
get_service_status() {
  local service_name=$1
  local url=$2
  
  if [ -z "$url" ]; then
    echo "❌ $service_name: Not deployed"
    return
  fi
  
  # Get detailed service info
  local status=$(gcloud run services describe "reel-banana-$service_name" --region=$REGION --format="value(status.conditions[0].status)" 2>/dev/null || echo "Unknown")
  local ready=$(gcloud run services describe "reel-banana-$service_name" --region=$REGION --format="value(status.conditions[1].status)" 2>/dev/null || echo "Unknown")
  local traffic=$(gcloud run services describe "reel-banana-$service_name" --region=$REGION --format="value(status.traffic[0].percent)" 2>/dev/null || echo "0")
  
  echo "📊 $service_name:"
  echo "   URL: $url"
  echo "   Status: $status"
  echo "   Ready: $ready"
  echo "   Traffic: ${traffic}%"
  
  # Health check
  if check_service_health "$service_name" "$url"; then
    echo "   Health: ✅ Healthy"
  else
    echo "   Health: ❌ Unhealthy"
  fi
  echo ""
}

# Function to rollback service
rollback_service() {
  local service_name=$1
  
  echo "🔄 Rolling back $service_name..."
  
  # Get current revision
  local current_revision=$(gcloud run services describe "reel-banana-$service_name" --region=$REGION --format="value(status.latestReadyRevisionName)" 2>/dev/null)
  
  if [ -z "$current_revision" ]; then
    echo "❌ No current revision found for $service_name"
    return 1
  fi
  
  # Get previous revision
  local previous_revision=$(gcloud run revisions list --service="reel-banana-$service_name" --region=$REGION --format="value(metadata.name)" --limit=2 | tail -1)
  
  if [ -z "$previous_revision" ] || [ "$previous_revision" = "$current_revision" ]; then
    echo "❌ No previous revision found for $service_name"
    return 1
  fi
  
  echo "   Current: $current_revision"
  echo "   Rolling back to: $previous_revision"
  
  # Rollback to previous revision
  gcloud run services update-traffic "reel-banana-$service_name" \
    --to-revisions="$previous_revision=100" \
    --region=$REGION \
    --quiet
  
  echo "✅ Rollback completed for $service_name"
  
  # Wait and check health
  echo "⏳ Waiting for service to stabilize..."
  sleep 30
  
  local url=$(get_service_url "$service_name")
  if check_service_health "$service_name" "$url"; then
    echo "✅ $service_name is healthy after rollback"
  else
    echo "❌ $service_name is still unhealthy after rollback"
  fi
}

# Main functions
check_all_services() {
  echo "🏥 Checking all services..."
  echo ""
  
  local healthy_count=0
  local total_count=0
  local unhealthy_services=()
  
  for service in $(get_all_services); do
    local url=$(get_service_url "$service")
    total_count=$((total_count + 1))
    
    if check_service_health "$service" "$url"; then
      healthy_count=$((healthy_count + 1))
    else
      unhealthy_services+=("$service")
    fi
  done
  
  echo ""
  echo "📊 Summary:"
  echo "   Healthy: $healthy_count/$total_count"
  echo "   Unhealthy: $((total_count - healthy_count))/$total_count"
  
  if [ ${#unhealthy_services[@]} -gt 0 ]; then
    echo ""
    echo "❌ Unhealthy services:"
    for service in "${unhealthy_services[@]}"; do
      echo "   - $service"
    done
    echo ""
    echo "💡 To rollback a service: ./scripts/monitor-services.sh rollback [service-name]"
    return 1
  else
    echo ""
    echo "🎉 All services are healthy!"
    return 0
  fi
}

show_status() {
  echo "📊 Service Status Report"
  echo "========================"
  echo ""
  
  for service in $(get_all_services); do
    local url=$(get_service_url "$service")
    get_service_status "$service" "$url"
  done
}

check_all_dependencies() {
  echo "🔍 Comprehensive Dependency Check"
  echo "================================="
  echo ""
  
  local total_services=0
  local healthy_deps=0
  local unhealthy_services=()
  
  for service in $(get_all_services); do
    local url=$(get_service_url "$service")
    total_services=$((total_services + 1))
    
    echo "📋 $service:"
    if [ -n "$url" ]; then
      # Check if service has any dependency issues
      local has_issues=false
      
      # Get basic health response (no auth required)
      local health_response=$(curl -s --max-time 10 "$url/health" 2>/dev/null || echo "{}")
      
      # Check for specific issues based on service type
      case "$service" in
        "narrate")
          if ! echo "$health_response" | grep -q '"elevenlabsConfigured":true'; then
            has_issues=true
          fi
          ;;
        "render")
          if ! echo "$health_response" | grep -q '"falConfigured":true'; then
            has_issues=true
          fi
          ;;
        "compose-music")
          if ! echo "$health_response" | grep -q '"elevenLabsMusicConfigured":true' || ! echo "$health_response" | grep -q '"aiConfigured":true'; then
            has_issues=true
          fi
          ;;
        "polish")
          if ! echo "$health_response" | grep -q '"usingApiKeyService":true' && ! echo "$health_response" | grep -q '"hasDefaultFalKey":true'; then
            has_issues=true
          fi
          ;;
        "api-key-service")
          if ! echo "$health_response" | grep -q '"kmsConfigured":true'; then
            has_issues=true
          fi
          ;;
        "stripe-service")
          if ! echo "$health_response" | grep -q '"stripe":"connected"'; then
            has_issues=true
          fi
          ;;
      esac
      
      # Firebase check is not available in basic health endpoints
      # Services are considered healthy if their specific configurations are present
      
      if [ "$has_issues" = true ]; then
        unhealthy_services+=("$service")
        echo "  ❌ Some dependencies unhealthy"
      else
        healthy_deps=$((healthy_deps + 1))
        echo "  ✅ All dependencies healthy"
      fi
    else
      unhealthy_services+=("$service")
      echo "  ❌ Service not deployed"
    fi
    echo ""
  done
  
  echo "📊 Dependency Summary:"
  echo "   Services with healthy dependencies: $healthy_deps/$total_services"
  echo "   Services with issues: $((total_services - healthy_deps))/$total_services"
  
  if [ ${#unhealthy_services[@]} -gt 0 ]; then
    echo ""
    echo "❌ Services with dependency issues:"
    for service in "${unhealthy_services[@]}"; do
      echo "   - $service"
    done
    echo ""
    echo "💡 Check the detailed output above for specific issues"
    return 1
  else
    echo ""
    echo "🎉 All services have healthy dependencies!"
    return 0
  fi
}

rollback_service_by_name() {
  local service_name=$1
  
  if [ -z "$service_name" ]; then
    echo "❌ Please specify a service name to rollback"
    echo "Available services: $(get_all_services)"
    return 1
  fi
  
  if [ -z "$(get_service_port "$service_name")" ]; then
    echo "❌ Unknown service: $service_name"
    echo "Available services: $(get_all_services)"
    return 1
  fi
  
  rollback_service "$service_name"
}

# Main execution
case $ACTION in
  "check")
    check_all_services
    ;;
  "status")
    show_status
    ;;
  "dependencies")
    check_all_dependencies
    ;;
  "rollback")
    rollback_service_by_name "$2"
    ;;
  *)
    echo "❌ Invalid action: $ACTION"
    echo ""
    echo "Usage: $0 [action] [service-name]"
    echo ""
    echo "Actions:"
    echo "  check         - Check health of all services"
    echo "  status        - Show detailed status of all services"
    echo "  dependencies  - Check all service dependencies and configurations"
    echo "  rollback      - Rollback a specific service to previous revision"
    echo ""
    echo "Examples:"
    echo "  $0 check"
    echo "  $0 status"
    echo "  $0 dependencies"
    echo "  $0 rollback stripe-service"
    exit 1
    ;;
esac
