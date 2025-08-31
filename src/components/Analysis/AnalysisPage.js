import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, UserButton } from '@clerk/clerk-react';
import { ArrowLeft, Menu, X, FileText, ArrowRight, Download, Share2, BarChart3, Loader2, MessageCircle, Edit } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { usePDF } from 'react-to-pdf';
import HeatmapChart from '../HeatmapChart';
import Sidebar from '../Common/Sidebar';
import ChatSidebar from '../Chat/ChatSidebar';
import { useLanguage } from '../../contexts/LanguageContext';
import { Globe, ChevronDown } from 'lucide-react';
import { config } from '../../utils/config';

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
  const [renameModal, setRenameModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [hasGeneratedHeatmap, setHasGeneratedHeatmap] = useState(false);
  const heatmapRef = useRef(null);
  const contentRef = useRef(null);
  const { language, t, changeLanguage } = useLanguage();
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  
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

  const handleChatSidebarClose = () => {
    setChatSidebarOpen(false);
  };

  // Handle rename
  const handleRename = () => {
    setRenameModal(true);
    setNewFileName(analysis.fileName);
  };

  const handleRenameSubmit = async () => {
    if (!newFileName.trim()) return;
    
    setIsRenaming(true);
    try {
      const res = await fetch(`${config.api.baseURL}/api/analyses/${analysisId}`, {
        method: 'PATCH',
        headers: { 
          'x-user-id': userId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileName: newFileName.trim() })
      });
      
      if (res.ok) {
        // Update local state
        setAnalysis(prev => ({
          ...prev,
          fileName: newFileName.trim()
        }));
        setRenameModal(false);
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
      setIsRenaming(false);
    }
  };

  // Keyboard shortcut for opening chat
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Cmd/Ctrl + I: Toggle Chat Sidebar (다른 사이드바가 열려있으면 무시)
      if ((event.metaKey || event.ctrlKey) && event.key === 'i') {
        event.preventDefault();
        // 분석 사이드바가 열려있으면 챗 사이드바 토글 무시
        if (sidebarOpen) {
          return;
        }
        setChatSidebarOpen(prev => !prev);
      }
      // Cmd/Ctrl + L: Toggle Analysis Sidebar (다른 사이드바가 열려있으면 무시)
      if ((event.metaKey || event.ctrlKey) && event.key === 'l') {
        event.preventDefault();
        // 챗 사이드바가 열려있으면 분석 사이드바 토글 무시
        if (chatSidebarOpen) {
          return;
        }
        setSidebarOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [sidebarOpen, chatSidebarOpen]); // 상태를 의존성에 포함

  // Clerk 인증 상태 디버깅
  useEffect(() => {
    // console.log('🔐 Clerk Auth State:', {
    //   userId,
    //   isSignedIn,
    //   analysisId
    // });
  }, [userId, isSignedIn, analysisId]);

  useEffect(() => {
    const analysisFromState = location.state?.analysis;

    // Case 1: New analysis result from navigation state.
    // It has `analysisId` and `pivotTables`, but no `_id` yet.
    if (analysisFromState && analysisFromState.analysisId === analysisId && analysisFromState.pivotTables && !analysisFromState._id) {
      //console.log('📊 Using analysis from navigation state (new analysis):', analysisFromState);
      setAnalysis(analysisFromState);
      setLoading(false);
    } 
    // Case 2: Existing analysis, refresh, direct navigation, or sidebar click. Fetch from server.
    else if (analysisId && userId && isSignedIn) {
      //console.log('📊 Fetching analysis from server for ID:', analysisId);
      fetchAnalysis();
    } else if (!isSignedIn) {
      navigate('/');
    }
  }, [analysisId, userId, isSignedIn, location.state]);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.api.baseURL}/api/analysis/${analysisId}`, {
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
        //console.log('📊 Analysis data received:', data.analysis);
        
        let fetchedAnalysis = data.analysis;

        // Log createdAt field for debugging
        // console.log('📅 createdAt field:', {
        //   value: fetchedAnalysis.createdAt,
        //   type: typeof fetchedAnalysis.createdAt,
        //   isValid: fetchedAnalysis.createdAt && !isNaN(new Date(fetchedAnalysis.createdAt).getTime())
        // });

        // [Defensive Code] - Enhanced data type safety
        // Ensure pivotTables is always a valid object with arrays
        if (fetchedAnalysis.pivotTables && typeof fetchedAnalysis.pivotTables === 'object') {
          const safePivotTables = {};
          Object.keys(fetchedAnalysis.pivotTables).forEach(key => {
            const value = fetchedAnalysis.pivotTables[key];
            //console.log(`🔍 Processing pivot table key "${key}":`, { value, type: typeof value, isArray: Array.isArray(value) });
            
            if (Array.isArray(value)) {
              safePivotTables[key] = value;
            } else if (value && typeof value === 'object') {
              // Convert object to array if needed
              console.log(`🔄 Converting object to array for key "${key}":`, value);
              safePivotTables[key] = Object.values(value);
            } else {
              console.log(`⚠️ Invalid value for key "${key}":`, value);
              safePivotTables[key] = [];
            }
          });
          fetchedAnalysis.pivotTables = safePivotTables;
        } else {
          // If pivotTables is missing or invalid, try to use pivotData
          if (Array.isArray(fetchedAnalysis.pivotData) && fetchedAnalysis.pivotData.length > 0) {
            console.warn('Legacy array-based pivotData detected. Converting to object format.');
            const pivotObject = fetchedAnalysis.pivotData[0]; 
            if (typeof pivotObject === 'object' && pivotObject !== null) {
              fetchedAnalysis.pivotTables = pivotObject;
            } else {
              fetchedAnalysis.pivotTables = {};
            }
          } else {
            fetchedAnalysis.pivotTables = {};
          }
        }

        // Ensure other arrays are also safe
        fetchedAnalysis.rawData = Array.isArray(fetchedAnalysis.rawData) ? fetchedAnalysis.rawData : [];
        fetchedAnalysis.classifiedData = Array.isArray(fetchedAnalysis.classifiedData) ? fetchedAnalysis.classifiedData : [];
        
        console.log('📊 Final processed analysis data:', {
          hasPivotTables: !!fetchedAnalysis.pivotTables,
          pivotTableKeys: Object.keys(fetchedAnalysis.pivotTables || {}),
          pivotTableLengths: Object.keys(fetchedAnalysis.pivotTables || {}).map(key => {
            const data = fetchedAnalysis.pivotTables[key];
            return {
              key,
              isArray: Array.isArray(data),
              length: Array.isArray(data) ? data.length : 'N/A',
              sample: Array.isArray(data) && data.length > 0 ? data[0] : null
            };
          })
        });
        
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
      //console.log('🔍 Fetching analysis list for user:', userId);
      
      if (!userId) {
        console.error('❌ No user ID available');
        return;
      }

      const response = await fetch(`${config.api.baseURL}/api/analyses`, {
        headers: {
          'x-user-id': userId,
          'Content-Type': 'application/json'
        }
      });

      //console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response not ok:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      //console.log('📊 Analysis list result:', result);
      
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

  // 히트맵 이미지를 생성하여 analysisData에 추가하는 함수
  const generateHeatmapImage = async () => {
    if (heatmapRef.current && analysis?.pivotTables?.Campaign) {
      try {
        const heatmapImage = heatmapRef.current.getImageAsBase64();
        if (heatmapImage) {
          //console.log('🔥 Generated heatmap image:', heatmapImage.length, 'characters');
          setAnalysis(prev => ({
            ...prev,
            heatmapImage: heatmapImage
          }));
          return heatmapImage;
        }
      } catch (error) {
        console.error('❌ Error generating heatmap image:', error);
      }
    }
    return null;
  };

  // 히트맵 이미지를 저장하는 함수
  const saveHeatmapImage = async (heatmapImage) => {
    if (!analysis || !analysis.fileName || !userId) return;

    let idToSave = analysis.analysisId || analysis._id;
    if (!idToSave) {
      console.error('Cannot save analysis without an ID.');
      return;
    }

    try {
      const response = await fetch(`${config.api.baseURL}/api/analysis/save`, {
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
        //console.log('✅ Analysis saved successfully');
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
      // 히트맵 이미지가 없다면 먼저 생성
      if (heatmapRef.current && !analysis.heatmapImage) {
        const heatmapImage = await generateHeatmapImage();
        if (heatmapImage) {
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

  // analysisId가 변경될 때 상태 리셋
  useEffect(() => {
    setHasSaved(false);
    setHasGeneratedHeatmap(false);
  }, [analysisId]);
  
  useEffect(() => {
    if (analysis && analysis.pivotTables && !hasSaved) {
      // For new analyses, a heatmap might not be rendered yet.
      // We save once with heatmap, or just save the data if no heatmap.
      const timer = setTimeout(async () => {
        // 히트맵 이미지 생성
        const heatmapImage = await generateHeatmapImage();
        await saveHeatmapImage(heatmapImage);
        setHasSaved(true); // 저장 완료 표시
      }, 1000); // Delay to allow heatmap to render
      
      return () => clearTimeout(timer);
    }
  }, [analysis, userId, hasSaved]);

  // 히트맵이 렌더링된 후 자동으로 이미지 생성 (한 번만)
  useEffect(() => {
    if (analysis?.pivotTables?.Campaign && !analysis.heatmapImage && !hasGeneratedHeatmap) {
      const generateImage = async () => {
        // 히트맵이 완전히 렌더링될 때까지 대기 (더 짧게 조정)
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const heatmapImage = await generateHeatmapImage();
        if (heatmapImage) {
          console.log('🔥 Auto-generated heatmap image and saved to analysis');
          await saveHeatmapImage(heatmapImage);
          setHasGeneratedHeatmap(true); // 생성 완료 표시
        }
      };
      
      generateImage();
    }
  }, [analysis?.pivotTables?.Campaign, analysis?.heatmapImage, hasGeneratedHeatmap]);

  // 분석 데이터가 변경될 때마다 로깅
  // useEffect(() => {
  //   if (analysis) {
  //     console.log('📊 Analysis state updated:', {
  //       hasPivotTables: !!analysis.pivotTables,
  //       pivotTablesType: typeof analysis.pivotTables,
  //       pivotTablesKeys: analysis.pivotTables ? Object.keys(analysis.pivotTables) : [],
  //       hasCampaign: analysis.pivotTables && analysis.pivotTables.Campaign,
  //       campaignType: analysis.pivotTables?.Campaign ? typeof analysis.pivotTables.Campaign : 'undefined',
  //       campaignLength: analysis.pivotTables?.Campaign ? (Array.isArray(analysis.pivotTables.Campaign) ? analysis.pivotTables.Campaign.length : 'not array') : 'undefined'
  //     });
  //   }
  // }, [analysis]);

  // AI 인사이트 생성 함수 (개선된 버전)
  const generateInsights = async () => {
    if (!analysis || !analysis.pivotTables) {
      console.error('❌ No analysis data or pivot tables available');
      alert('분석 데이터나 피봇 테이블이 없습니다. 페이지를 새로고침해주세요.');
      return;
    }

    // 피봇 테이블 데이터 검증
    const validatedPivotTables = {};
    let hasValidData = false;

    Object.entries(analysis.pivotTables).forEach(([key, data]) => {
      if (Array.isArray(data) && data.length > 0) {
        const validData = data.filter(item => item && typeof item === 'object');
        if (validData.length > 0) {
          validatedPivotTables[key] = validData;
          hasValidData = true;
          console.log(`✅ Valid pivot table "${key}": ${validData.length} items`);
        } else {
          console.warn(`⚠️ No valid items in pivot table "${key}"`);
        }
      } else {
        console.warn(`⚠️ Invalid pivot table data for "${key}":`, data);
      }
    });

    if (!hasValidData) {
      console.error('❌ No valid pivot table data found');
      alert('유효한 피봇 테이블 데이터가 없습니다. 분석을 다시 실행해주세요.');
      return;
    }

    setGeneratingInsights(true);
    
    try {
      console.log('🤖 === GENERATING AI INSIGHTS ===');
      console.log('🔗 API URL:', config.api.baseURL);
      console.log('👤 User ID:', userId);
      console.log('📊 Analysis ID:', analysis._id || analysis.analysisId);
      console.log('📊 Validated pivot tables:', {
        keys: Object.keys(validatedPivotTables),
        totalItems: Object.values(validatedPivotTables).reduce((sum, data) => sum + data.length, 0)
      });
      
      const requestBody = {
        analysisId: analysis._id || analysis.analysisId,
        pivotTables: validatedPivotTables
      };
      
      console.log('📤 Request body:', {
        analysisId: requestBody.analysisId,
        pivotTablesKeys: Object.keys(requestBody.pivotTables),
        bodySize: JSON.stringify(requestBody).length
      });
      
      const response = await fetch(`${config.api.baseURL}/api/analysis/insights`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('📡 Response status:', response.status);
      console.log('📡 Response status text:', response.statusText);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
      
      // 응답 텍스트 먼저 읽기 (디버깅용)
      const responseText = await response.text();
      console.log('📡 Raw response text:', responseText.substring(0, 500));
      
      if (!response.ok) {
        console.error('❌ HTTP Error:', response.status, response.statusText);
        console.error('❌ Response body:', responseText);
        
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        // 응답이 JSON인지 확인하고 에러 메시지 추출
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
          if (errorData.details) {
            errorMessage += ` (${errorData.details})`;
          }
        } catch (parseError) {
          console.warn('⚠️ Could not parse error response as JSON');
        }
        
        throw new Error(errorMessage);
      }
      
      // JSON 파싱
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Failed to parse response as JSON:', parseError);
        throw new Error('서버 응답을 파싱할 수 없습니다.');
      }
      
      console.log('📥 Parsed response:', {
        success: result.success,
        hasInsights: !!result.insights,
        insightsLength: result.insights ? result.insights.length : 0,
        error: result.error
      });
      
      if (result.success && result.insights) {
        console.log('✅ AI insights generated successfully');
        console.log('📝 Insights preview:', result.insights.substring(0, 200) + '...');
        
        // 분석 데이터 업데이트
        setAnalysis(prev => ({
          ...prev,
          insights: result.insights
        }));
        
        // 성공 메시지 (선택적)
        // alert('AI 인사이트가 성공적으로 생성되었습니다!');
      } else {
        console.error('❌ API returned unsuccessful result:', result);
        throw new Error(result.error || '알 수 없는 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('❌ === AI INSIGHTS GENERATION ERROR ===');
      console.error('❌ Error type:', error.constructor.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      
      let userMessage = 'AI 인사이트 생성에 실패했습니다.';
      
      if (error.message.includes('fetch')) {
        userMessage += ' 네트워크 연결을 확인해주세요.';
      } else if (error.message.includes('401')) {
        userMessage += ' 인증에 실패했습니다. 다시 로그인해주세요.';
      } else if (error.message.includes('404')) {
        userMessage += ' API 엔드포인트를 찾을 수 없습니다. 서버 상태를 확인해주세요.';
      } else if (error.message.includes('500')) {
        userMessage += ' 서버 내부 오류입니다. 잠시 후 다시 시도해주세요.';
      } else {
        userMessage += ` (${error.message})`;
      }
      
      alert(userMessage);
    } finally {
      setGeneratingInsights(false);
    }
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
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.05); }
          }
        `}
      </style>
      
      <Sidebar 
        isOpen={sidebarOpen && !chatSidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        analysisList={analysisList}
        currentAnalysisId={analysisId}
      />
      <ChatSidebar 
        isOpen={chatSidebarOpen} 
        onClose={handleChatSidebarClose} 
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
              backdropFilter: 'blur(10px)',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.95)';
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.8)';
              e.target.style.transform = 'scale(1)';
            }}
            title="Toggle Sidebar (⌘L)"
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
          {/* ... existing right side buttons ... */}
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
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1rem'
            }}>
              <h2 style={{
                fontSize: 'clamp(1.5rem, 3vw, 2rem)',
                fontWeight: '700',
                color: '#1e293b',
                margin: 0,
                letterSpacing: '-0.01em',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flex: 1
              }}>
                <span className="tossface">✨</span>
                {analysis.fileName}
              </h2>
              <button
                onClick={handleRename}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  transition: 'all 0.2s ease',
                  borderRadius: '6px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = '#64748b';
                  e.target.style.background = 'rgba(100, 116, 139, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = '#94a3b8';
                  e.target.style.background = 'transparent';
                }}
                title="Rename analysis"
              >
                <Edit size={16} />
              </button>
            </div>
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
                  {(() => {
                    try {
                      // createdAt이 있고 유효한 날짜인지 확인
                      if (analysis.createdAt && !isNaN(new Date(analysis.createdAt).getTime())) {
                        return new Date(analysis.createdAt).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        });
                      } else {
                        // createdAt이 없거나 유효하지 않으면 현재 시간 사용 (워닝 없이)
                        return new Date().toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        });
                      }
                    } catch (error) {
                      console.error('❌ Error formatting date:', error);
                      return new Date().toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      });
                    }
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Pivot Tables */}
          {(() => {
            //console.log('🔍 Checking pivotTables condition:', !!analysis.pivotTables);
            //console.log('🔍 pivotTables content:', analysis.pivotTables);
            
            // pivotTables가 존재하고 객체이며, 최소 하나의 키가 있고, 그 값이 배열인지 확인
            const hasValidPivotTables = analysis.pivotTables && 
              typeof analysis.pivotTables === 'object' && 
              Object.keys(analysis.pivotTables).length > 0 &&
              Object.values(analysis.pivotTables).some(data => Array.isArray(data) && data.length > 0);
            
            //console.log('🔍 hasValidPivotTables:', hasValidPivotTables);
            
            if (!hasValidPivotTables) {
              return (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: '20px',
                  padding: '2rem',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
                  marginBottom: '2rem',
                  textAlign: 'center',
                  color: '#64748b'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: '600' }}>
                    No Pivot Tables Available
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.95rem' }}>
                    Pivot table data is not available for this analysis.
                  </p>
                </div>
              );
            }
            
            // 안전하게 피봇 테이블 데이터 처리
            const validPivotTables = [];
            
            try {
              Object.entries(analysis.pivotTables).forEach(([level, data]) => {
                //console.log(`🔍 Processing pivot table "${level}":`, { data, type: typeof data, isArray: Array.isArray(data) });
                
                if (Array.isArray(data) && data.length > 0) {
                  // 각 배열 항목이 객체인지 확인
                  const validData = data.filter(item => {
                    const isValid = item && typeof item === 'object' && !Array.isArray(item);
                    if (!isValid) {
                      console.warn(`⚠️ Invalid item in ${level}:`, item);
                    }
                    return isValid;
                  });
                  
                  if (validData.length > 0) {
                    validPivotTables.push({ level, data: validData });
                    //console.log(`✅ Valid pivot table "${level}" with ${validData.length} items`);
                  } else {
                    console.warn(`⚠️ No valid items found in ${level}`);
                  }
                } else {
                  console.warn(`⚠️ Invalid data for ${level}:`, data);
                }
              });
            } catch (error) {
              // console.error('❌ Error processing pivot tables:', error);
            }
            
            //console.log('�� Valid pivot tables:', validPivotTables);
            
            if (validPivotTables.length === 0) {
              return (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: '20px',
                  padding: '2rem',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
                  marginBottom: '2rem',
                  textAlign: 'center',
                  color: '#64748b'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: '600' }}>
                    No Valid Pivot Tables
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.95rem' }}>
                    No valid pivot table data found in the analysis.
                  </p>
                </div>
              );
            }
            
            return (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
              }}>
                {validPivotTables.map(({ level, data }) => (
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
            const campaignData = analysis.pivotTables?.Campaign;
            const hasValidCampaignData = campaignData && 
              Array.isArray(campaignData) && 
              campaignData.length > 0;
            
            // console.log('🔥 Checking heatmap condition:', hasValidCampaignData);
            // console.log('🔥 Campaign data:', campaignData);
            
            if (!hasValidCampaignData) {
              return (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: '20px',
                  padding: '2rem',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
                  marginBottom: '2rem',
                  textAlign: 'center',
                  color: '#64748b'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔥</div>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: '600' }}>
                    No Heatmap Data Available
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.95rem' }}>
                    Campaign data is required to generate the performance heatmap.
                  </p>
                </div>
              );
            }
            
            return (
              <div style={{
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(20px)',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
                marginBottom: '2rem',
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
                      <p><span className="tossface">💡</span> <span className="pretendard">Darker colors indicate better performance.</span></p>
                      <p className="pretendard">CTR/CVR: The higher, the better | CPA: The lower, the better</p>
                    </div>
                    </div>
                  ) : (
                    // 이미지가 없으면 로딩 상태 표시
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                      <div style={{
                        width: '60px',
                        height: '60px',
                        margin: '0 auto 1rem',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'pulse 2s infinite'
                      }}>
                        <span className="tossface" style={{ fontSize: '1.8rem' }}>🔥</span>
                      </div>
                      <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>
                        Generating heatmap visualization...
                      </p>
                    </div>
                  )}
                  
                  {/* 숨겨진 HeatmapChart 컴포넌트 - 이미지 생성용 */}
                  <div style={{ 
                    position: 'absolute', 
                    left: '-9999px', 
                    top: '-9999px',
                    visibility: 'hidden',
                    pointerEvents: 'none'
                  }}>
                    <HeatmapChart 
                      ref={heatmapRef}
                      data={campaignData}
                      title="Campaign Performance Heatmap"
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* AI Insights Report */}
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
                AI-generated insights and recommendations
              </p>
            </div>
            <div style={{ padding: '0 2rem 2rem' }}>
              {analysis.insights ? (
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
              ) : (
                <div style={{
                  padding: '3rem 2rem',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.9)',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)'
                }}>
                  {generatingInsights ? (
                    <>
                      <div style={{
                        width: '60px',
                        height: '60px',
                        margin: '0 auto 1.5rem',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'pulse 2s infinite'
                      }}>
                        <span className="tossface" style={{ fontSize: '1.8rem' }}>🤖</span>
                      </div>
                      <h4 style={{
                        fontSize: '1.1rem',
                        fontWeight: '600',
                        color: '#1e293b',
                        margin: '0 0 0.5rem 0'
                      }}>
                        Generating AI Insights...
                      </h4>
                      <p style={{
                        color: '#64748b',
                        fontSize: '0.95rem',
                        margin: 0
                      }}>
                        This may take a few moments
                      </p>
                    </>
                  ) : (
                    <>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        margin: '0 auto 1.5rem',
                        background: 'rgba(102, 126, 234, 0.1)',
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <span className="tossface" style={{ fontSize: '2rem' }}>🤖</span>
                      </div>
                      <h4 style={{
                        fontSize: '1.1rem',
                        fontWeight: '600',
                        color: '#1e293b',
                        margin: '0 0 0.5rem 0'
                      }}>
                        No AI Insights Available
                      </h4>
                      <p style={{
                        color: '#64748b',
                        fontSize: '0.95rem',
                        margin: '0 0 1.5rem 0',
                        lineHeight: '1.5'
                      }}>
                        AI-powered analysis report has not been generated yet.
                      </p>
                      <button
                        onClick={generateInsights}
                        disabled={generatingInsights}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.75rem 1.5rem',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '10px',
                          cursor: generatingInsights ? 'not-allowed' : 'pointer',
                          fontSize: '0.95rem',
                          fontWeight: '600',
                          opacity: generatingInsights ? 0.7 : 1,
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!generatingInsights) {
                            e.target.style.transform = 'translateY(-1px)';
                            e.target.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.3)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!generatingInsights) {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = 'none';
                          }
                        }}
                      >
                        <span className="tossface">🚀</span>
                        Generate AI Insights
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      
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
          onClick={() => setRenameModal(false)}
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
                onClick={() => setRenameModal(false)}
                disabled={isRenaming}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'transparent',
                  border: '1px solid rgba(0, 0, 0, 0.2)',
                  borderRadius: '8px',
                  cursor: isRenaming ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  color: '#374151',
                  opacity: isRenaming ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                disabled={!newFileName.trim() || isRenaming}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#8b5cf6',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: newFileName.trim() && !isRenaming ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem',
                  color: 'white',
                  opacity: newFileName.trim() && !isRenaming ? 1 : 0.5,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (newFileName.trim() && !isRenaming) {
                    e.target.style.background = '#7c3aed';
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#8b5cf6';
                }}
              >
                {isRenaming ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      
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
const PivotTableCard = ({ level, data, formatNumber }) => {
  // 데이터 안전성 검사 및 변환
  const safeData = React.useMemo(() => {
    if (!data) return [];
    
    // 배열이 아닌 경우 배열로 변환
    if (!Array.isArray(data)) {
      if (typeof data === 'object' && data !== null) {
        return Object.values(data);
      }
      return [];
    }
    
    // 배열의 각 항목이 객체인지 확인하고 안전하게 변환
    return data.filter(item => item && typeof item === 'object').map(item => {
      const safeItem = {};
      Object.keys(item).forEach(key => {
        const value = item[key];
        if (value !== null && value !== undefined) {
          safeItem[key] = value;
        }
      });
      return safeItem;
    });
  }, [data]);

  if (!safeData || safeData.length === 0) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
        padding: '2rem',
        textAlign: 'center',
        color: '#64748b'
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
        <p>No data available for {level}</p>
      </div>
    );
  }

  return (
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
              {safeData.slice(0, 6).map((row, idx) => (
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
                      {row[level] || `Item ${idx + 1}`}
                    </div>
                  </td>
                  <td style={{
                    textAlign: 'right',
                    padding: '0.75rem',
                    color: '#1e293b',
                    fontWeight: '600'
                  }}>
                    {formatNumber(row.impressions || row.Impression || 0)}
                  </td>
                  <td style={{
                    textAlign: 'right',
                    padding: '0.75rem',
                    color: '#1e293b',
                    fontWeight: '600'
                  }}>
                    {row.ctr || row.CTR || '0%'}
                  </td>
                  <td style={{
                    textAlign: 'right',
                    padding: '0.75rem',
                    color: '#1e293b',
                    fontWeight: '600'
                  }}>
                    {formatNumber(row.orders || row.Purchase || 0)}
                  </td>
                </tr>
              ))}
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

export default AnalysisPage;