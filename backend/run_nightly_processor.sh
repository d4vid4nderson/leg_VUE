#!/bin/bash
# Run nightly state legislation processor in Docker container
# Usage: ./run_nightly_processor.sh [STATE_ABBR]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🌙 Starting Nightly State Legislation Processor${NC}"

# Check if Docker container is running
if ! docker ps | grep -q "backend"; then
    echo -e "${RED}❌ Backend Docker container is not running${NC}"
    echo "Please start the backend container first"
    exit 1
fi

# Create log directory if it doesn't exist
docker exec backend mkdir -p /app/logs

# Run the processor
if [ "$#" -eq 0 ]; then
    echo -e "${YELLOW}Processing all configured states...${NC}"
    docker exec backend python nightly_state_legislation_processor.py
else
    echo -e "${YELLOW}Processing specific state: $1${NC}"
    docker exec backend python nightly_state_legislation_processor.py "$1"
fi

# Check the exit code
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Nightly processing completed successfully${NC}"
else
    echo -e "${RED}❌ Nightly processing failed - check logs${NC}"
    exit 1
fi

# Show recent log entries
echo -e "${YELLOW}📋 Recent log entries:${NC}"
docker exec backend tail -20 nightly_state_processor.log 2>/dev/null || echo "No log file found"

echo -e "${GREEN}🎉 Script completed${NC}"