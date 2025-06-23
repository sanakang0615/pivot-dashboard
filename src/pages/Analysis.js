import React, { useState, useEffect } from 'react';
import { useAuth, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { Menu, X, FileText, FolderOpen, ArrowRight, AlertTriangle } from 'lucide-react';
import ColumnMappingModal from '../components/ColumnMappingModal';
import HeatmapChart from '../components/HeatmapChart';
import Sidebar from '../components/Common/Sidebar';

const Analysis = () => {
  const { userId, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [fileData, setFileData] = useState(null);
  const [mappingResult, setMappingResult] = useState(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Login modal state
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Fetch user's analysis list
  useEffect(() => {
    if (isSignedIn && userId) {
      // The Sidebar component now fetches its own data
    }
  }, [isSignedIn, userId]);

  // Keyboard shortcut for sidebar
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'l') {
        event.preventDefault();
        // 다른 사이드바가 열려있으면 토글 무시
        // (이 페이지에서는 분석 사이드바만 있으므로 항상 토글 가능)
        setSidebarOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [sidebarOpen]); // 상태를 의존성에 포함

  // Handle file upload with login check
  const handleFileUpload = async (file) => {
    if (!isSignedIn) {
      setShowLoginModal(true);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/upload/extract-columns`, {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'File upload failed.');
      }
      
      setFileData(result);
      console.log('File uploaded, columns extracted:', result.columns);
      
      await suggestColumnMapping(result.columns, result.fileId);
      
    } catch (error) {
      console.error('File upload failed:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const suggestColumnMapping = async (columns, fileId) => {
    setLoading(true);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/mapping/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Column mapping suggestion failed.');
      }
      
      console.log('Column mapping suggested:', result);
      setMappingResult({ ...result, fileId });
      setShowMappingModal(true);
      setStep(2);
      
    } catch (error) {
      console.error('Column mapping suggestion failed:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const executeAnalysis = async (confirmedMapping) => {
    setLoading(true);
    setShowMappingModal(false);
    setStep(3);
    setError(null);
    
    try {
      // Execute analysis
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/analysis/execute`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({
          fileId: mappingResult.fileId,
          columnMapping: confirmedMapping
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Analysis execution failed.');
      }
      
      console.log('Analysis completed:', result);

      setAnalysisResult(result);
      
      // Navigate to the analysis result page
      if (result.analysisId) {
        // Show success state briefly before redirecting
        setTimeout(() => {
          navigate(`/analysis/${result.analysisId}`, { 
            state: { 
              analysis: result
            }
          });
        }, 1000);
      }
      
    } catch (error) {
      console.error('Analysis execution failed:', error);
      setError(error.message);
      setStep(2);
      setShowMappingModal(true);
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep(1);
    setFileData(null);
    setMappingResult(null);
    setShowMappingModal(false);
    setAnalysisResult(null);
    setError(null);
  };

  const formatNumber = (num) => {
    if (typeof num === 'string') {
      return num;
    }
    return num ? num.toLocaleString() : '0';
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fafbff 0%, #f8fafc 50%, #f1f5f9 100%)',
      fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative'
    }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
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
              backdropFilter: 'blur(10px)',
              title: 'Toggle Sidebar (⌘L)'
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
        </div>

        {/* Right side - Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {isSignedIn ? (
            <UserButton afterSignOutUrl="/" />
          ) : (
            <>
              <SignInButton mode="modal">
                <button className="auth-button">Log In</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="auth-button primary">Sign Up</button>
              </SignUpButton>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main style={{
        padding: '2rem',
        maxWidth: '1400px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Background Effects */}
        {/* Removed background gradient circles */}

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Hero Section */}
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '4rem'
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '20px',
              fontSize: '0.9rem',
              fontWeight: '500',
              color: '#64748b',
              marginBottom: '2rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)'
            }}>
              <span className="tossface" style={{ fontSize: '1.2rem' }}>🧠</span>
              AI-Powered Data Analysis
            </div>
            
            <h1 style={{
              fontSize: 'clamp(2.5rem, 6vw, 4rem)',
              fontWeight: '800',
              color: '#1e293b',
              marginBottom: '1rem',
              letterSpacing: '-0.03em',
              lineHeight: '1.1'
            }}>
              Transform Your Data
              <br />
              Into <span style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>Insights</span>
            </h1>
            
            <p style={{
              color: '#64748b',
              fontSize: 'clamp(1rem, 2vw, 1.2rem)',
              maxWidth: '600px',
              margin: '0 auto',
              lineHeight: '1.6',
              fontWeight: '400'
            }}>
              Upload your marketing campaign data and get AI-powered insights with actionable recommendations in minutes.
            </p>
          </div>

          {/* Progress Steps */}
          <div style={{ marginBottom: '4rem' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              {[
                { num: 1, label: 'Upload File', emoji: '📁' },
                { num: 2, label: 'Map Columns', emoji: '🔗' },
                { num: 3, label: 'View Results', emoji: '📊' }
              ].map((stepInfo, index) => (
                <div key={stepInfo.num} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1rem 1.5rem',
                    borderRadius: '16px',
                    background: step >= stepInfo.num 
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : 'rgba(255, 255, 255, 0.7)',
                    color: step >= stepInfo.num ? 'white' : '#64748b',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid ' + (step >= stepInfo.num ? 'transparent' : 'rgba(255, 255, 255, 0.3)'),
                    boxShadow: step >= stepInfo.num 
                      ? '0 8px 32px rgba(102, 126, 234, 0.25)'
                      : '0 4px 12px rgba(0, 0, 0, 0.05)',
                    transition: 'all 0.3s ease',
                    transform: step >= stepInfo.num ? 'translateY(-2px)' : 'translateY(0)'
                  }}>
                    <span className="tossface" style={{ fontSize: '1.3rem' }}>
                      {stepInfo.emoji}
                    </span>
                    <span style={{ fontWeight: '600', fontSize: '1rem' }}>
                      {stepInfo.label}
                    </span>
                  </div>
                  {index < 2 && (
                    <div style={{
                      width: '4rem',
                      height: '3px',
                      margin: '0 1rem',
                      background: step > stepInfo.num 
                        ? 'linear-gradient(90deg, #667eea, #764ba2)'
                        : 'rgba(0, 0, 0, 0.1)',
                      borderRadius: '2px',
                      transition: 'all 0.3s ease'
                    }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              marginBottom: '2rem',
              padding: '1.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(239, 68, 68, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="tossface" style={{ fontSize: '1.5rem' }}>❌</span>
                <div>
                  <h3 style={{ 
                    color: '#dc2626', 
                    margin: 0, 
                    fontSize: '1.1rem', 
                    fontWeight: '600',
                    marginBottom: '0.25rem'
                  }}>
                    Oops! Something went wrong
                  </h3>
                  <p style={{ color: '#b91c1c', margin: 0, fontSize: '0.95rem' }}>
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* File Upload Section */}
          {step === 1 && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(20px)',
              borderRadius: '24px',
              border: '2px dashed rgba(102, 126, 234, 0.3)',
              padding: '4rem 2rem',
              textAlign: 'center',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.3s ease',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
                style={{ display: 'none' }}
                id="file-upload"
                disabled={loading}
              />
              
              <label 
                htmlFor="file-upload" 
                style={{
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ marginBottom: '2rem' }}>
                  <div style={{
                    width: '120px',
                    height: '120px',
                    margin: '0 auto 2rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
                  }}>
                    <span className="tossface" style={{ 
                      fontSize: '3rem',
                      position: 'absolute',
                      top: '-10px',
                      right: '-10px',
                      background: 'rgba(255, 255, 255, 0.9)',
                      borderRadius: '16px',
                      padding: '0.5rem',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                    }}>
                      📊
                    </span>
                    <div style={{ color: 'white', fontSize: '2.5rem' }}>📁</div>
                  </div>
                </div>
                
                <h2 style={{
                  fontSize: 'clamp(1.5rem, 3vw, 2rem)',
                  fontWeight: '700',
                  color: '#1e293b',
                  marginBottom: '1rem',
                  letterSpacing: '-0.01em'
                }}>
                  Upload Your Marketing Data
                </h2>
                
                <p style={{
                  color: '#64748b',
                  fontSize: '1.1rem',
                  marginBottom: '2rem',
                  lineHeight: '1.6'
                }}>
                  Drop your CSV or Excel file here, or click to browse
                  <br />
                  <span style={{ fontSize: '0.95rem', opacity: 0.8 }}>
                    Maximum file size: 10MB
                  </span>
                </p>
                
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem 2rem',
                  background: 'linear-gradient(135deg, #000000 0%, #1c1c1e 100%)',
                  color: 'white',
                  borderRadius: '14px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.15)';
                  }
                }}>
                  <span className="tossface" style={{ fontSize: '1.2rem' }}>🚀</span>
                  Choose File
                </div>
                
                <div style={{
                  marginTop: '2rem',
                  padding: '1rem',
                  background: 'rgba(102, 126, 234, 0.1)',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  color: '#475569',
                  lineHeight: '1.5'
                }}>
                  <p style={{ margin: 0, fontWeight: '500' }}>
                    <span className="tossface" style={{ marginRight: '0.5rem' }}>💡</span>
                    Recommended columns: Date, Campaign, Ad Set, Ad, Cost, Impression, Click, Purchase, Revenue
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Rest of the component remains the same */}
          {/* Column Mapping Modal */}
          <ColumnMappingModal
            isOpen={showMappingModal}
            onClose={() => {
              setShowMappingModal(false);
              setStep(1);
            }}
            mappingResult={mappingResult}
            onConfirm={executeAnalysis}
            loading={loading}
          />

          {/* Analysis Results */}
          {step === 3 && analysisResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Results content remains the same as before */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(20px)',
                borderRadius: '20px',
                padding: '2rem',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)'
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
                  Analysis Complete: {analysisResult.fileName}
                </h2>
                <p style={{
                  color: '#64748b',
                  margin: 0,
                  fontSize: '1rem',
                  marginBottom: '2rem'
                }}>
                  Analyzed {analysisResult.metadata?.rowCount?.toLocaleString()} rows of data
                </p>
                
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
                  >
                    <span className="tossface">📊</span>
                    Go to Dashboard
                  </button>
                  
                  <button
                    onClick={resetFlow}
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
                  >
                    <span className="tossface">🔄</span>
                    New Analysis
                  </button>
                </div>
              </div>

              {/* Pivot Tables */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: '1.5rem'
              }}>
                {Object.entries(analysisResult.pivotTables).map(([level, data]) => (
                  <PivotTableCard 
                    key={level} 
                    level={level} 
                    data={data} 
                    formatNumber={formatNumber} 
                  />
                ))}
              </div>

              {/* Heatmap */}
              {analysisResult.pivotTables?.Campaign && (
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
                      data={analysisResult.pivotTables.Campaign}
                      title="Campaign Performance Heatmap"
                    />
                  </div>
                </div>
              )}

              {/* AI Insights Report */}
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
                      {analysisResult.insights}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Login Required Modal */}
      {showLoginModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            padding: '2.5rem',
            textAlign: 'center',
            maxWidth: '400px',
            width: '100%',
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
              <AlertTriangle size={40} color="white" />
            </div>
            
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#1e293b',
              margin: 0,
              marginBottom: '1rem'
            }}>
              Sign In Required
            </h3>
            
            <p style={{
              color: '#64748b',
              fontSize: '1rem',
              margin: 0,
              marginBottom: '2rem',
              lineHeight: '1.5'
            }}>
              Please sign in to upload files and create analyses. Your data will be securely stored and accessible from any device.
            </p>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => setShowLoginModal(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(255, 255, 255, 0.8)',
                  color: '#374151',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  backdropFilter: 'blur(10px)'
                }}
              >
                Cancel
              </button>
              
              <SignInButton mode="modal">
                <button
                  onClick={() => setShowLoginModal(false)}
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
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                  }}
                >
                  <span className="tossface">🚀</span>
                  Sign In
                </button>
              </SignInButton>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
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
              <span className="tossface" style={{ fontSize: '1.8rem' }}>⚡</span>
            </div>
            
            <h3 style={{
              fontSize: '1.2rem',
              fontWeight: '700',
              color: '#1e293b',
              margin: 0,
              marginBottom: '0.5rem'
            }}>
              {step === 1 && 'Analyzing your file...'}
              {step === 2 && 'Generating column mapping...'}
              {step === 3 && 'Creating insights...'}
            </h3>
            
            <p style={{
              color: '#64748b',
              fontSize: '0.95rem',
              margin: 0
            }}>
              This might take a few moments
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// Pivot Table Card Component
const PivotTableCard = ({ level, data, formatNumber }) => {
  console.log(`🔍 PivotTableCard rendering for ${level}:`, { data, type: typeof data, isArray: Array.isArray(data) });
  
  // 데이터 검증
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn(`⚠️ Invalid data for PivotTableCard ${level}:`, data);
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
        overflow: 'hidden',
        padding: '1.5rem',
        textAlign: 'center',
        color: '#64748b'
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600' }}>
          Invalid Data
        </h3>
        <p style={{ margin: 0, fontSize: '0.85rem' }}>
          No valid data available for {level}
        </p>
      </div>
    );
  }

  // 안전한 데이터 필터링
  const safeData = data.filter(row => {
    const isValid = row && typeof row === 'object' && !Array.isArray(row);
    if (!isValid) {
      console.warn(`⚠️ Invalid row in ${level}:`, row);
    }
    return isValid;
  });

  if (safeData.length === 0) {
    console.warn(`⚠️ No valid rows found for ${level}`);
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
        overflow: 'hidden',
        padding: '1.5rem',
        textAlign: 'center',
        color: '#64748b'
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600' }}>
          No Valid Data
        </h3>
        <p style={{ margin: 0, fontSize: '0.85rem' }}>
          No valid rows found for {level}
        </p>
      </div>
    );
  }

  console.log(`✅ Rendering PivotTableCard for ${level} with ${safeData.length} valid rows`);

  return (
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
          {safeData.length} items analyzed
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
              {safeData.slice(0, 6).map((row, idx) => {
                // 안전한 값 추출
                const levelValue = row[level] || 'Unknown';
                const impressionValue = row.Impression || row.impression || 0;
                const ctrValue = row.CTR || row.ctr || '0%';
                const purchaseValue = row.Purchase || row.purchase || 0;

                return (
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
                      }} title={String(levelValue)}>
                        {String(levelValue)}
                      </div>
                    </td>
                    <td style={{
                      textAlign: 'right',
                      padding: '0.75rem',
                      color: '#1e293b',
                      fontWeight: '600'
                    }}>
                      {formatNumber(impressionValue)}
                    </td>
                    <td style={{
                      textAlign: 'right',
                      padding: '0.75rem',
                      color: '#1e293b',
                      fontWeight: '600'
                    }}>
                      {String(ctrValue)}
                    </td>
                    <td style={{
                      textAlign: 'right',
                      padding: '0.75rem',
                      color: '#1e293b',
                      fontWeight: '600'
                    }}>
                      {formatNumber(purchaseValue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {safeData.length > 6 && (
            <div style={{
              textAlign: 'center',
              padding: '1rem',
              color: '#64748b',
              fontSize: '0.85rem',
              fontStyle: 'italic'
            }}>
              <span className="tossface" style={{ marginRight: '0.5rem' }}>➕</span>
              {safeData.length - 6} more items available in full report
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analysis;