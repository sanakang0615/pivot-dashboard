import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, UserButton } from '@clerk/clerk-react';
import { ArrowLeft, Menu, X, FileText, ArrowRight, Download, Share2, BarChart3, Loader2, MessageCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { usePDF } from 'react-to-pdf';
import HeatmapChart from '../HeatmapChart';
import Sidebar from '../Common/Sidebar';
import ChatSidebar from '../Chat/ChatSidebar';

const AnalysisPage = () => {
  const { analysisId } = useParams();
  const { userId, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);
  const [analysisList, setAnalysisList] = useState([]);
  const [exporting, setExporting] = useState(false);
  const heatmapRef = useRef(null);
  const contentRef = useRef(null);
  
  // PDF export hook
  const { toPDF, targetRef } = usePDF({
    filename: analysis?.fileName ? `${analysis.fileName}_analysis.pdf` : 'analysis_report.pdf',
    page: {
      margin: 20,
      format: 'a4',
      orientation: 'portrait'
    },
    // Scale up the PDF content to make it larger
    scale: 1.1
  });

  // Keyboard shortcut for opening chat
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'i') {
        event.preventDefault();
        setChatSidebarOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'l') {
        event.preventDefault();
        setSidebarOpen(!sidebarOpen);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [sidebarOpen]);

  // Clerk 인증 상태 디버깅
  useEffect(() => {
    console.log('🔐 Clerk Auth State:', {
      userId,
      isSignedIn,
      analysisId
    });
  }, [userId, isSignedIn, analysisId]);

  useEffect(() => {
    const analysisFromState = location.state?.analysis;

    // Case 1: New analysis result from navigation state.
    // It has `analysisId` and `pivotTables`, but no `_id` yet.
    if (analysisFromState && analysisFromState.analysisId === analysisId && analysisFromState.pivotTables && !analysisFromState._id) {
      console.log('📊 Using analysis from navigation state (new analysis):', analysisFromState);
      setAnalysis(analysisFromState);
      setLoading(false);
    } 
    // Case 2: Existing analysis, refresh, direct navigation, or sidebar click. Fetch from server.
    else if (analysisId && userId && isSignedIn) {
      console.log('📊 Fetching analysis from server for ID:', analysisId);
      fetchAnalysis();
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
        console.log('📊 Analysis data received:', data.analysis);
        
        let fetchedAnalysis = data.analysis;

        // [Defensive Code]
        // Handle legacy pivotData which might be an array.
        // If pivotTables is not a valid object, try to reconstruct it from pivotData.
        const hasValidPivotTables = fetchedAnalysis.pivotTables && typeof fetchedAnalysis.pivotTables === 'object' && Object.keys(fetchedAnalysis.pivotTables).length > 0;

        if (!hasValidPivotTables && Array.isArray(fetchedAnalysis.pivotData) && fetchedAnalysis.pivotData.length > 0) {
          console.warn('Legacy array-based pivotData detected. Converting to object format.');
          // Assuming the array contains the object with pivot tables
          const pivotObject = fetchedAnalysis.pivotData[0]; 
          if(typeof pivotObject === 'object' && pivotObject !== null) {
            fetchedAnalysis.pivotTables = pivotObject;
          }
        }
        
        setAnalysis(fetchedAnalysis);
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
      console.log('🔍 Fetching analysis list for user:', userId);
      
      if (!userId) {
        console.error('❌ No user ID available');
        return;
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/analyses`, {
        headers: {
          'x-user-id': userId,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response not ok:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('📊 Analysis list result:', result);
      
      if (result.success) {
        setAnalysisList(result.analyses || []);
      } else {
        console.error('❌ API returned error:', result.error);
      }
    } catch (error) {
      console.error('❌ Failed to fetch analysis list:', error);
    }
  };

  const formatNumber = (num) => {
    if (typeof num === 'string') {
      return num;
    }
    return num ? num.toLocaleString() : '0';
  };

  // 히트맵 이미지를 저장하는 함수
  const saveHeatmapImage = async () => {
    // Ensure we have all necessary data to save, including a heatmap if possible
    if (!analysis || !analysis.fileName || !userId) return;

    let heatmapImage = null;
    if (heatmapRef.current) {
      heatmapImage = heatmapRef.current.getImageAsBase64();
      if (!heatmapImage) {
        console.warn('Could not generate heatmap image for saving.');
      }
    }
    
    // Use analysisId from the analysis object itself, which could be new
    const idToSave = analysis.analysisId || analysis._id;
    if (!idToSave) {
      console.error('Cannot save analysis without an ID.');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/analysis/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({
          analysisId: idToSave,
          fileName: analysis.fileName,
          metadata: analysis.metadata,
          pivotTables: analysis.pivotTables,
          insights: analysis.insights,
          heatmapImage: heatmapImage
        })
      });

      const result = await response.json();
      if (result.success) {
        console.log('✅ Analysis saved successfully');
        // Optionally update sidebar or other components
      } else {
        console.error('Failed to save analysis:', result.error);
      }
    } catch (error) {
      console.error('Error saving analysis:', error);
    }
  };

  // PDF Export 함수
  const handleExportPDF = async () => {
    if (!analysis) return;
    
    setExporting(true);
    try {
      // 히트맵 이미지가 있다면 먼저 생성
      if (heatmapRef.current && !analysis.heatmapImage) {
        const heatmapImage = heatmapRef.current.getImageAsBase64();
        if (heatmapImage) {
          // 히트맵 이미지를 analysis 객체에 임시로 추가
          setAnalysis(prev => ({
            ...prev,
            heatmapImage
          }));
          // 이미지 렌더링을 위한 짧은 대기
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // PDF 생성
      await toPDF();
      console.log('✅ PDF exported successfully');
    } catch (error) {
      console.error('❌ Error exporting PDF:', error);
      alert('PDF export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // 분석 데이터가 로드되면 히트맵 이미지 저장
  useEffect(() => {
    if (analysis && analysis.pivotTables) {
      // For new analyses, a heatmap might not be rendered yet.
      // We save once with heatmap, or just save the data if no heatmap.
      const timer = setTimeout(() => {
        saveHeatmapImage();
      }, 1000); // Delay to allow heatmap to render
      
      return () => clearTimeout(timer);
    }
  }, [analysis, userId]);

  // 분석 데이터가 변경될 때마다 로깅
  useEffect(() => {
    if (analysis) {
      console.log('📊 Analysis state updated:', {
        hasPivotTables: !!analysis.pivotTables,
        pivotTablesType: typeof analysis.pivotTables,
        pivotTablesKeys: analysis.pivotTables ? Object.keys(analysis.pivotTables) : [],
        hasCampaign: analysis.pivotTables && analysis.pivotTables.Campaign,
        campaignType: analysis.pivotTables?.Campaign ? typeof analysis.pivotTables.Campaign : 'undefined',
        campaignLength: analysis.pivotTables?.Campaign ? (Array.isArray(analysis.pivotTables.Campaign) ? analysis.pivotTables.Campaign.length : 'not array') : 'undefined'
      });
    }
  }, [analysis]);

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
      <Sidebar 
        isOpen={sidebarOpen && !chatSidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        analysisList={analysisList}
        currentAnalysisId={analysisId}
      />
      <ChatSidebar 
        isOpen={chatSidebarOpen} 
        onClose={() => setChatSidebarOpen(false)} 
        analysisData={analysis}
      />
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
        </div>

        {/* Right side - Auth */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem' 
        }}>
          <button
            onClick={() => setChatSidebarOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: 'rgba(255, 255, 255, 0.4)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#374151',
              fontSize: '0.9rem',
              fontWeight: '500',
              boxShadow: 'none',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.6)';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.4)';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            <MessageCircle size={16} />
            Chat with AI
            <span style={{
              fontSize: '0.8rem',
              opacity: 0.8,
              marginLeft: '0.25rem',
              padding: '0.1rem 0.4rem',
              background: 'rgba(0, 0, 0, 0.05)',
              borderRadius: '4px'
            }}>
              ⌘I
            </span>
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
            onClick={handleExportPDF}
            disabled={exporting}
          >
            <Download size={16} />
            {exporting ? 'Exporting...' : 'Export'}
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

      {/* Main Content */}
      <main 
        ref={targetRef}
        style={{
          padding: '2rem',
          maxWidth: '1400px',
          margin: '0 auto',
          position: 'relative',
          zIndex: 1,
          // PDF 전용 스타일
          '@media print': {
            background: 'white !important',
            color: 'black !important',
            boxShadow: 'none !important',
            border: 'none !important'
          }
        }}
      >
        {/* PDF 전용 헤더 */}
        <div style={{
          display: 'none',
          '@media print': {
            display: 'block',
            textAlign: 'center',
            marginBottom: '2rem',
            paddingBottom: '1rem',
            borderBottom: '2px solid #000'
          }
        }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            margin: 0,
            color: '#000'
          }}>
            AdOasis Analysis Report
          </h1>
          <p style={{
            fontSize: '1rem',
            margin: '0.5rem 0 0 0',
            color: '#666'
          }}>
            {analysis?.fileName} - {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Background Effects */}
        {/* Removed background gradient circles */}

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Analysis Header */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            padding: '2rem',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
            marginBottom: '1rem',
            '@media print': {
              background: 'white !important',
              border: '1px solid #000 !important',
              boxShadow: 'none !important',
              borderRadius: '8px !important',
              pageBreakAfter: 'always'
            }
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
              justifyContent: 'space-between',
              gap: '2rem',
              flexWrap: 'wrap',
              marginBottom: '.5rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2rem',
                flexWrap: 'wrap'
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
              
              {/* <button
                onClick={() => navigate('/dashboard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.5rem 1.25rem',
                  background: 'linear-gradient(135deg, #000000 0%, #1c1c1e 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
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
                <span className="tossface">🔙</span>
                Go to Dashboard
              </button> */}
            </div>
          </div>

          {/* Pivot Tables */}
          {(() => {
            console.log('🔍 Checking pivotTables condition:', !!analysis.pivotTables);
            console.log('🔍 pivotTables content:', analysis.pivotTables);
            
            // pivotTables가 존재하고 객체이며, 최소 하나의 키가 있고, 그 값이 배열인지 확인
            const hasValidPivotTables = analysis.pivotTables && 
              typeof analysis.pivotTables === 'object' && 
              Object.keys(analysis.pivotTables).length > 0 &&
              Object.values(analysis.pivotTables).some(data => Array.isArray(data) && data.length > 0);
            
            console.log('🔍 hasValidPivotTables:', hasValidPivotTables);
            
            return hasValidPivotTables && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
              }}>
                {Object.entries(analysis.pivotTables)
                  .filter(([level, data]) => Array.isArray(data) && data.length > 0)
                  .map(([level, data]) => (
                    <PivotTableCard 
                      key={level} 
                      level={level} 
                      data={data} 
                      formatNumber={formatNumber} 
                    />
                  ))}
              </div>
            );
          })()}

          {/* Performance Heatmap */}
          {(() => {
            const hasValidCampaignData = analysis.pivotTables && 
              analysis.pivotTables.Campaign && 
              Array.isArray(analysis.pivotTables.Campaign) && 
              analysis.pivotTables.Campaign.length > 0;
            
            console.log('🔥 Checking heatmap condition:', hasValidCampaignData);
            console.log('🔥 Campaign data:', analysis.pivotTables?.Campaign);
            
            return hasValidCampaignData && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(20px)',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
                '@media print': {
                  background: 'white !important',
                  border: '1px solid #000 !important',
                  boxShadow: 'none !important',
                  borderRadius: '8px !important',
                  pageBreakInside: 'avoid',
                  marginBottom: '1rem'
                }
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
                    <span className="tossface">🔥</span>
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
                  {analysis.heatmapImage ? (
                    // 저장된 히트맵 이미지가 있으면 표시
                    <div style={{ textAlign: 'center' }}>
                      <img 
                        src={analysis.heatmapImage} 
                        alt="Performance Heatmap"
                        style={{
                          maxWidth: '100%',
                          height: 'auto',
                          borderRadius: '12px',
                          border: '1px solid rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <div className="mt-2 text-sm text-gray-600 text-center">
                        <p><span className="tossface">💡</span> <span className="pretendard">색상이 진할수록 높은 성과를 나타냅니다</span></p>
                        <p className="pretendard">CTR/CVR: 높을수록 좋음 | CPA: 낮을수록 좋음</p>
                      </div>
                    </div>
                  ) : (
                    // 저장된 이미지가 없으면 새로 생성
                    <HeatmapChart 
                      ref={heatmapRef}
                      data={analysis.pivotTables.Campaign}
                      title="Campaign Performance Heatmap"
                    />
                  )}
                </div>
              </div>
            );
          })()}

          {/* AI Insights Report */}
          {analysis.insights && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(20px)',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
              '@media print': {
                background: 'white !important',
                border: '1px solid #000 !important',
                boxShadow: 'none !important',
                borderRadius: '8px !important',
                pageBreakInside: 'avoid',
                marginBottom: '1rem'
              }
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
                  padding: '2rem',
                  background: 'rgba(255, 255, 255, 0.9)',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
                  whiteSpace: 'pre-wrap',
                  color: '#374151',
                  lineHeight: '1.7',
                  fontSize: '0.95rem'
                }} className="tossface">
                  <ReactMarkdown
                    components={{
                      h1: ({children}) => <h1 style={{
                        fontSize: '1.5rem',
                        fontWeight: '700',
                        color: '#1e293b',
                        margin: '1.5rem 0 1rem 0',
                        borderBottom: '2px solid rgba(102, 126, 234, 0.2)',
                        paddingBottom: '0.5rem'
                      }}>{children}</h1>,
                      h2: ({children}) => <h2 style={{
                        fontSize: '1.25rem',
                        fontWeight: '600',
                        color: '#1e293b',
                        margin: '1.25rem 0 0.75rem 0'
                      }}>{children}</h2>,
                      h3: ({children}) => <h3 style={{
                        fontSize: '1.1rem',
                        fontWeight: '600',
                        color: '#374151',
                        margin: '1rem 0 0.5rem 0'
                      }}>{children}</h3>,
                      p: ({children}) => <p style={{
                        margin: '0.75rem 0',
                        lineHeight: '1.7'
                      }}>{children}</p>,
                      ul: ({children}) => <ul style={{
                        margin: '0.75rem 0',
                        paddingLeft: '1.5rem'
                      }}>{children}</ul>,
                      ol: ({children}) => <ol style={{
                        margin: '0.75rem 0',
                        paddingLeft: '1.5rem'
                      }}>{children}</ol>,
                      li: ({children}) => <li style={{
                        margin: '0.25rem 0',
                        lineHeight: '1.6'
                      }}>{children}</li>,
                      strong: ({children}) => <strong style={{
                        fontWeight: '600',
                        color: '#1e293b'
                      }}>{children}</strong>,
                      em: ({children}) => <em style={{
                        fontStyle: 'italic',
                        color: '#475569'
                      }}>{children}</em>,
                      code: ({children}) => <code style={{
                        background: 'rgba(102, 126, 234, 0.1)',
                        padding: '0.2rem 0.4rem',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        fontFamily: 'monospace',
                        color: '#667eea'
                      }}>{children}</code>,
                      blockquote: ({children}) => <blockquote style={{
                        borderLeft: '4px solid rgba(102, 126, 234, 0.3)',
                        paddingLeft: '1rem',
                        margin: '1rem 0',
                        fontStyle: 'italic',
                        color: '#475569',
                        background: 'rgba(102, 126, 234, 0.05)',
                        padding: '1rem',
                        borderRadius: '8px'
                      }}>{children}</blockquote>
                    }}
                  >
                    {analysis.insights}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      
      {exporting && <ExportProgressModal />}
    </div>
  );
};

const ExportProgressModal = () => (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(255, 255, 255, 0.5)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10001,
    opacity: 1,
    transition: 'opacity 0.3s ease',
  }}>
    <style>
      {`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spinning-loader {
          animation: spin 1s linear infinite;
        }
      `}
    </style>
    <div style={{
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '2.5rem 3rem',
      borderRadius: '20px',
      textAlign: 'center',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
    }}>
      <Loader2 className="spinning-loader" size={48} style={{ marginBottom: '1.5rem' }} />
      <h3 style={{ fontSize: '1.2rem', margin: '0 0 0.5rem 0', fontWeight: '600' }}>
        Generating Report PDF...
      </h3>
      <p style={{ margin: 0, opacity: 0.8, fontSize: '0.95rem' }}>
        Please wait a moment, this may take some time.
      </p>
    </div>
  </div>
);

// Pivot Table Card Component
const PivotTableCard = ({ level, data, formatNumber }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(20px)',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
    overflow: 'hidden',
    '@media print': {
      background: 'white !important',
      border: '1px solid #000 !important',
      boxShadow: 'none !important',
      borderRadius: '8px !important',
      pageBreakInside: 'avoid',
      marginBottom: '1rem'
    }
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