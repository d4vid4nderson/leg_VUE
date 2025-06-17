// App.jsx - Clean, working version
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import your components
import ExecutiveOrdersPage from './components/ExecutiveOrdersPage';
import StatePage from './components/StatePage';
import HighlightsPage from './components/HighlightsPage';
import SettingsPage from './components/SettingsPage';

// Simple inline Navigation to avoid import issues
const Navigation = () => {
  const currentPath = window.location.pathname;
  
  const styles = {
    nav: {
      backgroundColor: 'white',
      borderBottom: '1px solid #e5e7eb',
      padding: '0',
      marginBottom: '24px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    },
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      height: '64px',
      gap: '32px'
    },
    brand: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#111827',
      textDecoration: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    logo: {
      width: '32px',
      height: '32px',
      backgroundColor: '#2563eb',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '16px'
    },
    link: (isActive) => ({
      textDecoration: 'none',
      padding: '10px 16px',
      borderRadius: '8px',
      fontWeight: '500',
      fontSize: '14px',
      color: isActive ? '#2563eb' : '#6b7280',
      backgroundColor: isActive ? '#eff6ff' : 'transparent',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    })
  };

  return (
    <nav style={styles.nav}>
      <div style={styles.container}>
        <a href="/" style={styles.brand}>
          <div style={styles.logo}>⚖️</div>
          LegalTracker
        </a>
        
        <a href="/" style={styles.link(currentPath === '/')}>
          🏠 Dashboard
        </a>
        
        <a href="/executive-orders" style={styles.link(currentPath.includes('/executive-orders'))}>
          📄 Executive Orders
        </a>
        
        <a href="/state-legislation" style={styles.link(currentPath.includes('/state-legislation'))}>
          📋 State Legislation
        </a>
        
        <a href="/highlights" style={styles.link(currentPath.includes('/highlights'))}>
          ⭐ Highlights
        </a>
        
        <a href="/settings" style={styles.link(currentPath.includes('/settings'))}>
          ⚙️ Settings
        </a>
      </div>
    </nav>
  );
};

function App() {
  const appStyles = {
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  };

  const mainStyles = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 24px 32px 24px'
  };

  return (
    <div style={appStyles}>
      <Router>
        <Navigation />
        
        <main style={mainStyles}>
          <Routes>
            {/* Executive Orders - Self-contained */}
            <Route 
              path="/executive-orders" 
              element={<ExecutiveOrdersPage />} 
            />
            
            {/* State Legislation - Your existing backend integration */}
            <Route 
              path="/state-legislation" 
              element={<StatePage />} 
            />
            
            {/* Highlights */}
            <Route 
              path="/highlights" 
              element={<HighlightsPage />} 
            />
            
            {/* Settings */}
            <Route 
              path="/settings" 
              element={<SettingsPage />} 
            />
            
            {/* Default route */}
            <Route 
              path="/" 
              element={<ExecutiveOrdersPage />} 
            />
          </Routes>
        </main>
      </Router>
    </div>
  );
}

export default App;