import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { 
  Menu, X, FileText, FolderOpen, ArrowRight,
  BarChart3, Plus
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { analysisId: currentAnalysisId } = useParams();
  const [analyses, setAnalyses] = useState([]);

  useEffect(() => {
    if (userId) {
      fetchAnalyses();
    }
  }, [userId]);

  const fetchAnalyses = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/analyses`, {
        headers: { 'x-user-id': userId }
      });
      const data = await res.json();
      if (data.success) {
        setAnalyses(data.analyses || []);
      }
    } catch (error) {
      console.error('Failed to fetch analyses:', error);
    }
  };

  const handleAnalysisClick = (analysis) => {
    navigate(`/analysis/${analysis._id}`, { state: { analysis } });
    if (onClose) onClose();
  };

  return (
    <>
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          width: '320px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '4px 0 32px rgba(0, 0, 0, 0.08)',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease',
          zIndex: 999,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{ padding: '2rem 1.5rem 1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FolderOpen size={20} /> My Analyses
            </h2>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
          <button
            onClick={() => navigate('/analysis')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem',
              background: 'linear-gradient(135deg, #000, #333)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500
            }}
          >
            <Plus size={16} /> New Analysis
          </button>
        </div>

        <div style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {analyses.length > 0 ? analyses.map((item) => (
              <div
                key={item._id}
                onClick={() => handleAnalysisClick(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: item._id === currentAnalysisId ? 'linear-gradient(135deg, #667eea20, #764ba220)' : 'rgba(255, 255, 255, 0.7)',
                  border: item._id === currentAnalysisId ? '2px solid rgba(102, 126, 234, 0.3)' : '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <FileText size={16} color={item._id === currentAnalysisId ? "#667eea" : "#64748b"} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '0.85rem',
                    fontWeight: item._id === currentAnalysisId ? '600' : '500',
                    color: item._id === currentAnalysisId ? '#667eea' : '#374151',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {item.fileName}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {item._id !== currentAnalysisId && <ArrowRight size={14} color="#64748b" />}
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                <FolderOpen size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <p>No analyses found.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {isOpen && (
        <div 
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.2)',
            backdropFilter: 'blur(4px)',
            zIndex: 998
          }}
        />
      )}
    </>
  );
};

export default Sidebar;