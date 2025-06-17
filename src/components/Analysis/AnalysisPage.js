import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, UserButton } from '@clerk/clerk-react';
import { ArrowLeft, Menu, X, FileText, ArrowRight, Download, Share2, BarChart3 } from 'lucide-react';
import HeatmapChart from '../HeatmapChart';

const AnalysisPage = () => {
  const { analysisId } = useParams();
  const { userId, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [analysis, setAnalysis] = useState(location.state?.analysis || null);
  const [loading, setLoading] = useState(!location.state?.analysis);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [analysisList, setAnalysisList] = useState([]);

  useEffect(() => {
    if (analysisId && userId && isSignedIn) {
      if (!location.state?.analysis) {
        fetchAnalysis();
      }
      fetchAnalysisList();
    } else if (!isSignedIn) {
      navigate('/');
    }
  }, [analysisId, userId, isSignedIn, location.state]);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/analysis/${analysisId}`, {
        headers: {
          'x-user-id': userId,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch analysis: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setAnalysis(data.analysis);
      } else {
        throw new Error(data.error || 'Failed to load analysis');
      }
    } catch (err) {
      console.error('Error fetching analysis:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalysisList = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/analysis/list`, {
        headers: {
          'x-user-id': userId
        }
      });
      const result = await response.json();
      if (result.success) {
        setAnalysisList(result.analyses || []);
      }
    } catch (error) {
      console.error('Failed to fetch analysis list:', error);
    }
  };

  const formatNumber = (num) => {
    if (typeof num === 'string') {
      return num;
    }
    return num ? num.toLocaleString() : '0';
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fafbff 0%, #f8fafc 50%, #f1f5f9 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          padding: '3rem 2rem',
          textAlign: 'center',
          maxWidth: '400px',
          margin: '0 1rem',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            margin: '0 auto 2rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pulse 2s infinite'
          }}>
            <span className="tossface" style={{ fontSize: '1.8rem' }}>📊</span>
          </div>
          
          <h3 style={{
            fontSize: '1.2rem',
            fontWeight: '700',
            color: '#1e293b',
            margin: 0,
            marginBottom: '0.5rem'
          }}>
            Loading Analysis
          </h3>
          
          <p style={{
            color: '#64748b',
            fontSize: '0.95rem',
            margin: 0
          }}>
            Retrieving your analysis results...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fafbff 0%, #f8fafc 50%, #f1f5f9 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '2rem'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          padding: '3rem 2rem',
          textAlign: 'center',
          maxWidth: '500px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 2rem',
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span className="tossface" style={{ fontSize: '2rem' }}>❌</span>
          </div>
          
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#1e293b',
            margin: 0,
            marginBottom: '1rem'
          }}>
            Error Loading Analysis
          </h2>
          
          <p style={{
            color: '#64748b',
            fontSize: '1rem',
            margin: 0,
            marginBottom: '2rem',
            lineHeight: '1.5'
          }}>
            {error}
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: 'rgba(255, 255, 255, 0.8)',
                color: '#374151',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: '600',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.2s ease'
              }}
            >
              Back to Dashboard
            </button>
            
            <button
              onClick={() => navigate('/analysis')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #000000 0%, #1c1c1e 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                transition: 'all 0.2s ease'
              }}
            >
              <span className="tossface">🆕</span>
              New Analysis
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fafbff 0%, #f8fafc 50%, #f1f5f9 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '2rem'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          padding: '3rem 2rem',
          textAlign: 'center',
          maxWidth: '500px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 2rem',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span className="tossface" style={{ fontSize: '2rem' }}>🔍</span>
          </div>
          
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#1e293b',
            margin: 0,
            marginBottom: '1rem'
          }}>
            Analysis Not Found
          </h2>
          
          <p style={{
            color: '#64748b',
            fontSize: '1rem',
            margin: 0,
            marginBottom: '2rem',
            lineHeight: '1.5'
          }}>
            The analysis you're looking for doesn't exist or has been removed.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: 'rgba(255, 255, 255, 0.8)',
                color: '#374151',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: '600',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.2s ease'
              }}
            >
              Back to Dashboard
            </button>
            
            <button
              onClick={() => navigate('/analysis')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #000000 0%, #1c1c1e 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                transition: 'all 0.2s ease'
              }}
            >
              <span className="tossface">🆕</span>
              New Analysis
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fafbff 0%, #f8fafc 50%, #f1f5f9 100%)',
      fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative'
    }}>
      {/* Global Auth Header */}
      <div style={{
        width: '100%',
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        {/* Left side - Menu and Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              background: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(10px)'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.95)';
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.8)';
              e.target.style.transform = 'scale(1)';
            }}
          >
            <Menu size={20} color="#374151" />
          </button>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer'
          }}
          onClick={() => navigate('/')}>
            <div style={{
              width: '32px',
              height: '32px',
              background: 'linear-gradient(135deg, #000000 0%, #1c1c1e 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}>
              <span className="tossface" style={{ fontSize: '1.2rem' }}>🏝️</span>
            </div>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: '800',
              color: '#1e293b',
              margin: 0,
              letterSpacing: '-0.02em'
            }}>
              AdOasis
            </h1>
          </div>

          {/* Back to Analysis Button */}
          <button
            onClick={() => navigate('/analysis')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#374151',
              fontSize: '0.9rem',
              fontWeight: '500',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.95)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.8)';
            }}
          >
            <ArrowLeft size={16} />
            New Analysis
          </button>
        </div>

        {/* Right side - Auth */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem' 
        }}>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#374151',
              fontSize: '0.9rem',
              fontWeight: '500',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.95)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.8)';
            }}
          >
            <Share2 size={16} />
            Share
          </button>

          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#374151',
              fontSize: '0.9rem',
              fontWeight: '500',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.95)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.8)';
            }}
          >
            <Download size={16} />
            Export
          </button>
          
          <UserButton 
            afterSignOutUrl="/" 
            appearance={{
              elements: {
                avatarBox: {
                  width: '36px',
                  height: '36px'
                }
              }
            }}
          />
        </div>
      </div>

      {/* Sidebar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        width: '320px',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '4px 0 32px rgba(0, 0, 0, 0.08)',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease',
        zIndex: 999,
        overflow: 'hidden'
      }}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Sidebar Header */}
          <div style={{
            padding: '2rem 1.5rem 1rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.3)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem'
            }}>
              <h2 style={{
                fontSize: '1.2rem',
                fontWeight: '700',
                color: '#1e293b',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span className="tossface">📁</span>
                My Analyses
              </h2>
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>
          </div>

          {/* Sidebar Content */}
          <div style={{
            flex: 1,
            padding: '1rem',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {analysisList.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '2rem 1rem',
                  color: '#64748b'
                }}>
                  <span className="tossface" style={{ 
                    fontSize: '2rem',
                    display: 'block',
                    marginBottom: '1rem'
                  }}>📊</span>
                  <p style={{
                    fontSize: '0.9rem',
                    lineHeight: '1.5'
                  }}>
                    No analyses yet. Upload your first file to get started!
                  </p>
                </div>
              ) : (
                analysisList.map((analysisItem, index) => (
                  <div 
                    key={index} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      background: analysisItem.id === analysisId 
                        ? 'linear-gradient(135deg, #667eea20, #764ba220)'
                        : 'rgba(255, 255, 255, 0.7)',
                      border: analysisItem.id === analysisId 
                        ? '2px solid rgba(102, 126, 234, 0.3)'
                        : '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => navigate(`/analysis/${analysisItem.id}`)}
                    onMouseEnter={(e) => {
                      if (analysisItem.id !== analysisId) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (analysisItem.id !== analysisId) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }
                    }}
                  >
                    <FileText size={16} color={analysisItem.id === analysisId ? "#667eea" : "#64748b"} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: '0.85rem',
                        fontWeight: analysisItem.id === analysisId ? '600' : '500',
                        color: analysisItem.id === analysisId ? '#667eea' : '#374151',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {analysisItem.fileName || `Analysis ${index + 1}`}
                      </p>
                      <p style={{
                        fontSize: '0.75rem',
                        color: '#64748b',
                        margin: 0
                      }}>
                        {new Date(analysisItem.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {analysisItem.id !== analysisId && <ArrowRight size={14} color="#64748b" />}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.2)',
            backdropFilter: 'blur(4px)',
            zIndex: 998
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main style={{
        padding: '2rem',
        maxWidth: '1400px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Background Effects */}
        <div style={{
          position: 'absolute',
          top: '10%',
          left: '20%',
          width: '300px',
          height: '300px',
          background: 'linear-gradient(135deg, #667eea40, #764ba240)',
          borderRadius: '50%',
          filter: 'blur(100px)',
          zIndex: 0
        }} />
        <div style={{
          position: 'absolute',
          top: '60%',
          right: '10%',
          width: '200px',
          height: '200px',
          background: 'linear-gradient(135deg, #84cc1640, #65a30d40)',
          borderRadius: '50%',
          filter: 'blur(80px)',
          zIndex: 0
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Analysis Header */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            padding: '2rem',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
            marginBottom: '2rem'
          }}>
            <h2 style={{
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              fontWeight: '700',
              color: '#1e293b',
              margin: 0,
              marginBottom: '1rem',
              letterSpacing: '-0.01em'
            }}>
              <span className="tossface" style={{ marginRight: '0.5rem' }}>✨</span>
              Analysis Complete: {analysis.fileName}
            </h2>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2rem',
              flexWrap: 'wrap',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#64748b',
                fontSize: '0.95rem'
              }}>
                <span className="tossface">📊</span>
                Analyzed {analysis.metadata?.rowCount?.toLocaleString() || 0} rows of data
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#64748b',
                fontSize: '0.95rem'
              }}>
                <span className="tossface">📅</span>
                {new Date(analysis.createdAt).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem 1.5rem',
                  background: 'linear-gradient(135deg, #000000 0%, #1c1c1e 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                }}
              >
                <span className="tossface">📊</span>
                Go to Dashboard
              </button>
              
              <button
                onClick={() => navigate('/analysis')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem 1.5rem',
                  background: 'rgba(255, 255, 255, 0.8)',
                  color: '#374151',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.95)';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.8)';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                <span className="tossface">🔄</span>
                New Analysis
              </button>
            </div>
          </div>

          {/* Pivot Tables */}
          {analysis.pivotTables && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
              gap: '1.5rem',
              marginBottom: '2rem'
            }}>
              {Object.entries(analysis.pivotTables).map(([level, data]) => (
                <PivotTableCard 
                  key={level} 
                  level={level} 
                  data={data} 
                  formatNumber={formatNumber} 
                />
              ))}
            </div>
          )}

          {/* Heatmap */}
          {analysis.pivotTables?.Campaign && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(20px)',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
              marginBottom: '2rem'
            }}>
              <div style={{ padding: '2rem 2rem 1rem' }}>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: '#1e293b',
                  margin: 0,
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span className="tossface">🌡️</span>
                  Performance Heatmap
                </h3>
                <p style={{
                  color: '#64748b',
                  margin: 0,
                  fontSize: '0.95rem'
                }}>
                  Visual representation of key metrics across campaigns
                </p>
              </div>
              <div style={{ padding: '0 2rem 2rem' }}>
                <HeatmapChart 
                  data={analysis.pivotTables.Campaign}
                  title="Campaign Performance Heatmap"
                />
              </div>
            </div>
          )}

          {/* AI Insights Report */}
          {analysis.insights && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(20px)',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)'
            }}>
              <div style={{ padding: '2rem 2rem 1rem' }}>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: '#1e293b',
                  margin: 0,
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span className="tossface">🤖</span>
                  AI Analysis Report
                </h3>
                <p style={{
                  color: '#64748b',
                  margin: 0,
                  fontSize: '0.95rem'
                }}>
                  Gemini AI-generated insights and recommendations
                </p>
              </div>
              <div style={{ padding: '0 2rem 2rem' }}>
                <div style={{
                  background: 'rgba(102, 126, 234, 0.05)',
                  padding: '1.5rem',
                  borderRadius: '16px',
                  border: '1px solid rgba(102, 126, 234, 0.1)'
                }}>
                  <div style={{
                    whiteSpace: 'pre-wrap',
                    color: '#374151',
                    lineHeight: '1.7',
                    fontSize: '0.95rem'
                  }}>
                    {analysis.insights}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// Pivot Table Card Component
const PivotTableCard = ({ level, data, formatNumber }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(20px)',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
    overflow: 'hidden'
  }}>
    <div style={{ padding: '1.5rem 2rem 1rem' }}>
      <h3 style={{
        fontSize: '1.1rem',
        fontWeight: '700',
        color: '#1e293b',
        margin: 0,
        marginBottom: '0.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <span className="tossface">
          {level === 'Campaign' ? '🎯' : level === 'Ad Set' ? '📦' : '📄'}
        </span>
        {level} Performance
      </h3>
      <p style={{
        color: '#64748b',
        margin: 0,
        fontSize: '0.85rem'
      }}>
        {data.length} items analyzed
      </p>
    </div>
    
    <div style={{ padding: '0 1rem 1.5rem' }}>
      <div style={{ 
        overflowX: 'auto',
        background: 'rgba(102, 126, 234, 0.05)',
        borderRadius: '12px',
        border: '1px solid rgba(102, 126, 234, 0.1)'
      }}>
        <table style={{ 
          width: '100%', 
          fontSize: '0.85rem',
          borderCollapse: 'collapse'
        }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(102, 126, 234, 0.15)' }}>
              <th style={{
                textAlign: 'left',
                padding: '1rem 0.75rem',
                fontWeight: '600',
                color: '#475569',
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {level}
              </th>
              <th style={{
                textAlign: 'right',
                padding: '1rem 0.75rem',
                fontWeight: '600',
                color: '#475569',
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Impressions
              </th>
              <th style={{
                textAlign: 'right',
                padding: '1rem 0.75rem',
                fontWeight: '600',
                color: '#475569',
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                CTR
              </th>
              <th style={{
                textAlign: 'right',
                padding: '1rem 0.75rem',
                fontWeight: '600',
                color: '#475569',
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Conversions
              </th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 6).map((row, idx) => (
              <tr key={idx} style={{
                borderBottom: '1px solid rgba(102, 126, 234, 0.08)',
                transition: 'background 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(102, 126, 234, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}>
                <td style={{
                  padding: '0.75rem',
                  maxWidth: '120px'
                }}>
                  <div style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: '500',
                    color: '#374151'
                  }} title={row[level]}>
                    {row[level]}
                  </div>
                </td>
                <td style={{
                  textAlign: 'right',
                  padding: '0.75rem',
                  color: '#1e293b',
                  fontWeight: '600'
                }}>
                  {formatNumber(row.Impression)}
                </td>
                <td style={{
                  textAlign: 'right',
                  padding: '0.75rem',
                  color: '#1e293b',
                  fontWeight: '600'
                }}>
                  {row.CTR}
                </td>
                <td style={{
                  textAlign: 'right',
                  padding: '0.75rem',
                  color: '#1e293b',
                  fontWeight: '600'
                }}>
                  {formatNumber(row.Purchase)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 6 && (
          <div style={{
            textAlign: 'center',
            padding: '1rem',
            color: '#64748b',
            fontSize: '0.85rem',
            fontStyle: 'italic'
          }}>
            <span className="tossface" style={{ marginRight: '0.5rem' }}>➕</span>
            {data.length - 6} more items available in full report
          </div>
        )}
      </div>
    </div>
  </div>
);

export default AnalysisPage;