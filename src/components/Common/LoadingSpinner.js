import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner = ({ size = 24, color = '#84cc16' }) => (
  <Loader2 
    size={size} 
    style={{ 
      color, 
      animation: 'spin 1s linear infinite' 
    }} 
  />
);

export const FullPageLoader = ({ message = 'Loading...' }) => (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(255, 255, 255, 0.9)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
  }}>
    <LoadingSpinner size={48} />
    <p style={{ 
      marginTop: '1rem', 
      color: '#6b7280', 
      fontSize: '1rem' 
    }}>
      {message}
    </p>
  </div>
);

// Add CSS for spin animation if not already in CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
if (!document.head.querySelector('style[data-spinner]')) {
  style.setAttribute('data-spinner', 'true');
  document.head.appendChild(style);
}
