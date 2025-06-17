import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import Analysis from './pages/Analysis';
import HomePage from './components/Landing/Homepage';
import Dashboard from './components/Dashboard/Dashboard';
import AnalysisPage from './components/Analysis/AnalysisPage';
import ErrorBoundary from './components/Common/ErrorBoundary';
import { FullPageLoader } from './components/Common/LoadingSpinner';
import { UserProvider } from './contexts/UserContext';
import './App.css';

const clerkPubKey = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

// Check if Clerk key is available
if (!clerkPubKey) {
  console.error('Missing Clerk Publishable Key. Please add REACT_APP_CLERK_PUBLISHABLE_KEY to your .env file');
}

function App() {
  if (!clerkPubKey) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafafa',
        padding: '2rem'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          textAlign: 'center',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ color: '#ef4444', marginBottom: '1rem' }}>Configuration Error</h1>
          <p style={{ color: '#6b7280' }}>
            Missing Clerk authentication configuration. Please check your environment variables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ClerkProvider 
        publishableKey={clerkPubKey}
        appearance={{
          elements: {
            formButtonPrimary: 'bg-green-500 hover:bg-green-600',
            footerActionLink: 'text-green-500 hover:text-green-600'
          }
        }}
      >
        <UserProvider>
          <Router>
            <div className="App">
              <Routes>
                <Route path="/" element={<Analysis />} />
                <Route 
                  path="/dashboard" 
                  element={
                    <SignedIn>
                      <Dashboard />
                    </SignedIn>
                  } 
                />
                <Route 
                  path="/analysis/:analysisId" 
                  element={
                    <SignedIn>
                      <AnalysisPage />
                    </SignedIn>
                  } 
                />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
              
              <SignedOut>
                <Routes>
                  <Route path="/dashboard" element={<Navigate to="/" />} />
                  <Route path="/analysis/:analysisId" element={<Navigate to="/" />} />
                </Routes>
              </SignedOut>
            </div>
          </Router>
        </UserProvider>
      </ClerkProvider>
    </ErrorBoundary>
  );
}

export default App;
