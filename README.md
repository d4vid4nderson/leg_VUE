# PoliticalVue



A web application for viewing and analyzing executive orders and state legislation with AI-powered summaries.

## Features
- Browse federal executive orders
- View state-specific legislation
- AI-generated summaries and insights
- Email notifications
- Advanced filtering and search

## Tech Stack
- Backend: FastAPI (Python)
- Frontend: React + Vite
- AI: Azure OpenAI
- Database: SQLite (development) / Azure SQL (production)

## Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
  
## Environment Variables

### Backend (.env)
```
AZURE_ENDPOINT=your-azure-openai-endpoint
AZURE_KEY=your-azure-openai-key
AZURE_MODEL_NAME=your-model-deployment-name
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:8000
```

## Deployment
See deployment instructions for Azure App Service and Static Web Apps and CI/CD.

## License
MIT
