import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { 
  Menu, X, FileText, FolderOpen, ArrowRight,
  BarChart3, Plus, MoreVertical, Edit, Trash2
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { analysisId: currentAnalysisId } = useParams();
  const [analyses, setAnalyses] = useState([]);
  const [menuOpen, setMenuOpen] = useState(null);
  const [renameModal, setRenameModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [newFileName, setNewFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
    navigate(`/analysis/${analysis._id}`);
    if (onClose) onClose();
  };

  const handleMenuClick = (e, analysisId) => {
    e.stopPropagation();
    setMenuOpen(menuOpen === analysisId ? null : analysisId);
  };

  const handleRename = (analysis) => {
    setRenameModal(analysis);
    setNewFileName(analysis.fileName);
    setMenuOpen(null);
  };

  const handleDelete = async (analysis) => {
    setDeleteModal(analysis);
    setMenuOpen(null);
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/analyses/${deleteModal._id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId }
      });
      
      if (res.ok) {
        // Remove from local state
        setAnalyses(analyses.filter(a => a._id !== deleteModal._id));
        
        // If this was the current analysis, navigate to home
        if (deleteModal._id === currentAnalysisId) {
          navigate('/');
        }
      } else {
        alert('Failed to delete analysis');
      }
    } catch (error) {
      console.error('Failed to delete analysis:', error);
      alert('Failed to delete analysis');
    } finally {
      setIsLoading(false);
      setDeleteModal(null);
    }
  };

  const handleRenameSubmit = async () => {
    if (!newFileName.trim()) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/analyses/${renameModal._id}`, {
        method: 'PATCH',
        headers: { 
          'x-user-id': userId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileName: newFileName.trim() })
      });
      
      if (res.ok) {
        // Update local state
        setAnalyses(analyses.map(a => 
          a._id === renameModal._id 
            ? { ...a, fileName: newFileName.trim() }
            : a
        ));
        setRenameModal(null);
        setNewFileName('');
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Rename failed:', res.status, errorData);
        alert(`Failed to rename analysis: ${res.status} - ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to rename analysis:', error);
      alert(`Failed to rename analysis: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
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
          zIndex: 10002,
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
              marginTop: '3rem',
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: item._id === currentAnalysisId ? 'linear-gradient(135deg, #667eea20, #764ba220)' : 'rgba(255, 255, 255, 0.7)',
                  border: item._id === currentAnalysisId ? '2px solid rgba(102, 126, 234, 0.3)' : '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                <div 
                  onClick={() => handleAnalysisClick(item)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}
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
                    {/* Language badge logic here */}
                    {(() => {
                      const lang = item.language || (item.metadata && item.metadata.language) || 'undefined';
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </p>
                          <button
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: '600',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              border: 'none',
                              background: lang === 'ko'
                                ? 'rgba(102, 126, 234, 0.1)'
                                : lang === 'en'
                                ? 'rgba(16, 185, 129, 0.1)'
                                : 'rgba(239, 68, 68, 0.1)',
                              color: lang === 'ko'
                                ? '#667eea'
                                : lang === 'en'
                                ? '#10b981'
                                : '#ef4444',
                              cursor: 'default',
                              minWidth: '40px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              opacity: 0.95
                            }}
                            disabled
                          >
                            {lang}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                  {item._id !== currentAnalysisId && <ArrowRight size={14} color="#64748b" />}
                </div>
                
                {/* Three-dot menu button */}
                <button
                  onClick={(e) => handleMenuClick(e, item._id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(0, 0, 0, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'transparent';
                  }}
                >
                  <MoreVertical size={16} />
                </button>

                {/* Dropdown menu */}
                {menuOpen === item._id && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: '0',
                      background: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                      zIndex: 10003,
                      minWidth: '120px',
                      overflow: 'hidden'
                    }}
                  >
                    <button
                      onClick={() => handleRename(item)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem 1rem',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        color: '#374151',
                        transition: 'background 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(0, 0, 0, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'transparent';
                      }}
                    >
                      <Edit size={14} />
                      Rename
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={isLoading}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem 1rem',
                        background: 'transparent',
                        border: 'none',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        fontSize: '0.85rem',
                        color: '#ef4444',
                        transition: 'background 0.2s ease',
                        opacity: isLoading ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!isLoading) {
                          e.target.style.background = 'rgba(239, 68, 68, 0.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'transparent';
                      }}
                    >
                      <Trash2 size={14} />
                      {isLoading ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                )}
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

      {/* Rename Modal */}
      {renameModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 10004,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => setRenameModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '12px',
              padding: '2rem',
              minWidth: '350px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: 'rgba(139, 92, 246, 0.1)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <Edit size={24} color="#8b5cf6" />
              </div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: '600', color: '#1e293b' }}>
                Rename Analysis
              </h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', lineHeight: '1.5' }}>
                Enter a new name for your analysis
              </p>
            </div>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleRenameSubmit()}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid rgba(0, 0, 0, 0.2)',
                borderRadius: '8px',
                fontSize: '0.9rem',
                marginBottom: '1.5rem',
                outline: 'none',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.border = '1px solid rgba(139, 92, 246, 0.5)';
                e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.15)';
              }}
              onBlur={(e) => {
                e.target.style.border = '1px solid rgba(0, 0, 0, 0.2)';
                e.target.style.boxShadow = 'none';
              }}
              placeholder="Enter new name..."
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                onClick={() => setRenameModal(null)}
                disabled={isLoading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'transparent',
                  border: '1px solid rgba(0, 0, 0, 0.2)',
                  borderRadius: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  color: '#374151',
                  opacity: isLoading ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                disabled={!newFileName.trim() || isLoading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#8b5cf6',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: newFileName.trim() && !isLoading ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem',
                  color: 'white',
                  opacity: newFileName.trim() && !isLoading ? 1 : 0.5,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (newFileName.trim() && !isLoading) {
                    e.target.style.background = '#7c3aed';
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#8b5cf6';
                }}
              >
                {isLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 10004,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => setDeleteModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '12px',
              padding: '2rem',
              minWidth: '350px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: 'rgba(139, 92, 246, 0.1)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <Trash2 size={24} color="#8b5cf6" />
              </div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: '600', color: '#1e293b' }}>
                Delete Analysis
              </h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', lineHeight: '1.5' }}>
                Are you sure you want to delete <strong>"{deleteModal.fileName}"</strong>?<br />
                This action cannot be undone.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteModal(null)}
                disabled={isLoading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'transparent',
                  border: '1px solid rgba(0, 0, 0, 0.2)',
                  borderRadius: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  color: '#374151',
                  opacity: isLoading ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isLoading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#8b5cf6',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  color: 'white',
                  opacity: isLoading ? 0.5 : 1,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.target.style.background = '#7c3aed';
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#8b5cf6';
                }}
              >
                {isLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

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
            zIndex: 10001
          }}
        />
      )}
    </>
  );
};

export default Sidebar;