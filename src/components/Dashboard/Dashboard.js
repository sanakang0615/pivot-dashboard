import React, { useState, useEffect } from 'react';
import { useCurrentUser } from '../../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import {
  Upload, BarChart3, FileSpreadsheet, Plus, 
  Calendar, TrendingUp, Users, Target, Activity,
  MoreVertical, Edit3, Trash2, Download, Eye,
  Search, Filter, Grid, List, Check, X, AlertTriangle
} from 'lucide-react';
import { FullPageLoader } from '../Common/LoadingSpinner';
import DashboardLayout from './DashboardLayout';

const Dashboard = () => {
  const { user, isLoaded } = useCurrentUser();
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [deleteModal, setDeleteModal] = useState(null);

  useEffect(() => {
    if (!isLoaded) return;
    
    if (!user || !userId) {
      navigate('/');
      return;
    }

    fetchAnalyses();
    
    // 페이지 포커스 시 자동 새로고침
    const handleFocus = () => {
      //console.log('Page focused, refreshing analyses...');
      fetchAnalyses();
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isLoaded, user, userId, navigate]);

  const fetchAnalyses = async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/analyses`, {
        headers: { 
          'x-user-id': userId,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      if (data.success && data.analyses) {
        setAnalyses(data.analyses);
      }
    } catch (e) {
      console.error('Error fetching analyses:', e);
      setError('Failed to load analyses. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnalysis = (analysis) => {
    setDeleteModal(analysis);
  };

  const confirmDeleteAnalysis = async () => {
    if (!deleteModal) return;
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/analyses/${deleteModal._id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId }
      });

      if (response.ok) {
        setAnalyses(analyses.filter(a => a._id !== deleteModal._id));
      } else {
        console.error('Failed to delete analysis');
        alert('Failed to delete analysis');
      }
    } catch (error) {
      console.error('Error deleting analysis:', error);
      alert('Failed to delete analysis');
    } finally {
      setDeleteModal(null);
    }
  };

  const handleRenameAnalysis = async (analysisId, newName) => {
    if (!newName.trim()) return;

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/analyses/${analysisId}`, {
        method: 'PATCH',
        headers: {
          'x-user-id': userId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileName: newName.trim() })
      });

      if (res.ok) {
        setAnalyses(prev => prev.map(a => 
          a._id === analysisId ? { ...a, fileName: newName.trim() } : a
        ));
        setEditingId(null);
        setEditingName('');
      } else {
        throw new Error('Failed to rename analysis');
      }
    } catch (error) {
      console.error('Error renaming analysis:', error);
      alert('Failed to rename analysis. Please try again.');
    }
  };

  const startEditing = (analysis, e) => {
    e.stopPropagation();
    setEditingId(analysis._id);
    setEditingName(analysis.fileName);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleAnalysisClick = (analysisId) => {
    if (editingId) return; // Don't navigate while editing
    navigate(`/analysis/${analysisId}`);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return 'Invalid date';
    }
  };

  const filteredAnalyses = analyses.filter(analysis =>
    analysis.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isLoaded || loading) {
    return <FullPageLoader />;
  }

  return (
    <DashboardLayout>
      <div style={{
        padding: '2rem',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: '#1e293b',
              margin: '0 0 0.5rem 0'
            }}>
              My Analyses
            </h1>
            <p style={{
              color: '#64748b',
              margin: 0,
              fontSize: '1rem'
            }}>
              {analyses.length} analysis{analyses.length !== 1 ? 'es' : ''} found
            </p>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            {/* Search */}
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}>
              <Search size={18} color="#64748b" style={{ position: 'absolute', left: '12px' }} />
              <input
                type="text"
                placeholder="Search analyses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  fontSize: '0.9rem',
                  width: '250px',
                  outline: 'none'
                }}
              />
            </div>

            {/* View Mode Toggle */}
            <div style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '12px',
              padding: '0.25rem'
            }}>
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: viewMode === 'grid' ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: viewMode === 'grid' ? '#667eea' : '#64748b',
                  fontSize: '0.85rem',
                  fontWeight: '500'
                }}
              >
                <Grid size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: viewMode === 'list' ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: viewMode === 'list' ? '#667eea' : '#64748b',
                  fontSize: '0.85rem',
                  fontWeight: '500'
                }}
              >
                <List size={16} />
              </button>
            </div>

            {/* New Analysis Button */}
            <button
              onClick={() => navigate('/analysis')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
              }}
            >
              <Plus size={16} />
              New Analysis
            </button>
          </div>
        </div>

        {/* Content */}
        <div>
          {loading ? (
            <FullPageLoader />
          ) : error ? (
            <div style={{
              textAlign: 'center',
              padding: '4rem 2rem',
              color: '#64748b'
            }}>
              <AlertTriangle size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: '600' }}>
                Error Loading Analyses
              </h3>
              <p style={{ margin: 0, fontSize: '0.95rem' }}>{error}</p>
            </div>
          ) : analyses.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '4rem 2rem',
              color: '#64748b'
            }}>
              <FileSpreadsheet size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: '600' }}>
                No Analyses Found
              </h3>
              <p style={{ margin: '0 0 2rem 0', fontSize: '0.95rem' }}>
                Get started by uploading your first marketing data file
              </p>
              <button
                onClick={() => navigate('/analysis')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  margin: '0 auto'
                }}
              >
                <Plus size={16} />
                Create Your First Analysis
              </button>
            </div>
          ) : (
            <div style={{
              display: viewMode === 'grid' ? 'grid' : 'flex',
              flexDirection: viewMode === 'list' ? 'column' : undefined,
              gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(350px, 1fr))' : undefined,
              gap: '1.5rem'
            }}>
              {filteredAnalyses.map((analysis) => (
                <AnalysisCard
                  key={analysis._id}
                  analysis={analysis}
                  viewMode={viewMode}
                  onAnalysisClick={handleAnalysisClick}
                  onDelete={handleDeleteAnalysis}
                  onStartEdit={startEditing}
                  editingId={editingId}
                  editingName={editingName}
                  setEditingName={setEditingName}
                  onRename={handleRenameAnalysis}
                  onCancelEdit={cancelEditing}
                  formatDate={formatDate}
                  formatFileSize={formatFileSize}
                />
              ))}
            </div>
          )}
        </div>
      </div>

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
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'transparent',
                  border: '1px solid rgba(0, 0, 0, 0.2)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  color: '#374151'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAnalysis}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#8b5cf6',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  color: 'white',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#7c3aed';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#8b5cf6';
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

const AnalysisCard = ({ 
  analysis, 
  viewMode, 
  onAnalysisClick, 
  onDelete, 
  onStartEdit,
  editingId,
  editingName,
  setEditingName,
  onRename,
  onCancelEdit,
  formatDate, 
  formatFileSize 
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const isEditing = editingId === analysis._id;

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(20px)',
    padding: viewMode === 'grid' ? '2rem' : '1.5rem',
    borderRadius: '20px',
    cursor: isEditing ? 'default' : 'pointer',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    transition: 'all 0.3s ease',
    transform: 'translateY(0)',
    position: 'relative',
    display: viewMode === 'list' ? 'flex' : 'block',
    alignItems: viewMode === 'list' ? 'center' : undefined,
    gap: viewMode === 'list' ? '2rem' : undefined
  };

  return (
    <div
      style={cardStyle}
      onClick={() => onAnalysisClick(analysis._id)}
      onMouseEnter={(e) => {
        if (!isEditing) {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.12)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isEditing) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.06)';
        }
      }}
    >
      {/* Menu Button */}
      <div style={{
        position: 'absolute',
        top: '1rem',
        right: '1rem',
        zIndex: 10
      }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          style={{
            padding: '0.5rem',
            background: 'rgba(255, 255, 255, 0.8)',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}
        >
          <MoreVertical size={16} color="#64748b" />
        </button>
        
        {showMenu && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.5rem',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            minWidth: '150px',
            zIndex: 20
          }}>
            <button
              onClick={(e) => {
                onStartEdit(analysis, e);
                setShowMenu(false);
              }}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.9rem',
                color: '#374151',
                borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
              }}
            >
              <Edit3 size={14} />
              Rename
            </button>
            <button
              onClick={(e) => {
                onDelete(analysis);
                setShowMenu(false);
              }}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.9rem',
                color: '#ef4444'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(239, 68, 68, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
              }}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ 
        flex: viewMode === 'list' ? 1 : undefined,
        paddingRight: '3rem' 
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.75rem', 
          marginBottom: viewMode === 'grid' ? '1.5rem' : '0.5rem' 
        }}>
          <div style={{
            padding: '0.75rem',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FileSpreadsheet size={20} style={{ color: 'white' }} />
          </div>
          
          {isEditing ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              flex: 1
            }}>
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onRename(analysis._id, editingName);
                  } else if (e.key === 'Escape') {
                    onCancelEdit();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: '2px solid #3b82f6',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  outline: 'none'
                }}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRename(analysis._id, editingName);
                }}
                style={{
                  padding: '0.5rem',
                  background: '#10b981',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: 'white'
                }}
              >
                <Check size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelEdit();
                }}
                style={{
                  padding: '0.5rem',
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: 'white'
                }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <h3 style={{ 
              margin: 0, 
              color: '#1e293b', 
              fontSize: viewMode === 'grid' ? '1.1rem' : '1rem', 
              fontWeight: '600',
              flex: 1,
              wordBreak: 'break-word'
            }}>
              {analysis.fileName}
            </h3>
          )}
        </div>

        <div style={{ 
          display: 'flex', 
          gap: viewMode === 'grid' ? '2rem' : '1rem', 
          marginBottom: viewMode === 'grid' ? '1.5rem' : '0',
          flexWrap: 'wrap'
        }}>
          <div>
            <div style={{ 
              color: '#64748b', 
              fontSize: '0.8rem', 
              marginBottom: '0.25rem',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              <span className="tossface" style={{ marginRight: '0.25rem' }}>📅</span>
              Created
            </div>
            <div style={{ color: '#1e293b', fontSize: '0.9rem', fontWeight: '600' }}>
              {formatDate(analysis.createdAt)}
            </div>
          </div>
          <div>
            <div style={{ 
              color: '#64748b', 
              fontSize: '0.8rem', 
              marginBottom: '0.25rem',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              <span className="tossface" style={{ marginRight: '0.25rem' }}>💾</span>
              Size
            </div>
            <div style={{ color: '#1e293b', fontSize: '0.9rem', fontWeight: '600' }}>
              {formatFileSize(analysis.fileSize)}
            </div>
          </div>
        </div>

        {viewMode === 'grid' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#64748b',
            fontSize: '0.85rem',
            fontWeight: '500'
          }}>
            <Activity size={14} />
            <span>Last analyzed {formatDate(analysis.updatedAt)}</span>
          </div>
        )}
      </div>

      {viewMode === 'list' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          color: '#64748b',
          fontSize: '0.85rem'
        }}>
          <span className="tossface">⚡</span>
          <span>Last analyzed {formatDate(analysis.updatedAt)}</span>
        </div>
      )}
    </div>
  );
};

export default Dashboard;