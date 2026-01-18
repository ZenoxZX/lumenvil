#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# PIDs
BACKEND_PID=""
AGENT_PID=""
DASHBOARD_PID=""

cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping all services...${NC}"

    if [ -n "$DASHBOARD_PID" ] && kill -0 $DASHBOARD_PID 2>/dev/null; then
        echo -e "${BLUE}Stopping Dashboard (PID: $DASHBOARD_PID)...${NC}"
        kill $DASHBOARD_PID 2>/dev/null
        wait $DASHBOARD_PID 2>/dev/null
    fi

    if [ -n "$AGENT_PID" ] && kill -0 $AGENT_PID 2>/dev/null; then
        echo -e "${BLUE}Stopping BuildAgent (PID: $AGENT_PID)...${NC}"
        kill $AGENT_PID 2>/dev/null
        wait $AGENT_PID 2>/dev/null
    fi

    if [ -n "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
        echo -e "${BLUE}Stopping Backend (PID: $BACKEND_PID)...${NC}"
        kill $BACKEND_PID 2>/dev/null
        wait $BACKEND_PID 2>/dev/null
    fi

    # Kill any remaining dotnet processes in this project
    pkill -f "lumenvil/src/Backend" 2>/dev/null
    pkill -f "lumenvil/src/BuildAgent" 2>/dev/null

    echo -e "${GREEN}All services stopped.${NC}"
    exit 0
}

trap cleanup INT TERM

wait_for_backend() {
    local max_attempts=30
    local attempt=1

    echo -e "${YELLOW}Waiting for Backend to be ready...${NC}"

    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
            echo -e "${GREEN}Backend is ready!${NC}"
            return 0
        fi

        # Also check if process is still running
        if ! kill -0 $BACKEND_PID 2>/dev/null; then
            echo -e "${RED}Backend process died!${NC}"
            return 1
        fi

        echo -e "  Attempt $attempt/$max_attempts..."
        sleep 1
        ((attempt++))
    done

    echo -e "${RED}Backend failed to start in time${NC}"
    return 1
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Lumenvil Build Automation System${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Cleanup any existing processes
echo -e "${YELLOW}Cleaning up existing processes...${NC}"
pkill -f "lumenvil/src/Backend" 2>/dev/null || true
pkill -f "lumenvil/src/BuildAgent" 2>/dev/null || true
lsof -ti:5000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 1
echo -e "${GREEN}Cleanup done${NC}"
echo ""

# Start Backend
echo -e "${GREEN}[1/3] Starting Backend...${NC}"
(cd src/Backend && dotnet run) &
BACKEND_PID=$!
echo -e "  PID: $BACKEND_PID"

# Wait for Backend to be ready
if ! wait_for_backend; then
    echo -e "${RED}Failed to start Backend. Aborting.${NC}"
    cleanup
    exit 1
fi

echo ""

# Start BuildAgent
echo -e "${GREEN}[2/3] Starting BuildAgent...${NC}"
(cd src/BuildAgent && dotnet run) &
AGENT_PID=$!
echo -e "  PID: $AGENT_PID"
sleep 2

echo ""

# Start Dashboard
echo -e "${GREEN}[3/3] Starting Dashboard...${NC}"
(cd src/Dashboard && npm run dev) &
DASHBOARD_PID=$!
echo -e "  PID: $DASHBOARD_PID"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}All services started!${NC}"
echo ""
echo -e "  Backend:    http://localhost:5000"
echo -e "  Dashboard:  http://localhost:3000"
echo ""
echo -e "${YELLOW}Press CTRL+C to stop all services${NC}"
echo -e "${BLUE}========================================${NC}"

# Wait for any process to exit
wait
