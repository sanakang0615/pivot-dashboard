import React, { useState, useEffect } from 'react';
import { useAuth, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { Menu, X, FileText, FolderOpen, ArrowRight, AlertTriangle, Database, Globe, ChevronDown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import ColumnMappingModal from '../components/ColumnMappingModal';
import CampaignAnalysisModal from '../components/CampaignAnalysisModal';
import HeatmapChart from '../components/HeatmapChart';
import Sidebar from '../components/Common/Sidebar';
import DatasetSelector from '../components/Common/DatasetSelector';

const Analysis = () => {
  const { userId, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const { language, t, changeLanguage } = useLanguage();
  const [step, setStep] = useState(1);
  const [fileData, setFileData] = useState(null);
  const [mappingResult, setMappingResult] = useState(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [campaignAnalysis, setCampaignAnalysis] = useState(null);
  const [showCampaignAnalysisModal, setShowCampaignAnalysisModal] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Login modal state
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // Dataset selector state
  const [showDatasetSelector, setShowDatasetSelector] = useState(false);
  
  // Language selector state
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

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

  // Close language dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showLanguageDropdown && !event.target.closest('[data-language-selector]')) {
        setShowLanguageDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLanguageDropdown]);

  // Handle window resize for progress steps
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

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
      //console.log('File uploaded, columns extracted:', result.columns);
      
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
      
      //console.log('Column mapping suggested:', result);
      setMappingResult({ ...result, fileId });
      
      // 캠페인 분석 수행
      await analyzeCampaigns(result, fileId);
      
    } catch (error) {
      console.error('Column mapping suggestion failed:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const analyzeCampaigns = async (mappingResult, fileId) => {
    setLoading(true);
    
    try {
      console.log('🔍 === ANALYZING CAMPAIGNS ===');
      
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/analysis/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileId,
          columnMapping: mappingResult.mapping
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        console.warn('Campaign analysis failed, proceeding with column mapping:', result.error);
        // 캠페인 분석이 실패해도 컬럼 매핑은 계속 진행
        setShowMappingModal(true);
        setStep(3);
        return;
      }
      
      console.log('✅ Campaign analysis completed:', result);
      // result.success가 true인 경우, result 자체에 분석 데이터가 포함됨
      setCampaignAnalysis(result);
      setShowCampaignAnalysisModal(true);
      setStep(2);
      
    } catch (error) {
      console.error('Campaign analysis failed:', error);
      // 에러가 발생해도 컬럼 매핑은 계속 진행
      setShowMappingModal(true);
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  const handleCampaignAnalysisContinue = () => {
    setShowCampaignAnalysisModal(false);
    
    // 캠페인 분석 결과를 매핑 결과에 추가
    if (campaignAnalysis && mappingResult) {
      setMappingResult({
        ...mappingResult,
        campaignContext: {
          brand: campaignAnalysis.brand,
          product: campaignAnalysis.product,
          industry: campaignAnalysis.industry,
          totalCampaigns: campaignAnalysis.total_campaigns
        }
      });
    }
    
    setShowMappingModal(true);
    setStep(3);
  };

  const executeAnalysis = async (confirmedMapping) => {
    setLoading(true);
    setShowMappingModal(false);
    setStep(3);
    setError(null);
    
    console.log('🔍 Analysis.js: executeAnalysis called with mapping:', confirmedMapping);
    console.log('🔍 Analysis.js: mappingResult state:', mappingResult);
    
    try {
      console.log('🚀 === STEP 1: EXECUTING ANALYSIS ===');
      console.log('🔗 API URL:', process.env.REACT_APP_API_URL || 'http://localhost:3001');
      console.log('👤 User ID:', userId);
      console.log('📁 File ID:', mappingResult.fileId);
      console.log('🗺️ Column Mapping:', confirmedMapping);
      
      // 1단계: 피벗테이블, 히트맵 생성
      const analysisResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/analysis/execute`, {
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
      
      console.log('📡 Analysis response status:', analysisResponse.status);
      console.log('📡 Analysis response headers:', Object.fromEntries(analysisResponse.headers.entries()));
      
      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text();
        console.error('❌ Analysis response error:', errorText);
        throw new Error(`Analysis failed: ${analysisResponse.status} - ${errorText}`);
      }
      
      const analysisResult = await analysisResponse.json();
      
      console.log('✅ Analysis result received:', {
        success: analysisResult.success,
        analysisId: analysisResult.analysisId,
        hasPivotTables: !!analysisResult.pivotTables,
        pivotTableKeys: Object.keys(analysisResult.pivotTables || {}),
        hasHeatmap: !!analysisResult.heatmap
      });
      
      if (!analysisResult.success) {
        throw new Error(analysisResult.error || 'Analysis execution failed.');
      }

      // 피봇 테이블 데이터 검증 및 정리
      const validatedPivotTables = {};
      if (analysisResult.pivotTables && typeof analysisResult.pivotTables === 'object') {
        Object.entries(analysisResult.pivotTables).forEach(([key, data]) => {
          if (Array.isArray(data) && data.length > 0) {
            // 데이터 항목들이 객체인지 확인
            const validData = data.filter(item => item && typeof item === 'object');
            if (validData.length > 0) {
              validatedPivotTables[key] = validData;
              console.log(`✅ Valid pivot table "${key}": ${validData.length} items`);
            } else {
              console.warn(`⚠️ No valid items in pivot table "${key}"`);
            }
          } else {
            console.warn(`⚠️ Invalid pivot table data for "${key}":`, data);
          }
        });
      }

      console.log('📊 Validated pivot tables:', {
        keys: Object.keys(validatedPivotTables),
        totalItems: Object.values(validatedPivotTables).reduce((sum, data) => sum + data.length, 0)
      });

      // 2단계: AI 인사이트 생성 (피봇 테이블이 있는 경우에만)
      if (Object.keys(validatedPivotTables).length > 0) {
        console.log('🤖 === STEP 2: GENERATING AI INSIGHTS ===');
        
        try {
          const insightsResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/analysis/insights`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-user-id': userId
            },
            body: JSON.stringify({
              analysisId: analysisResult.analysisId,
              pivotTables: validatedPivotTables
            })
          });
          
          console.log('📡 Insights response status:', insightsResponse.status);
          console.log('📡 Insights response headers:', Object.fromEntries(insightsResponse.headers.entries()));
          
          if (!insightsResponse.ok) {
            const errorText = await insightsResponse.text();
            console.error('❌ Insights response error:', errorText);
            throw new Error(`Insights generation failed: ${insightsResponse.status} - ${errorText}`);
          }
          
          const insightsResult = await insightsResponse.json();
          
          console.log('🤖 Insights result received:', {
            success: insightsResult.success,
            hasInsights: !!insightsResult.insights,
            insightsLength: insightsResult.insights ? insightsResult.insights.length : 0,
            preview: insightsResult.insights ? insightsResult.insights.substring(0, 100) + '...' : 'No preview'
          });
          
          if (insightsResult.success && insightsResult.insights) {
            analysisResult.insights = insightsResult.insights;
            console.log('✅ AI insights successfully added to analysis result');
          } else {
            console.warn('⚠️ AI insights generation failed:', insightsResult.error);
            analysisResult.insights = `# ⚠️ AI 인사이트 생성 실패\n\n${insightsResult.error || '기술적인 문제로 AI 분석을 생성할 수 없었습니다.'}\n\n기본 분석 결과는 정상적으로 생성되었습니다.`;
          }
        } catch (insightsError) {
          console.error('❌ AI insights generation error:', insightsError);
          analysisResult.insights = `# ⚠️ AI 인사이트 생성 오류\n\n${insightsError.message}\n\n네트워크 연결이나 서버 상태를 확인해주세요. 기본 분석 결과는 정상적으로 생성되었습니다.`;
        }
      } else {
        console.warn('⚠️ No valid pivot tables found, skipping AI insights generation');
        analysisResult.insights = '# ⚠️ 데이터 부족\n\n유효한 피벗 테이블 데이터가 없어 AI 인사이트를 생성할 수 없습니다. 데이터 형식과 컬럼 매핑을 확인해주세요.';
      }

      // 최종 결과에 검증된 피봇 테이블 적용
      analysisResult.pivotTables = validatedPivotTables;

      console.log('📊 Final analysis result:', {
        analysisId: analysisResult.analysisId,
        fileName: analysisResult.fileName,
        hasPivotTables: !!analysisResult.pivotTables,
        pivotTableKeys: Object.keys(analysisResult.pivotTables || {}),
        hasInsights: !!analysisResult.insights,
        insightsLength: analysisResult.insights ? analysisResult.insights.length : 0
      });

      setAnalysisResult(analysisResult);
      
      // Navigate to the analysis result page
      if (analysisResult.analysisId) {
        // Show success state briefly before redirecting
        setTimeout(() => {
          navigate(`/analysis/${analysisResult.analysisId}`, { 
            state: { 
              analysis: analysisResult
            }
          });
        }, 1000);
      }
      
    } catch (error) {
      console.error('❌ === ANALYSIS EXECUTION ERROR ===');
      console.error('❌ Error type:', error.constructor.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      
      setError(`분석 실행 중 오류가 발생했습니다: ${error.message}`);
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
    setCampaignAnalysis(null);
    setShowCampaignAnalysisModal(false);
    setAnalysisResult(null);
    setError(null);
  };

  // Handle dataset selection
  const handleDatasetSelected = async (datasetInfo) => {
    if (!isSignedIn) {
      setShowLoginModal(true);
      return;
    }

    setLoading(true);
    setError(null);
    setShowDatasetSelector(false);
    
    try {
      // 데이터셋 정보를 파일 업로드 결과와 유사한 형태로 변환
      const mockFileData = {
        success: true,
        columns: datasetInfo.columns,
        fileId: `dataset_${datasetInfo.id}`,
        datasetInfo: datasetInfo
      };
      
      setFileData(mockFileData);
      
      // 백엔드에서 받은 컬럼 매핑을 사용
      if (datasetInfo.columnMapping) {
        setMappingResult({ 
          mapping: datasetInfo.columnMapping,
          fileId: mockFileData.fileId
        });
        // 캠페인 분석 수행
        await analyzeCampaigns({ mapping: datasetInfo.columnMapping }, mockFileData.fileId);
      } else {
        // 컬럼 매핑 제안
        await suggestColumnMapping(datasetInfo.columns, mockFileData.fileId);
      }
      
    } catch (error) {
      console.error('Dataset processing failed:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (typeof num === 'string') {
      return num;
    }
    return num ? num.toLocaleString() : '0';
  };

  return (
    <>
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fafbff 0%, #f8fafc 50%, #f1f5f9 100%)',
        fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
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

        {/* Right side - Language & Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Language Selector */}
          <div style={{ position: 'relative' }} data-language-selector>
            <button
              onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                background: 'rgba(255, 255, 255, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '500',
                color: '#374151',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.2s ease',
                minWidth: '80px',
                justifyContent: 'space-between'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.95)';
                e.target.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.8)';
                e.target.style.transform = 'scale(1)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Globe size={14} color="#64748b" />
                <span style={{ 
                  fontSize: '0.8rem', 
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  {language === 'ko' ? '한국어' : language === 'en' ? 'English' : '日本語'}
                </span>
              </div>
              <ChevronDown 
                size={12} 
                color="#64748b" 
                style={{
                  transition: 'transform 0.2s ease',
                  transform: showLanguageDropdown ? 'rotate(180deg)' : 'rotate(0deg)'
                }}
              />
            </button>
            
            {/* Language Dropdown */}
            {showLanguageDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '0.5rem',
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                minWidth: '120px',
                zIndex: 1000,
                overflow: 'hidden'
              }}>
                {[
                  { code: 'en', name: 'English', flag: '🇺🇸' },
                  { code: 'ko', name: '한국어', flag: '🇰🇷' }
                ].map((lang) => (
                  <button
                    key={lang.code}
                                       onClick={() => {
                     changeLanguage(lang.code);
                     setShowLanguageDropdown(false);
                   }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      width: '100%',
                      padding: '0.75rem 1rem',
                                           background: language === lang.code 
                       ? 'rgba(102, 126, 234, 0.1)' 
                       : 'transparent',
                     border: 'none',
                     cursor: 'pointer',
                     fontSize: '0.85rem',
                     fontWeight: language === lang.code ? '600' : '500',
                     color: language === lang.code ? '#667eea' : '#374151',
                      transition: 'all 0.2s ease',
                      textAlign: 'left'
                    }}
                                         onMouseEnter={(e) => {
                       if (language !== lang.code) {
                         e.target.style.background = 'rgba(102, 126, 234, 0.05)';
                       }
                     }}
                     onMouseLeave={(e) => {
                       if (language !== lang.code) {
                         e.target.style.background = 'transparent';
                       }
                     }}
                                     >
                     <span className="tossface" style={{ fontSize: '1.1rem' }}>{lang.flag}</span>
                     <span>{lang.name}</span>
                                         {language === lang.code && (
                      <div style={{
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        background: '#667eea',
                        marginLeft: 'auto'
                      }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {isSignedIn ? (
            <UserButton 
              afterSignOutUrl="/" 
              appearance={{
                elements: {
                  avatarBox: {
                    width: '36px',
                    height: '36px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    background: 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.2s ease'
                  },
                  userButtonPopoverCard: {
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                  }
                }
              }}
            />
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
              {t('hero.badge')}
            </div>
            
            <h1 style={{
              fontSize: 'clamp(2.5rem, 6vw, 4rem)',
              fontWeight: '800',
              color: '#1e293b',
              marginBottom: '1rem',
              letterSpacing: '-0.03em',
              lineHeight: '1.1'
            }}>
              {t('hero.title').split('\n').map((line, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <br />}
                  {line}
                </React.Fragment>
              ))}
              <span style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
              dangerouslySetInnerHTML={{ __html: t('hero.titleHighlight') }}
              />
            </h1>
            
            <p style={{
              color: '#64748b',
              fontSize: 'clamp(1rem, 2vw, 1.2rem)',
              maxWidth: '600px',
              margin: '0 auto',
              lineHeight: '1.6',
              fontWeight: '400'
            }}
            dangerouslySetInnerHTML={{ __html: t('hero.subtitle') }}
            />
          </div>

          {/* Progress Steps */}
          <div style={{ marginBottom: '6rem' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: windowWidth < 768 ? '0.5rem' : windowWidth < 1024 ? '0.75rem' : '1rem',
              flexWrap: 'nowrap',
              overflow: 'hidden',
              width: '100%',
              maxWidth: '100%',
              margin: '0 auto'
            }}>
              {[
                { num: 1, label: t('progress.step1'), emoji: '📁' },
                { num: 2, label: t('progress.step2'), emoji: '🔍' },
                { num: 3, label: t('progress.step3'), emoji: '🔗' },
                { num: 4, label: t('progress.step4'), emoji: '📊' }
              ].map((stepInfo, index, arr) => {
                // 화면 크기에 따른 동적 라벨 변경
                const getDynamicLabel = (originalLabel, stepNum) => {
                  if (windowWidth < 768) { // 모바일/작은 화면
                    switch(stepNum) {
                      case 1: return 'Upload';
                      case 2: return 'Predict';
                      case 3: return 'Map';
                      case 4: return 'Analyze';
                      default: return originalLabel;
                    }
                  } else if (windowWidth < 1024) { // 중간 화면
                    switch(stepNum) {
                      case 1: return 'Upload';
                      case 2: return 'Predict';
                      case 3: return 'Map';
                      case 4: return 'Analyze';
                      default: return originalLabel;
                    }
                  }
                  return originalLabel;
                };

                const dynamicLabel = getDynamicLabel(stepInfo.label, stepInfo.num);
                
                                return (
                  <div key={stepInfo.num} style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    flex: '0 1 auto',
                    minWidth: 0
                  }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: windowWidth < 768 ? '0.5rem' : '0.75rem',
                    padding: windowWidth < 768 ? '0.6rem 0.8rem' : windowWidth < 1024 ? '0.8rem 1.2rem' : '1rem 1.5rem',
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
                    transform: step >= stepInfo.num ? 'translateY(-2px)' : 'translateY(0)',
                    width: '100%',
                    minWidth: 0,
                    overflow: 'hidden'
                  }}>
                    <span className="tossface" style={{ 
                      fontSize: windowWidth < 768 ? '1.1rem' : '1.3rem',
                      flexShrink: 0
                    }}>
                      {stepInfo.emoji}
                    </span>
                    <span style={{ 
                      fontWeight: '600', 
                      fontSize: windowWidth < 768 ? '0.75rem' : windowWidth < 1024 ? '0.85rem' : '1rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      flex: '1',
                      minWidth: 0
                    }}>
                      {dynamicLabel}
                    </span>
                  </div>
                        {index < arr.length - 1 && (
        <div style={{
          width: windowWidth < 768 ? '1rem' : windowWidth < 1024 ? '2rem' : '4rem',
          height: '3px',
          margin: windowWidth < 768 ? '0 0.25rem' : windowWidth < 1024 ? '0 0.5rem' : '0 1rem',
          background: step > stepInfo.num 
            ? 'linear-gradient(90deg, #667eea, #764ba2)'
            : 'rgba(0, 0, 0, 0.1)',
          borderRadius: '2px',
          transition: 'all 0.3s ease',
          flexShrink: 0
        }} />
      )}
                </div>
              );
              })}
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
                    {t('errors.title')}
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
              
              {/* Data Source Selection */}
              <div style={{ marginBottom: '0' }}>
                <h3 style={{
                  fontSize: '1.2rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '1.5rem'
                }}>
                  {t('upload.title')}
                </h3>
                
                {/* Visual Upload Area */}
                <div style={{
                  marginBottom: '4.5rem',
                  padding: '2rem',
                  background: '#f3f4f6',
                  borderRadius: '14px',
                  border: '1.5px solid #e5e7eb',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1.2rem'
                }}>
                  <div style={{
                    fontSize: '2.5rem',
                    color: '#64748b',
                    marginBottom: '0.5rem'
                  }}>
                    <span>📁</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    {/* <div style={{
                      fontSize: '1.05rem',
                      fontWeight: 600,
                      color: '#374151',
                      marginBottom: '0.3rem'
                    }}>
                      {t('upload.description')}
                    </div> */}
                    <div style={{
                      color: '#6b7280',
                      fontSize: '0.95rem',
                      lineHeight: 1.6
                    }}>
                      {t('upload.supportedFormats')}<br/>
                      {t('upload.maxFileSize')}
                    </div>
                  </div>
                </div>
                
                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  justifyContent: 'center',
                  flexWrap: 'wrap'
                }}>
                  {/* Built-in Dataset Option */}
                  <button
                    onClick={() => setShowDatasetSelector(true)}
                    disabled={loading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '1rem 1.5rem',
                      background: 'rgba(255,255,255,0.85)',
                      border: '1.5px solid #e0e7ff', // 연보라
                      borderRadius: '12px',
                      color: '#667eea', // 포인트 연보라
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.6 : 1,
                      transition: 'all 0.2s cubic-bezier(.4,0,.2,1)',
                      boxShadow: '0 2px 8px rgba(102,126,234,0.07)',
                      outline: 'none',
                      borderColor: loading ? '#e5e7eb' : '#e0e7ff',
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.target.style.boxShadow = '0 4px 16px rgba(102,126,234,0.13)';
                        e.target.style.background = 'rgba(245,243,255,0.97)'; // 연보라 배경
                        e.target.style.borderColor = '#a5b4fc';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading) {
                        e.target.style.boxShadow = '0 2px 8px rgba(102,126,234,0.07)';
                        e.target.style.background = 'rgba(255,255,255,0.85)';
                        e.target.style.borderColor = '#e0e7ff';
                      }
                    }}
                  >
                    <Database size={18} color="#667eea" />
                    {t('buttons.useBuiltinDataset')}
                  </button>
                  
                  {/* Divider */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    color: '#9ca3af',
                    fontSize: '0.9rem',
                    fontWeight: '500'
                  }}>
                    {t('upload.or')}
                  </div>
                  
                  {/* File Upload Option */}
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
                    style={{ display: 'none' }}
                    id="file-upload-main"
                    disabled={loading}
                  />
                  
                  <label 
                    htmlFor="file-upload-main" 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '1rem 1.5rem',
                      background: 'rgba(255, 255, 255, 0.8)',
                      border: '2px solid #e5e7eb',
                      borderRadius: '12px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      color: '#374151',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.6 : 1,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading) {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = 'none';
                      }
                    }}
                  >
                    <FileText size={18} />
                    {t('buttons.fileUpload')}
                  </label>
                </div>
              </div>

            </div>
          )}

          {/* Rest of the component remains the same */}
          {/* Campaign Analysis Modal */}
          <CampaignAnalysisModal
            isOpen={showCampaignAnalysisModal}
            onClose={() => {
              setShowCampaignAnalysisModal(false);
              setStep(1);
            }}
            campaignAnalysis={campaignAnalysis}
            onContinue={handleCampaignAnalysisContinue}
            loading={loading}
          />

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
            isMainPage={true}
          />

          {/* Analysis Results */}
          {step === 4 && analysisResult && (
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
                   {analysisResult.fileName}
                </h2>
                <p style={{
                  color: '#64748b',
                  margin: 0,
                  fontSize: '1rem',
                  marginBottom: '2rem'
                }}>
                  {t('results.analyzedRows', { count: analysisResult.metadata?.rowCount?.toLocaleString() })}
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
                    {t('results.goToDashboard')}
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
                    {t('buttons.newAnalysis')}
                  </button>
                </div>
              </div>

              {/* Pivot Tables */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: '1.5rem'
              }}>
                {Object.entries(analysisResult.pivotTables)
                  .filter(([level, data]) => data && data.length > 0) // Only show tables with data
                  .map(([level, data]) => (
                    <PivotTableCard 
                      key={level} 
                      level={level} 
                      data={data} 
                      formatNumber={formatNumber} 
                    />
                  ))}
              </div>

              {/* Heatmap */}
              {analysisResult.pivotTables?.Campaign && analysisResult.pivotTables.Campaign.length > 0 && (
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
                      {t('results.performanceHeatmap')}
                    </h3>
                    <p style={{
                      color: '#64748b',
                      margin: 0,
                      fontSize: '0.95rem'
                    }}>
                      {t('results.heatmapDescription')}
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
                      {t('results.aiAnalysisReport')}
                    </h3>
                    <p style={{
                      color: '#64748b',
                      margin: 0,
                      fontSize: '0.95rem'
                    }}>
                      {t('results.aiDescription')}
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

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '2rem',
        marginTop: '3rem',
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(102, 126, 234, 0.1)',
        color: '#64748b',
        fontSize: '0.9rem',
        fontWeight: '500'
      }}>
        © Adoasis 2025. All rights reserved.
      </footer>

      {/* Dataset Selector Modal */}
      {showDatasetSelector && (
        <DatasetSelector
          onDatasetSelected={handleDatasetSelected}
          onCancel={() => setShowDatasetSelector(false)}
        />
      )}

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
              {t('errors.signInRequired')}
            </h3>
            
            <p style={{
              color: '#64748b',
              fontSize: '1rem',
              margin: 0,
              marginBottom: '2rem',
              lineHeight: '1.5'
            }}>
              {t('errors.signInMessage')}
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
                  {t('buttons.cancel')}
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
                  {t('buttons.signIn')}
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
              {step === 1 && t('loading.analyzing')}
              {step === 2 && t('loading.mapping')}
              {step === 3 && t('loading.creating')}
            </h3>
            
            <p style={{
              color: '#64748b',
              fontSize: '0.95rem',
              margin: 0
            }}>
              {t('loading.subtitle')}
            </p>
          </div>
        </div>
      )}
    </div>
    <style>{`
      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
      }
      @keyframes bounce {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-8px); }
      }
    `}</style>
  </>
);
};

// Pivot Table Card Component
const PivotTableCard = ({ level, data, formatNumber }) => {
  const { t } = useLanguage();
  //console.log(`🔍 PivotTableCard rendering for ${level}:`, { data, type: typeof data, isArray: Array.isArray(data) });
  
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

  //console.log(`✅ Rendering PivotTableCard for ${level} with ${safeData.length} valid rows`);

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
          {t('results.itemsAnalyzed', { count: safeData.length })}
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
                  {t('pivotTables.impressions')}
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
                  {t('pivotTables.ctr')}
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
                  {t('pivotTables.conversions')}
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
              {t('results.moreItems', { count: safeData.length - 6 })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analysis;