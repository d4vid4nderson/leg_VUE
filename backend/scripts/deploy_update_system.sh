#!/bin/bash

# Deploy Complete Bill Update System
# This script deploys the entire bill update system with all components

# Configuration
PROJECT_PATH="/Users/david.anderson/Downloads/PoliticalVue/backend"
FRONTEND_PATH="/Users/david.anderson/Downloads/PoliticalVue/frontend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying Complete Bill Update System${NC}"
echo -e "${GREEN}=====================================\n${NC}"

# Step 1: Database Migration
echo -e "${BLUE}📊 Step 1: Database Migration${NC}"
echo "Applying database migrations..."

if [ -f "database/migrations/add_update_tracking.sql" ]; then
    echo -e "${YELLOW}Please run the following command to apply database migrations:${NC}"
    echo "psql -d your_database -f database/migrations/add_update_tracking.sql"
    echo ""
    echo -e "${YELLOW}Press Enter when database migration is complete...${NC}"
    read
    echo -e "${GREEN}✅ Database migration completed${NC}"
else
    echo -e "${RED}❌ Database migration file not found${NC}"
    exit 1
fi

# Step 2: Python Dependencies
echo -e "\n${BLUE}📦 Step 2: Python Dependencies${NC}"
echo "Installing Python dependencies..."

if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
    echo -e "${GREEN}✅ Python dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠️ requirements.txt not found - installing known dependencies${NC}"
    pip install aiohttp asyncio sqlalchemy pydantic python-dotenv openai
fi

# Step 3: Environment Variables Check
echo -e "\n${BLUE}🔧 Step 3: Environment Variables${NC}"
echo "Checking environment variables..."

ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}Creating .env file template...${NC}"
    cat > "$ENV_FILE" << EOF
# LegiScan API Configuration
LEGISCAN_API_KEY=your_legiscan_api_key_here

# AI Service Configuration (choose one)
OPENAI_API_KEY=your_openai_key_here
# OR
AZURE_ENDPOINT=your_azure_endpoint_here
AZURE_KEY=your_azure_key_here
AZURE_MODEL_NAME=gpt-4o-mini

# Database Configuration
DATABASE_URL=your_database_url_here

# Application Settings
DEBUG=True
LOG_LEVEL=INFO
EOF
    echo -e "${YELLOW}⚠️ Please update the .env file with your actual values${NC}"
    echo -e "${YELLOW}Press Enter when .env file is configured...${NC}"
    read
fi

# Check for required environment variables
if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
    
    if [ -z "$LEGISCAN_API_KEY" ] || [ "$LEGISCAN_API_KEY" = "your_legiscan_api_key_here" ]; then
        echo -e "${RED}❌ LEGISCAN_API_KEY not configured${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Environment variables configured${NC}"
fi

# Step 4: Backend API Integration
echo -e "\n${BLUE}🔌 Step 4: Backend API Integration${NC}"
echo "Integrating update endpoints with main application..."

MAIN_APP="main.py"
if [ -f "$MAIN_APP" ]; then
    # Check if update endpoints are already integrated
    if grep -q "update_endpoints" "$MAIN_APP"; then
        echo -e "${GREEN}✅ Update endpoints already integrated${NC}"
    else
        echo -e "${YELLOW}Adding update endpoints to main.py...${NC}"
        
        # Add import and route inclusion
        echo "" >> "$MAIN_APP"
        echo "# Bill Update System Integration" >> "$MAIN_APP"
        echo "from api.update_endpoints import include_update_routes" >> "$MAIN_APP"
        echo "include_update_routes(app)" >> "$MAIN_APP"
        
        echo -e "${GREEN}✅ Update endpoints integrated${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ main.py not found - manual integration required${NC}"
    echo "Please add the following to your FastAPI app:"
    echo "from api.update_endpoints import include_update_routes"
    echo "include_update_routes(app)"
fi

# Step 5: Frontend Components
echo -e "\n${BLUE}🎨 Step 5: Frontend Components${NC}"
echo "Setting up frontend components..."

if [ -d "$FRONTEND_PATH/src/components" ]; then
    echo -e "${GREEN}✅ Frontend components created:${NC}"
    echo "   - UpdateNotification.jsx"
    echo "   - ManualRefresh.jsx"
    echo "   - UpdateProgress.jsx"
    
    echo -e "\n${YELLOW}To integrate with your existing StatePage component:${NC}"
    echo "import UpdateNotification from './components/UpdateNotification';"
    echo "import ManualRefresh from './components/ManualRefresh';"
    echo ""
    echo "// Add to your component JSX:"
    echo "<UpdateNotification stateCode={stateCode} onRefresh={handleRefresh} />"
    echo "<ManualRefresh stateCode={stateCode} onRefreshComplete={handleRefreshComplete} />"
else
    echo -e "${YELLOW}⚠️ Frontend components directory not found${NC}"
    echo "Please ensure frontend components are in the correct location"
fi

# Step 6: Cron Job Setup
echo -e "\n${BLUE}⏰ Step 6: Cron Job Setup${NC}"
echo "Setting up automated nightly updates..."

if [ -f "scripts/setup_cron.sh" ]; then
    echo -e "${YELLOW}Do you want to set up the cron job now? (y/N)${NC}"
    read -r response
    
    if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
        chmod +x scripts/setup_cron.sh
        ./scripts/setup_cron.sh
        echo -e "${GREEN}✅ Cron job configured${NC}"
    else
        echo -e "${YELLOW}⏭️ Cron job setup skipped - run 'scripts/setup_cron.sh' later${NC}"
    fi
else
    echo -e "${RED}❌ Cron setup script not found${NC}"
fi

# Step 7: Test the System
echo -e "\n${BLUE}🧪 Step 7: System Testing${NC}"
echo "Testing the update system..."

echo -e "${YELLOW}Do you want to run a test update? (y/N)${NC}"
read -r response

if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
    echo -e "${YELLOW}Running test update...${NC}"
    
    python3 -c "
import sys
import asyncio
sys.path.append('$PROJECT_PATH')

async def test_update():
    try:
        from tasks.nightly_bill_updater import NightlyBillUpdater
        updater = NightlyBillUpdater()
        
        print('Testing LegiScan connection...')
        # Test with a small update
        result = await updater.run_nightly_update()
        print(f'Test completed: {result}')
        return True
    except Exception as e:
        print(f'Test failed: {str(e)}')
        return False

success = asyncio.run(test_update())
if success:
    print('✅ Test passed')
else:
    print('❌ Test failed')
    sys.exit(1)
"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ System test passed${NC}"
    else
        echo -e "${RED}❌ System test failed${NC}"
        echo "Please check the logs and configuration"
    fi
else
    echo -e "${YELLOW}⏭️ System test skipped${NC}"
fi

# Step 8: Create Quick Start Scripts
echo -e "\n${BLUE}📝 Step 8: Creating Quick Start Scripts${NC}"

# Create quick start script
cat > "scripts/quick_start.sh" << 'EOF'
#!/bin/bash
echo "🚀 PoliticalVue Bill Update System - Quick Start"
echo "=============================================="
echo ""
echo "Available commands:"
echo "  1. Check update status"
echo "  2. Run manual update"
echo "  3. Monitor system"
echo "  4. View logs"
echo "  5. Test system"
echo ""
echo "Choose an option (1-5):"
read -r choice

case $choice in
    1)
        echo "Checking update status..."
        curl -s http://localhost:8000/api/updates/status | python3 -m json.tool
        ;;
    2)
        echo "Running manual update..."
        ./scripts/test_update.sh
        ;;
    3)
        echo "Monitoring system..."
        ./scripts/monitor_updates.sh
        ;;
    4)
        echo "Recent logs:"
        ls -la logs/nightly_update_*.log | tail -5
        echo ""
        echo "Latest log content:"
        tail -20 logs/nightly_update_*.log 2>/dev/null | tail -20
        ;;
    5)
        echo "Testing system..."
        python3 -c "
import asyncio
from tasks.nightly_bill_updater import NightlyBillUpdater

async def test():
    updater = NightlyBillUpdater()
    result = await updater.run_nightly_update()
    print(f'Result: {result}')

asyncio.run(test())
"
        ;;
    *)
        echo "Invalid option"
        ;;
esac
EOF

chmod +x "scripts/quick_start.sh"
echo -e "${GREEN}✅ Quick start script created${NC}"

# Final Summary
echo -e "\n${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
echo -e "${GREEN}=====================\n${NC}"

echo -e "${GREEN}✅ Components Deployed:${NC}"
echo "   📊 Database schema with update tracking"
echo "   🔄 Nightly bill updater task"
echo "   🌐 Enhanced LegiScan service"
echo "   🔌 Update API endpoints"
echo "   🎨 Frontend notification components"
echo "   ⏰ Automated cron job (if configured)"
echo "   📊 Monitoring and logging system"

echo -e "\n${GREEN}📋 Available Scripts:${NC}"
echo "   🚀 Quick Start: ./scripts/quick_start.sh"
echo "   📊 Monitor: ./scripts/monitor_updates.sh"
echo "   🧪 Test: ./scripts/test_update.sh"
echo "   ⏰ Cron Setup: ./scripts/setup_cron.sh"

echo -e "\n${GREEN}🔍 System Status:${NC}"
echo "   📁 Project Path: $PROJECT_PATH"
echo "   📝 Logs Directory: $PROJECT_PATH/logs"
echo "   🔧 Environment: $([ -f .env ] && echo "Configured" || echo "Not configured")"
echo "   ⏰ Cron Job: $(crontab -l 2>/dev/null | grep -q "run_nightly_update" && echo "Active" || echo "Not configured")"

echo -e "\n${GREEN}🚀 Next Steps:${NC}"
echo "   1. Start your backend server"
echo "   2. Test the API endpoints"
echo "   3. Integrate frontend components"
echo "   4. Monitor the first nightly update"
echo "   5. Review logs and adjust as needed"

echo -e "\n${GREEN}📖 Documentation:${NC}"
echo "   📄 Full documentation: BILL_UPDATE_SYSTEM.md"
echo "   🌐 API endpoints: /api/updates/*"
echo "   📊 Database schema: database/migrations/add_update_tracking.sql"

echo -e "\n${GREEN}🎯 System Ready!${NC}"
echo "Your comprehensive bill update system is now deployed and ready to use."
echo "Run './scripts/quick_start.sh' to begin using the system."

echo -e "\n${YELLOW}💡 Pro Tips:${NC}"
echo "   - Check logs regularly during first week"
echo "   - Monitor API rate limits"
echo "   - Set up webhook notifications for alerts"
echo "   - Consider using systemd for production deployments"
echo ""