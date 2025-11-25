#!/bin/bash
# Terminal Command Runner for Large Dataset Processing
# Run this script to process large datasets without timeouts

echo "🚀 Large Dataset Processing Pipeline"
echo "====================================="

# Configuration
FILE_PATH="hash.md5"
BATCH_SIZE=10
MAX_WORKERS=3
RETRY_ATTEMPTS=3

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python3 is not installed"
        exit 1
    fi
    print_success "Python3 found"
    
    # Check required packages
    if ! python3 -c "import openai, pyodbc, dotenv" 2>/dev/null; then
        print_warning "Installing required Python packages..."
        pip install openai pyodbc python-dotenv
    fi
    print_success "Required packages available"
    
    # Check .env file
    if [ ! -f ".env" ]; then
        print_error ".env file not found"
        echo "Create .env file with your Azure credentials:"
        echo "AZURE_ENDPOINT=https://your-instance.openai.azure.com/"
        echo "AZURE_KEY=your-azure-key"
        echo "AZURE_MODEL_NAME=gpt-4o-mini"
        echo "AZURE_SQL_SERVER=your-server.database.windows.net"
        echo "AZURE_SQL_DATABASE=your-database"
        echo "AZURE_SQL_USERNAME=your-username"
        echo "AZURE_SQL_PASSWORD=your-password"
        exit 1
    fi
    print_success ".env file found"
    
    # Check input file
    if [ ! -f "$FILE_PATH" ]; then
        print_error "Input file not found: $FILE_PATH"
        echo "Please ensure your hash.md5 file exists"
        exit 1
    fi
    print_success "Input file found: $FILE_PATH"
}

# Show processing options
show_options() {
    echo ""
    print_status "Processing Options:"
    echo "1. Quick test (1 batch, 2 workers)"
    echo "2. Standard processing (10 batch, 3 workers)" 
    echo "3. Large dataset (20 batch, 5 workers)"
    echo "4. Custom configuration"
    echo "5. Resume from checkpoint"
    echo "6. Monitor existing process"
    echo ""
    read -p "Select option (1-6): " option
    
    case $option in
        1)
            BATCH_SIZE=1
            MAX_WORKERS=2
            print_status "Quick test mode selected"
            ;;
        2)
            BATCH_SIZE=10
            MAX_WORKERS=3
            print_status "Standard processing mode selected"
            ;;
        3)
            BATCH_SIZE=20
            MAX_WORKERS=5
            print_status "Large dataset mode selected"
            ;;
        4)
            read -p "Enter batch size (default 10): " custom_batch
            read -p "Enter max workers (default 3): " custom_workers
            BATCH_SIZE=${custom_batch:-10}
            MAX_WORKERS=${custom_workers:-3}
            print_status "Custom configuration: batch=$BATCH_SIZE, workers=$MAX_WORKERS"
            ;;
        5)
            print_status "Resume mode selected"
            run_processing "--resume"
            return
            ;;
        6)
            monitor_processing
            return
            ;;
        *)
            print_error "Invalid option"
            exit 1
            ;;
    esac
}

# Run the processing
run_processing() {
    local extra_args="$1"
    
    print_status "Starting batch processing..."
    print_status "File: $FILE_PATH"
    print_status "Batch Size: $BATCH_SIZE"
    print_status "Max Workers: $MAX_WORKERS"
    print_status "Retry Attempts: $RETRY_ATTEMPTS"
    
    # Generate timestamp for output file
    timestamp=$(date +%Y%m%d_%H%M%S)
    output_file="results_${timestamp}.json"
    log_file="processing_${timestamp}.log"
    
    # Build command
    cmd="python3 batch_processor.py"
    cmd="$cmd --file $FILE_PATH"
    cmd="$cmd --batch-size $BATCH_SIZE"
    cmd="$cmd --max-workers $MAX_WORKERS"
    cmd="$cmd --retry-attempts $RETRY_ATTEMPTS"
    cmd="$cmd --output $output_file"
    
    if [ ! -z "$extra_args" ]; then
        cmd="$cmd $extra_args"
    fi
    
    print_status "Command: $cmd"
    echo ""
    
    # Ask for confirmation
    read -p "Start processing? (y/n): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        print_warning "Processing cancelled"
        exit 0
    fi
    
    # Run in background with logging
    echo "Starting processing in background..."
    echo "Log file: $log_file"
    echo "Output file: $output_file"
    echo ""
    
    # Start process
    nohup $cmd > "$log_file" 2>&1 &
    process_pid=$!
    
    echo "Process started with PID: $process_pid"
    echo "Monitor with: tail -f $log_file"
    echo ""
    
    # Show initial progress
    sleep 3
    print_status "Initial progress:"
    tail -n 10 "$log_file"
    
    echo ""
    echo "Processing is running in the background."
    echo "Use option 6 to monitor progress."
    
    # Save PID for monitoring
    echo "$process_pid" > "processing.pid"
    echo "$log_file" > "processing.log_file"
}

# Monitor existing processing
monitor_processing() {
    print_status "Monitoring existing process..."
    
    # Check if process is running
    if [ -f "processing.pid" ]; then
        pid=$(cat processing.pid)
        if ps -p $pid > /dev/null; then
            print_success "Process $pid is running"
            
            # Show log file
            if [ -f "processing.log_file" ]; then
                log_file=$(cat processing.log_file)
                print_status "Showing recent progress from: $log_file"
                echo ""
                tail -n 20 "$log_file"
                echo ""
                
                # Offer to continue monitoring
                read -p "Continue monitoring in real-time? (y/n): " monitor
                if [ "$monitor" = "y" ] || [ "$monitor" = "Y" ]; then
                    tail -f "$log_file"
                fi
            else
                print_warning "Log file not found"
            fi
        else
            print_warning "Process $pid is not running"
            check_completion
        fi
    else
        print_warning "No active process found"
        
        # Look for recent log files
        latest_log=$(ls -t processing_*.log 2>/dev/null | head -1)
        if [ ! -z "$latest_log" ]; then
            print_status "Found recent log file: $latest_log"
            tail -n 20 "$latest_log"
        fi
    fi
}

# Check if processing completed
check_completion() {
    print_status "Checking for completion..."
    
    # Look for recent result files
    latest_result=$(ls -t results_*.json 2>/dev/null | head -1)
    if [ ! -z "$latest_result" ]; then
        print_success "Found result file: $latest_result"
        
        # Show summary
        if command -v jq &> /dev/null; then
            echo "Processing Summary:"
            jq '.stats' "$latest_result" 2>/dev/null || echo "Could not parse results"
        else
            print_status "Install jq to view JSON results: sudo apt install jq"
        fi
    fi
    
    # Check checkpoint
    if [ -f "processing_checkpoint.json" ]; then
        print_status "Checkpoint file exists - processing may have been interrupted"
        echo "Use resume option to continue from checkpoint"
    fi
}

# Database verification
verify_database() {
    print_status "Verifying database records..."
    
    # Simple verification script
    python3 -c "
import os
import pyodbc
from dotenv import load_dotenv

load_dotenv()

try:
    conn = pyodbc.connect(
        f\"Driver={{ODBC Driver 18 for SQL Server}};\"+
        f\"Server=tcp:{os.getenv('AZURE_SQL_SERVER')},1433;\"+
        f\"Database={os.getenv('AZURE_SQL_DATABASE')};\"+
        f\"Uid={os.getenv('AZURE_SQL_USERNAME')};\"+
        f\"Pwd={os.getenv('AZURE_SQL_PASSWORD')};\"+
        f\"Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;\"
    )
    cursor = conn.cursor()
    
    # Count recent records
    cursor.execute(\"\"\"
        SELECT COUNT(*) as total_records,
               COUNT(CASE WHEN created_at >= DATEADD(hour, -24, GETUTCDATE()) THEN 1 END) as recent_records
        FROM dbo.state_legislation
        WHERE bill_id LIKE 'BATCH_%'
    \"\"\")
    
    result = cursor.fetchone()
    print(f'Total batch records: {result[0]}')
    print(f'Records from last 24 hours: {result[1]}')
    
    cursor.close()
    conn.close()
    print('✅ Database verification successful')
    
except Exception as e:
    print(f'❌ Database verification failed: {e}')
"
}

# Cleanup function
cleanup() {
    print_status "Cleanup options:"
    echo "1. Remove checkpoint files"
    echo "2. Remove log files"
    echo "3. Remove result files"
    echo "4. Remove all processing files"
    echo "5. Cancel"
    
    read -p "Select option (1-5): " cleanup_option
    
    case $cleanup_option in
        1)
            rm -f processing_checkpoint.json processing.pid processing.log_file
            print_success "Checkpoint files removed"
            ;;
        2)
            rm -f processing_*.log batch_processing.log
            print_success "Log files removed"
            ;;
        3)
            rm -f results_*.json
            print_success "Result files removed"
            ;;
        4)
            rm -f processing_* batch_processing.log results_*.json
            print_success "All processing files removed"
            ;;
        5)
            print_status "Cleanup cancelled"
            ;;
        *)
            print_error "Invalid option"
            ;;
    esac
}

# Main menu
main_menu() {
    while true; do
        echo ""
        echo "🔧 Large Dataset Processing Menu"
        echo "================================"
        echo "1. Start new processing"
        echo "2. Monitor existing process"
        echo "3. Check completion status"
        echo "4. Verify database records"
        echo "5. Cleanup files"
        echo "6. Exit"
        echo ""
        read -p "Select option (1-6): " main_option
        
        case $main_option in
            1)
                check_prerequisites
                show_options
                run_processing
                ;;
            2)
                monitor_processing
                ;;
            3)
                check_completion
                ;;
            4)
                verify_database
                ;;
            5)
                cleanup
                ;;
            6)
                print_success "Goodbye!"
                exit 0
                ;;
            *)
                print_error "Invalid option"
                ;;
        esac
    done
}

# Help function
show_help() {
    echo "Large Dataset Processing Pipeline"
    echo ""
    echo "This script helps you process large legislation datasets through Azure AI Foundry"
    echo "and save the results to your Azure SQL database for display in your frontend app."
    echo ""
    echo "Features:"
    echo "- Batch processing to prevent timeouts"
    echo "- Automatic retry logic for failed items"
    echo "- Progress tracking and checkpoints"
    echo "- Resume capability for interrupted processing"
    echo "- Real-time monitoring"
    echo "- Database verification"
    echo ""
    echo "Usage:"
    echo "  ./terminal_runner.sh         # Interactive menu"
    echo "  ./terminal_runner.sh --help  # Show this help"
    echo ""
}

# Check command line arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    show_help
    exit 0
fi

# Start main menu
main_menu