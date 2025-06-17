import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Lightbulb, 
  TrendingUp, 
  Target, 
  AlertTriangle, 
  CheckCircle,
  Loader,
  RefreshCw,
  Zap,
  BarChart3
} from 'lucide-react';

const AIInsights = ({ analysisData, pivotData, classifiedData }) => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [insightType, setInsightType] = useState('general');

  useEffect(() => {
    if (analysisData && analysisData.length > 0) {
      generateInsights('general');
    }
  }, [analysisData]);

  const generateInsights = async (type = 'general') => {
    if (!analysisData || analysisData.length === 0) {
      setError('No data available for analysis');
      return;
    }

    setLoading(true);
    setError(null);
    setInsightType(type);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: analysisData.slice(0, 100), // Limit data size for API call
          analysisType: type,
          pivotSummary: pivotData ? pivotData.slice(0, 10) : null,
          classificationSummary: classifiedData ? getClassificationSummary(classifiedData) : null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to generate insights');
      }

      const result = await response.json();
      
      if (result.success && result.insights) {
        setInsights(parseInsights(result.insights));
      } else {
        throw new Error('Invalid response from AI service');
      }

    } catch (error) {
      console.error('AI Insights Error:', error);
      setError(error.message || 'Failed to generate AI insights');
    } finally {
      setLoading(false);
    }
  };

  const getClassificationSummary = (classifiedData) => {
    const summary = {};
    classifiedData.forEach(item => {
      const className = item.performanceClass || 'unclassified';
      summary[className] = (summary[className] || 0) + 1;
    });
    return summary;
  };

  const parseInsights = (rawInsights) => {
    // Try to parse structured insights from AI response
    const sections = [];
    const lines = rawInsights.split('\n').filter(line => line.trim());

    let currentSection = null;
    let currentContent = [];

    lines.forEach(line => {
      const trimmedLine = line.trim();
      
      // Check if line is a header/section title
      if (trimmedLine.match(/^(#+|\*\*|##|\d+\.)\s*(.+)/)) {
        // Save previous section
        if (currentSection) {
          sections.push({
            ...currentSection,
            content: currentContent.join(' ')
          });
        }
        
        // Start new section
        const title = trimmedLine.replace(/^(#+|\*\*|##|\d+\.)\s*/, '').replace(/\*\*/g, '');
        currentSection = {
          title: title,
          type: detectSectionType(title)
        };
        currentContent = [];
      } else if (trimmedLine && currentSection) {
        currentContent.push(trimmedLine);
      } else if (trimmedLine && !currentSection) {
        // First content without explicit section
        currentSection = {
          title: 'Key Insights',
          type: 'insight'
        };
        currentContent = [trimmedLine];
      }
    });

    // Add final section
    if (currentSection) {
      sections.push({
        ...currentSection,
        content: currentContent.join(' ')
      });
    }

    // If no sections found, create default section
    if (sections.length === 0) {
      sections.push({
        title: 'AI Analysis',
        type: 'insight',
        content: rawInsights
      });
    }

    return sections;
  };

  const detectSectionType = (title) => {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('recommendation') || titleLower.includes('action')) {
      return 'recommendation';
    } else if (titleLower.includes('insight') || titleLower.includes('analysis')) {
      return 'insight';
    } else if (titleLower.includes('optimization') || titleLower.includes('budget')) {
      return 'optimization';
    } else if (titleLower.includes('trend') || titleLower.includes('pattern')) {
      return 'trend';
    } else if (titleLower.includes('warning') || titleLower.includes('alert')) {
      return 'warning';
    }
    return 'insight';
  };

  const getSectionIcon = (type) => {
    switch (type) {
      case 'recommendation': return <Target size={20} />;
      case 'optimization': return <TrendingUp size={20} />;
      case 'trend': return <BarChart3 size={20} />;
      case 'warning': return <AlertTriangle size={20} />;
      default: return <Lightbulb size={20} />;
    }
  };

  const getSectionColor = (type) => {
    switch (type) {
      case 'recommendation': return '#10b981';
      case 'optimization': return '#3b82f6';
      case 'trend': return '#8b5cf6';
      case 'warning': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const insightTypes = [
    { id: 'general', label: 'General Analysis', icon: <Brain size={16} /> },
    { id: 'performance', label: 'Performance Review', icon: <TrendingUp size={16} /> },
    { id: 'optimization', label: 'Optimization Tips', icon: <Target size={16} /> },
    { id: 'creative', label: 'Creative Analysis', icon: <Zap size={16} /> }
  ];

  return (
    <div className="ai-insights">
      <div className="ai-insights-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Brain size={24} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
              AI-Powered Insights
            </h2>
            <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: 0 }}>
              Advanced analysis powered by Gemini AI
            </p>
          </div>
        </div>
        
        <button
          onClick={() => generateInsights(insightType)}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'rgba(255, 255, 255, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '6px',
            color: 'white',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="ai-insights-content">
        {/* Insight Type Selector */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '2rem',
          flexWrap: 'wrap'
        }}>
          {insightTypes.map(type => (
            <button
              key={type.id}
              onClick={() => generateInsights(type.id)}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                border: `1px solid ${insightType === type.id ? '#f59e0b' : '#e5e7eb'}`,
                borderRadius: '6px',
                background: insightType === type.id ? '#fef3c7' : 'white',
                color: insightType === type.id ? '#92400e' : '#6b7280',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              {type.icon}
              {type.label}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="ai-insight-card loading">
            <div style={{ textAlign: 'center' }}>
              <Loader size={40} color="#f59e0b" className="animate-spin" />
              <div style={{ 
                marginTop: '1rem', 
                fontSize: '1rem', 
                fontWeight: '500',
                color: '#374151'
              }}>
                Generating AI insights...
              </div>
              <div style={{ 
                marginTop: '0.5rem', 
                fontSize: '0.875rem', 
                color: '#6b7280'
              }}>
                This may take a few moments
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="ai-insight-card" style={{ 
            border: '1px solid #fecaca',
            background: '#fef2f2'
          }}>
            <div className="ai-insight-title" style={{ color: '#dc2626' }}>
              <AlertTriangle size={20} />
              Error Generating Insights
            </div>
            <div style={{ color: '#991b1b' }}>
              {error}
            </div>
            <button
              onClick={() => generateInsights(insightType)}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Insights Display */}
        {insights && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {insights.map((section, index) => (
              <div key={index} className="ai-insight-card animate-fadeIn">
                <div 
                  className="ai-insight-title"
                  style={{ color: getSectionColor(section.type) }}
                >
                  {getSectionIcon(section.type)}
                  {section.title}
                </div>
                <div className="ai-insight-text">
                  {section.content}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No Data State */}
        {!analysisData || analysisData.length === 0 ? (
          <div className="ai-insight-card" style={{ textAlign: 'center' }}>
            <div className="ai-insight-title">
              <Brain size={20} />
              No Data Available
            </div>
            <div style={{ color: '#6b7280' }}>
              Upload campaign data to generate AI-powered insights
            </div>
          </div>
        ) : null}

        {/* Feature Info */}
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '8px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.5rem',
            color: '#166534',
            fontWeight: '600'
          }}>
            <CheckCircle size={16} />
            AI Insights Features
          </div>
          <div style={{ 
            fontSize: '0.875rem', 
            color: '#166534',
            lineHeight: 1.5
          }}>
            • Performance pattern analysis • Budget optimization recommendations<br />
            • Creative effectiveness insights • Audience targeting suggestions<br />
            • Trend identification • Automated action items
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIInsights;