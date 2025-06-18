import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart3, 
  FileSpreadsheet, 
  Calendar, 
  Activity,
  ChevronRight,
  Plus
} from 'lucide-react';

const Sidebar = ({ analyses, onAnalysisClick, currentAnalysisId }) => {
  const navigate = useNavigate();

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return date.toLocaleDateString();
  };

  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    if (extension === 'csv') {
      return <FileSpreadsheet size={16} color="#84cc16" />;
    } else if (['xlsx', 'xls'].includes(extension)) {
      return <FileSpreadsheet size={16} color="#3b82f6" />;
    }
    return <FileSpreadsheet size={16} color="#6b7280" />;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'processing': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div style={{
          width: '32px',
          height: '32px',
          background: 'linear-gradient(135deg, #84cc16, #65a30d)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white'
        }}>
          <BarChart3 size={20} />
        </div>
        <div>
          <div className="sidebar-title">Marketing Analyzer</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            Analysis Dashboard
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            background: 'linear-gradient(135deg, #84cc16, #65a30d)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            marginBottom: '0.5rem'
          }}
        >
          <Plus size={16} />
          New Analysis
        </button>
        
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            background: 'white',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}
        >
          <BarChart3 size={16} />
          Dashboard
        </button>
      </div>

      {/* Analyses List */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">
          Recent Analyses
        </div>
        
        {analyses && analyses.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {analyses.slice(0, 10).map((analysis) => (
              <div
                key={analysis._id}
                className={`analysis-item ${analysis._id === currentAnalysisId ? 'active' : ''}`}
                onClick={() => onAnalysisClick(analysis._id)}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}>
                  <div style={{
                    marginTop: '0.125rem',
                    flexShrink: 0
                  }}>
                    {getFileIcon(analysis.fileName)}
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="analysis-item-name">
                      {analysis.fileName}
                    </div>
                    <div className="analysis-item-meta">
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '0.25rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Calendar size={10} />
                          {formatDate(analysis.createdAt)}
                        </div>
                        
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: getStatusColor(analysis.status),
                          flexShrink: 0
                        }} />
                      </div>
                      
                      {analysis.fileSize && (
                        <div style={{ 
                          fontSize: '0.65rem', 
                          color: '#9ca3af',
                          marginTop: '0.125rem'
                        }}>
                          {(analysis.fileSize / 1024).toFixed(1)} KB
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {analysis._id === currentAnalysisId && (
                    <ChevronRight size={12} color="#84cc16" />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            padding: '2rem 1rem',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            <FileSpreadsheet size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              No analyses yet
            </div>
            <div style={{ fontSize: '0.75rem', lineHeight: 1.4 }}>
              Upload your first campaign data to get started
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {analyses && analyses.length > 0 && (
        <div className="sidebar-section" style={{ marginTop: 'auto' }}>
          <div className="sidebar-section-title">
            Quick Stats
          </div>
          
          <div style={{
            background: '#f9fafb',
            borderRadius: '8px',
            padding: '1rem',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Total Files</span>
              <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>{analyses.length}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Completed</span>
              <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>
                {analyses.filter(a => a.status === 'completed').length}
              </span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>This Week</span>
              <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>
                {analyses.filter(a => {
                  const uploadDate = new Date(a.uploadDate);
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return uploadDate > weekAgo;
                }).length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: '1rem 0',
        borderTop: '1px solid #e5e7eb',
        marginTop: 'auto'
      }}>
        <div style={{ 
          fontSize: '0.65rem', 
          color: '#9ca3af',
          textAlign: 'center'
        }}>
          Marketing Analyzer v1.0
          <br />
          Built for performance marketers
        </div>
      </div>
    </div>
  );
};

export default Sidebar;