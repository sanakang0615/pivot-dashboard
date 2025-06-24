import React from 'react';
import { BarChart3, Database, FileText, Brain, TrendingUp } from 'lucide-react';

const ContextSelector = ({ analysisData, onSelect, selectedContexts, onClose }) => {
  const getContextOptions = () => {
    const options = [];

    // Raw Data
    if (analysisData?.rawData && analysisData.rawData.length > 0) {
      options.push({
        id: 'raw_data',
        name: 'Raw Data',
        description: `${analysisData.rawData.length} rows of original data`,
        icon: <Database size={16} />,
        type: 'data',
        data: analysisData.rawData.slice(0, 100) // Limit for context
      });
    }

    // Pivot Tables
    if (analysisData?.pivotTables) {
      Object.entries(analysisData.pivotTables).forEach(([level, data]) => {
        if (Array.isArray(data) && data.length > 0) {
          options.push({
            id: `pivot_${level.toLowerCase()}`,
            name: `${level} Performance`,
            description: `Pivot table with ${data.length} ${level.toLowerCase()} entries`,
            icon: <BarChart3 size={16} />,
            type: 'pivot',
            data: data
          });
        }
      });
    }

    // Heatmap (if available)
    if (analysisData?.heatmapImage || (analysisData?.pivotTables?.Campaign && analysisData.pivotTables.Campaign.length > 0)) {
      const heatmapData = analysisData.heatmapImage ? [analysisData.heatmapImage] : [];
      
      // 콘솔에 히트맵 데이터 로그 추가
      // console.log('🔥 Performance Heatmap Context Data:');
      // console.log('📊 Has heatmapImage:', !!analysisData.heatmapImage);
      // console.log('📏 Image data length:', analysisData.heatmapImage ? analysisData.heatmapImage.length : 0);
      // console.log('🖼️ Image data preview:', analysisData.heatmapImage ? analysisData.heatmapImage.substring(0, 100) + '...' : 'No image');
      // console.log('📦 Final data array:', heatmapData);
      
      options.push({
        id: 'performance_heatmap',
        name: 'Performance Heatmap',
        description: 'Visual representation of campaign performance',
        icon: <TrendingUp size={16} />,
        type: 'visualization',
        data: heatmapData
      });
    }

    // AI Analysis Report
    if (analysisData?.insights) {
      options.push({
        id: 'ai_report',
        name: 'AI Analysis Report',
        description: 'Complete AI-generated insights and recommendations',
        icon: <Brain size={16} />,
        type: 'report',
        data: analysisData.insights
      });
    }

    return options;
  };

  const contextOptions = getContextOptions();
  const isSelected = (contextId) => selectedContexts.some(c => c.id === contextId);

  const getTypeColor = (type) => {
    switch (type) {
      case 'data': return '#3b82f6';
      case 'pivot': return '#10b981';
      case 'visualization': return '#8b5cf6';
      case 'report': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getTypeBg = (type) => {
    switch (type) {
      case 'data': return 'rgba(59, 130, 246, 0.1)';
      case 'pivot': return 'rgba(16, 185, 129, 0.1)';
      case 'visualization': return 'rgba(139, 92, 246, 0.1)';
      case 'report': return 'rgba(245, 158, 11, 0.1)';
      default: return 'rgba(107, 114, 128, 0.1)';
    }
  };

  return (
    <div 
      data-context-selector
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        marginLeft: '0.5rem',
        marginRight: '0.5rem',
        marginBottom: '0.5rem',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        maxHeight: '300px',
        maxWidth: '450px',
        overflowY: 'auto',
        zIndex: 20
      }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1rem 0.5rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.3)'
      }}>
        <h4 style={{
          fontSize: '0.9rem',
          fontWeight: '800',
          color: '#1e293b',
          margin: 0,
          marginBottom: '0.25rem'
        }}>
          Add Context to Your Question
        </h4>
        <p style={{
          fontSize: '0.8rem',
          color: '#64748b',
          margin: 0
        }}>
          Select data sources to include in your conversation
        </p>
      </div>

      {/* Options */}
      <div style={{ padding: '0.5rem' }}>
        {contextOptions.length === 0 ? (
          <div style={{
            padding: '1rem',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '0.8rem'
          }}>
            <FileText size={24} color="#d1d5db" style={{ marginBottom: '0.5rem' }} />
            <p style={{ margin: 0 }}>No data available to add as context</p>
          </div>
        ) : (
          contextOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => onSelect(option)}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: isSelected(option.id) 
                  ? getTypeBg(option.type)
                  : 'transparent',
                border: isSelected(option.id)
                  ? `1px solid ${getTypeColor(option.type)}40`
                  : '1px solid transparent',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.7rem',
                textAlign: 'left',
                marginBottom: '0.1rem'
              }}
              onMouseEnter={(e) => {
                if (!isSelected(option.id)) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected(option.id)) {
                  e.target.style.background = 'transparent';
                }
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                background: getTypeBg(option.type),
                border: `1px solid ${getTypeColor(option.type)}40`,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <span style={{ color: getTypeColor(option.type) }}>
                  {option.icon}
                </span>
              </div>
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: '0.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  {option.name}
                  {isSelected(option.id) && (
                    <div style={{
                      width: '6px',
                      height: '6px',
                      background: getTypeColor(option.type),
                      borderRadius: '50%'
                    }} />
                  )}
                </div>
                <div style={{
                  fontSize: '0.6rem',
                  color: '#64748b',
                  lineHeight: '1.3'
                }}>
                  {option.description}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      {contextOptions.length > 0 && (
        <div style={{
          padding: '0.75rem 1rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.3)',
          background: 'rgba(102, 126, 234, 0.05)'
        }}>
          <p
          className="Pretendard"
          style={{
            fontSize: '0.8rem',
            color: '#475569',
            margin: 0,
            lineHeight: '1.4'
          }}>
            <span className="tossface">💡</span> Selected contexts will be included in your question to help the AI provide more accurate and specific answers.
          </p>
        </div>
      )}
    </div>
  );
};

export default ContextSelector; 