# LegislationVUE - AI-Powered Legislative Tracking Platform

## Project Overview

LegislationVUE is a comprehensive full-stack application that tracks and analyzes federal executive orders and state legislation using AI-powered insights. The platform provides real-time legislative data with advanced AI analysis, user management, and intelligent filtering capabilities.

## Tech Stack

### Frontend
- **React 18** - Modern functional components with hooks
- **React Router** - Client-side routing and navigation
- **Tailwind CSS** - Utility-first styling framework
- **Lucide React** - Modern icon library
- **Vite** - Fast build tool and development server

### Backend
- **FastAPI** - High-performance Python web framework
- **Azure SQL Database** - Cloud-hosted relational database
- **Azure OpenAI** - AI-powered content analysis
- **Federal Register API** - Real-time executive orders data
- **LegiScan API** - State legislation data

### Infrastructure
- **Azure Container Apps** - Containerized application hosting
- **Azure SQL** - Managed database service
- **Azure OpenAI Service** - AI/ML capabilities
- **Docker** - Containerization

## Key Features

### 🏛️ Executive Orders Management
- **Unlimited Fetching**: Retrieves ALL executive orders from Federal Register (no 20-order limit)
- **AI Analysis**: Comprehensive Azure OpenAI analysis including:
  - Executive summaries
  - Key talking points (exactly 5 formatted points)
  - Business impact assessments (risk/opportunity analysis)
- **Database Persistence**: All data saved to Azure SQL with full CRUD operations
- **Review Status**: Persistent review tracking across user sessions
- **Category Management**: Editable categories with real-time updates

### 📊 State Legislation Tracking
- **Multi-State Support**: California, Colorado, Kentucky, Nevada, South Carolina, Texas
- **LegiScan Integration**: Both traditional and enhanced API workflows
- **Enhanced AI Processing**: Multi-format analysis with structured output
- **One-by-One Processing**: Individual bill analysis and database saving
- **Advanced Search**: Fuzzy search with relevance scoring

### 🤖 AI-Powered Analysis
- **Multiple AI Prompts**: Distinct analysis types with specialized formatting
- **Enhanced Processing**: Executive summary, talking points, business impact
- **Categorization**: Automatic 5-category classification system
- **Structured Output**: Clean HTML formatting for display

### 💾 Database Features
- **Azure SQL Integration**: Full database persistence
- **Review Status**: Database-driven review tracking (not localStorage)
- **Highlights System**: User-specific highlighting with full CRUD
- **Category Updates**: Real-time category management via PATCH endpoints
- **Count Synchronization**: Federal Register vs Database comparison

### 🔐 Authentication & Security
- **Azure AD Integration**: Enterprise authentication
- **Demo Login**: Development/testing access
- **Token Management**: Automatic refresh and expiration handling
- **Session Persistence**: Secure user state management

## Architecture

### Frontend Structure
```
src/
├── components/          # React components
│   ├── ExecutiveOrdersPage.jsx    # 2595-line main component
│   ├── StatePage.jsx              # State legislation interface
│   ├── HighlightsPage.jsx         # User highlights management
│   ├── FilterDropdown.jsx         # Advanced filtering
│   └── EditableCategoryTag.jsx    # Category management
├── hooks/              # Custom React hooks
│   ├── useReviewStatus.js         # Database-driven review status
│   └── useLoadingAnimation.js     # Loading states
├── context/            # React context providers
│   └── AuthContext.jsx           # Authentication management
├── utils/              # Utility functions
│   ├── constants.js               # Application constants
│   └── filterUtils.js            # Filtering logic
└── config/             # Configuration
    └── api.js                     # API endpoints
```

### Backend Structure
```
backend/
├── main.py                       # FastAPI application (16.0.0-Complete)
├── executive_orders_db.py        # Executive orders database operations
├── simple_executive_orders.py   # Federal Register integration
├── legiscan_api.py              # LegiScan API integration
├── database_connection.py       # Azure SQL connection management
├── ai.py                        # Azure OpenAI integration
└── requirements.txt             # Python dependencies
```

## API Endpoints

### Executive Orders
- `GET /api/executive-orders` - Retrieve orders with pagination/filtering
- `POST /api/executive-orders/fetch` - Unlimited Federal Register fetch
- `POST /api/executive-orders/run-pipeline` - Complete pipeline with AI
- `PATCH /api/executive-orders/{id}/category` - Update category
- `PATCH /api/executive-orders/{id}/review` - Update review status
- `GET /api/executive-orders/check-count` - Compare Federal vs Database

### State Legislation
- `GET /api/state-legislation` - Retrieve bills with filtering
- `POST /api/legiscan/search-and-analyze` - Search with AI analysis
- `POST /api/legiscan/enhanced-search-and-analyze` - Enhanced AI workflow
- `POST /api/state-legislation/fetch` - Bulk state data fetching
- `PATCH /api/state-legislation/{id}/category` - Update category
- `PATCH /api/state-legislation/{id}/review` - Update review status

### Highlights
- `GET /api/highlights` - User highlights
- `POST /api/highlights` - Add highlight
- `DELETE /api/highlights/{id}` - Remove highlight

### System
- `GET /api/status` - System health and configuration
- `GET /` - Root status with feature overview

## Database Schema

### Executive Orders Table
```sql
CREATE TABLE dbo.executive_orders (
    id INT IDENTITY(1,1) PRIMARY KEY,
    eo_number NVARCHAR(50),
    document_number NVARCHAR(100),
    title NVARCHAR(MAX),
    summary NVARCHAR(MAX),
    signing_date DATE,
    publication_date DATE,
    category NVARCHAR(50),
    ai_summary NVARCHAR(MAX),
    ai_talking_points NVARCHAR(MAX),
    ai_business_impact NVARCHAR(MAX),
    reviewed BIT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    last_updated DATETIME2 DEFAULT GETUTCDATE()
);
```

### State Legislation Table
```sql
CREATE TABLE dbo.state_legislation (
    id INT IDENTITY(1,1) PRIMARY KEY,
    bill_id NVARCHAR(100),
    bill_number NVARCHAR(100),
    title NVARCHAR(MAX),
    description NVARCHAR(MAX),
    state NVARCHAR(50),
    category NVARCHAR(50),
    ai_summary NVARCHAR(MAX),
    ai_talking_points NVARCHAR(MAX),
    ai_business_impact NVARCHAR(MAX),
    reviewed BIT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    last_updated DATETIME2 DEFAULT GETUTCDATE()
);
```

### Highlights Table
```sql
CREATE TABLE dbo.highlights (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id NVARCHAR(100),
    order_id NVARCHAR(200),
    order_type NVARCHAR(50),
    created_at DATETIME2 DEFAULT GETUTCDATE()
);
```

## Environment Configuration

### Required Environment Variables
```env
# Azure SQL Database
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=your-database-name
AZURE_SQL_USERNAME=your-username
AZURE_SQL_PASSWORD=your-password

# Azure OpenAI
AZURE_ENDPOINT=https://your-instance.openai.azure.com/
AZURE_KEY=your-api-key
AZURE_MODEL_NAME=your-model-deployment

# API Keys
LEGISCAN_API_KEY=your-legiscan-key

# Authentication
VITE_AZURE_CLIENT_ID=your-azure-app-id
VITE_AZURE_TENANT_ID=your-tenant-id

# Environment
ENVIRONMENT=production
FRONTEND_URL=https://your-frontend-url.com
```

## Deployment

### Frontend Deployment (Azure Container Apps)
1. Build React application: `npm run build`
2. Create Docker image with nginx
3. Deploy to Azure Container Apps
4. Configure environment variables
5. Set up custom domain and SSL

### Backend Deployment (Azure Container Apps)
1. Install Python dependencies: `pip install -r requirements.txt`
2. Create Docker image with FastAPI
3. Deploy to Azure Container Apps
4. Configure Azure SQL connection
5. Set up Azure OpenAI integration

### Database Setup
1. Create Azure SQL Database
2. Run schema creation scripts
3. Configure firewall rules
4. Set up connection strings

## Development Setup

### Prerequisites
- Node.js 18+
- Python 3.9+
- Azure SQL Database
- Azure OpenAI Service

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python main.py
```

## Key Implementation Details

### Review Status Persistence
- **Database-Driven**: Uses `useReviewStatus` hook with Azure SQL
- **API Integration**: PATCH endpoints for real-time updates
- **Cross-Session**: Persists across sign-out/sign-in
- **Multi-User**: Consistent state across all users

### AI Analysis Pipeline
- **Azure OpenAI Integration**: GPT-4 with custom prompts
- **Enhanced Processing**: Multiple analysis types with distinct formatting
- **Structured Output**: Clean HTML for executive summaries, numbered talking points, structured business impact

### Unlimited Federal Register Fetching
- **No Limits**: Fetches ALL available executive orders
- **Pagination Handling**: Automatically processes all pages
- **Individual Order Checking**: Skips existing orders for efficiency
- **Database Synchronization**: Compares Federal Register vs Database counts

### Enhanced LegiScan Integration
- **Dual Workflows**: Traditional batch and enhanced one-by-one processing
- **AI-Driven**: Each bill gets comprehensive AI analysis
- **Database Persistence**: Immediate saving with error handling
- **State Support**: Multiple state configurations

## Performance Optimizations

### Frontend
- **React.memo**: Optimized component re-rendering
- **useMemo/useCallback**: Expensive calculation caching
- **Virtual Scrolling**: Large dataset handling
- **Lazy Loading**: Component code splitting

### Backend
- **Async Processing**: Non-blocking API operations
- **Database Connection Pooling**: Efficient connection management
- **Caching**: Intelligent data caching strategies
- **Rate Limiting**: API usage optimization

### Database
- **Indexed Queries**: Optimized database performance
- **Batch Operations**: Efficient bulk data handling
- **Connection Management**: Proper connection lifecycle

## Security Features

### Authentication
- **Azure AD Integration**: Enterprise-grade authentication
- **Token Management**: Secure token handling and refresh
- **Session Security**: Secure session management

### Data Protection
- **SQL Injection Prevention**: Parameterized queries
- **CORS Configuration**: Proper cross-origin handling
- **Input Validation**: Comprehensive data validation
- **Error Handling**: Secure error responses

## Monitoring & Logging

### Application Monitoring
- **Structured Logging**: Comprehensive application logging
- **Performance Metrics**: Response time and usage tracking
- **Error Tracking**: Detailed error reporting and alerting

### Database Monitoring
- **Query Performance**: SQL query optimization tracking
- **Connection Health**: Database connection monitoring
- **Data Integrity**: Consistency checks and validation

## Troubleshooting

### Common Issues
1. **Review Status Not Persisting**: Check `useReviewStatus` hook initialization with actual orders array
2. **Database Connection Errors**: Verify Azure SQL connection string and firewall rules
3. **AI Analysis Failures**: Check Azure OpenAI API key and endpoint configuration
4. **Federal Register API Limits**: Implement proper rate limiting and error handling

### Debug Tools
- **Console Logging**: Comprehensive debug output
- **Network Tab**: API request/response inspection
- **Database Logs**: SQL query performance monitoring

## Contributing

### Code Standards
- **ESLint**: JavaScript/React linting
- **Prettier**: Code formatting
- **Type Safety**: PropTypes for React components
- **Testing**: Jest/React Testing Library

### Git Workflow
- **Feature Branches**: Develop new features in isolated branches
- **Code Reviews**: Mandatory peer review process
- **Automated Testing**: CI/CD pipeline with automated tests

## Version History

### v16.0.0-Complete (Current)
- ✅ Complete functionality preservation
- ✅ Database-driven review status
- ✅ Unlimited Federal Register fetching
- ✅ Enhanced AI processing
- ✅ Full CRUD operations

### Previous Versions
- v15.x: Enhanced AI integration
- v14.x: Azure SQL migration
- v13.x: Authentication implementation
- v12.x: State legislation integration

---

## Contact & Support

For technical support or questions about LegislationVUE, please refer to the project documentation or contact the development team.

**Last Updated**: January 2025  
**Version**: 16.0.0-Complete  
**Environment**: Production Ready