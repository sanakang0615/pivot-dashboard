import React, { useState, useEffect } from 'react';
import ProgressSteps from './Common/ProgressSteps';

const ColumnMappingModal = ({ 
  isOpen, 
  onClose, 
  mappingResult, 
  onConfirm,
  loading = false,
  isMainPage = false
}) => {
  const [editedMapping, setEditedMapping] = useState({});
  const [showTip, setShowTip] = useState(false);
  const [columnRecommendations, setColumnRecommendations] = useState(null);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  
  // 새로운 표준화된 컬럼 구조
  const standardColumns = {
    dimensions: [
      { name: 'Account Name', key: 'account_name', required: true },
      { name: 'Account ID', key: 'account_id', required: true },
      // { name: 'Date', key: 'date', required: true },
      { name: 'Date', key: 'date', required: false },
      { name: 'Campaign Name', key: 'campaign_name', required: true },
      { name: 'Campaign ID', key: 'campaign_id', required: true },
      { name: 'Ad Pack Name', key: 'ad_pack_name', required: true },
      { name: 'Ad Pack ID', key: 'ad_pack_id', required: true },
      { name: 'Ad Name', key: 'ad_name', required: true },
      { name: 'Ad ID', key: 'ad_id', required: true },
      { name: 'Platform', key: 'platform', required: true },
      // { name: 'Objective', key: 'objective', required: true },
      { name: 'Objective', key: 'objective', required: false },
      { name: 'Age', key: 'age', required: false },
      { name: 'Gender', key: 'gender', required: false },
      { name: 'Image URL', key: 'image_url', required: false },
      { name: 'Video URL', key: 'video_url', required: false }
    ],
    metrics: [
      { name: 'Impressions', key: 'impressions', required: true },
      { name: 'Clicks', key: 'clicks', required: true },
      { name: 'Link Clicks', key: 'link_clicks', required: false },
      { name: 'Cost', key: 'cost', required: true },
      { name: 'Reach', key: 'reach', required: false },
      { name: 'Views', key: 'views', required: false },
      { name: 'Installs', key: 'installs', required: false },
      { name: 'Orders', key: 'orders', required: false },
      { name: 'Revenue', key: 'revenue', required: false },
      { name: 'Engagements', key: 'engagements', required: false },
      { name: 'Content Views', key: 'content_views', required: false },
      { name: 'Content Views (All)', key: 'content_views_all', required: false }
    ]
  };

  // 모든 표준 컬럼을 평면화
  const getAllStandardColumns = () => {
    return [
      ...standardColumns.dimensions.map(col => ({ ...col, category: 'dimensions' })),
      ...standardColumns.metrics.map(col => ({ ...col, category: 'metrics' }))
    ];
  };

  // 필수 컬럼만 가져오기
  const getRequiredColumns = () => {
    return getAllStandardColumns().filter(col => col.required);
  };

  useEffect(() => {
    if (mappingResult?.mapping) {
      setEditedMapping(mappingResult.mapping);
      //console.log('🔍 ColumnMappingModal: Initial mapping set:', mappingResult.mapping);
    }
  }, [mappingResult]);

  // 컬럼 그룹화 및 추천 API 호출
  const fetchColumnRecommendations = async () => {
    if (!mappingResult?.unmapped || mappingResult.unmapped.length === 0) {
      console.log('🔍 No unmapped columns, skipping recommendations');
      return;
    }

    console.log('🔍 Fetching column recommendations for:', mappingResult.unmapped);
    setLoadingRecommendations(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/mapping/group-and-recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          columns: mappingResult.unmapped,
          campaignContext: mappingResult.campaignContext
        })
      });

      console.log('🔍 API Response status:', response.status);
      const data = await response.json();
      console.log('🔍 API Response data:', data);
      
      if (data.success) {
        setColumnRecommendations(data);
        console.log('🔍 Column recommendations set:', data);
        console.log('🔍 Recommendations count:', data.recommendations?.length || 0);
      } else {
        console.error('🔍 API returned success: false:', data);
      }
    } catch (error) {
      console.error('Failed to fetch column recommendations:', error);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  useEffect(() => {
    if (mappingResult?.unmapped && mappingResult.unmapped.length > 0) {
      fetchColumnRecommendations();
    }
  }, [mappingResult?.unmapped]);

  const handleMappingChange = (userColumn, standardColumn) => {
    //console.log('🔍 ColumnMappingModal: Mapping change:', { userColumn, standardColumn });
    setEditedMapping(prev => {
      const newMapping = {
        ...prev,
        [userColumn]: standardColumn
      };
      //console.log('🔍 ColumnMappingModal: Updated mapping:', newMapping);
      return newMapping;
    });
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceIcon = (confidence) => {
    if (confidence >= 0.9) return <span className="tossface">✅</span>;
    if (confidence >= 0.7) return <span className="tossface">⚠️</span>;
    return <span className="tossface">❌</span>;
  };

  const handleConfirm = () => {
    // 빈 매핑 제거
    const cleanedMapping = Object.entries(editedMapping)
      .filter(([key, value]) => value && value.trim() !== '')
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});
    
    //l: Final mapping to confirm:', cleanedMapping);
    onConfirm(cleanedMapping);
  };

  const getMappedStandardColumns = () => {
    const mapped = Object.values(editedMapping).filter(col => col);
    //console.log('🔍 ColumnMappingModal: Mapped standard columns:', mapped);
    return mapped;
  };

  const getUnmappedStandardColumns = () => {
    const mapped = getMappedStandardColumns();
    const allColumns = getAllStandardColumns();
    return allColumns.filter(col => !mapped.includes(col.key));
  };

  const getUnmappedRequiredColumns = () => {
    const mapped = getMappedStandardColumns();
    const requiredColumns = getRequiredColumns();
    const unmapped = requiredColumns.filter(col => !mapped.includes(col.key));
    //console.log('🔍 ColumnMappingModal: Unmapped required columns:', unmapped);
    return unmapped;
  };

  // 매핑된 컬럼들의 상세 정보를 가져오는 함수 추가
  const getMappedColumnsDetails = () => {
    const mappedKeys = getMappedStandardColumns();
    const details = getAllStandardColumns().filter(col => mappedKeys.includes(col.key));
    //console.log('🔍 ColumnMappingModal: Mapped columns details:', details);
    return details;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 mt-4">
          <div className="flex items-center gap-2 relative">
            <h2 className="text-2xl font-bold text-gray-800">Column Mapping Review</h2>
            {!isMainPage && (
              <button
                onClick={() => setShowTip(!showTip)}
                className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 text-sm font-medium transition-colors"
                title="Campaign Context 정보 보기"
              >
                <span className="tossface">ℹ️</span>
              </button>
            )}
            
            {/* Campaign Context Tooltip */}
            {!isMainPage && showTip && mappingResult?.campaignContext && (
              <div className="absolute top-full left-0 mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg shadow-lg z-[9999] min-w-[300px]">
                <h4 className="font-medium text-blue-800 mb-1 text-sm">🎯 Campaign Context</h4>
                <p className="text-blue-700 text-xs">
                  Brand: <span className="font-medium">{mappingResult.campaignContext.brand}</span> | 
                  Product: <span className="font-medium">{mappingResult.campaignContext.product}</span> | 
                  Industry: <span className="font-medium">{mappingResult.campaignContext.industry}</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Progress Steps */}
        {/* <div className="mb-6">
          <ProgressSteps currentStep={3} />
        </div> */}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 ">
          {/* 매핑 설정 영역 */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-xs text-gray-500 font-semibold">업로드 파일의 컬럼</span>
              <span className="text-xs text-gray-500 font-semibold">표준 컬럼명</span>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {(() => {
                const allUserColumns = [
                  ...new Set([
                    ...Object.keys(editedMapping),
                    ...(mappingResult?.unmapped || [])
                  ])
                ];
                return allUserColumns.map((userColumn, idx) => (
                  <div key={userColumn + '-' + idx} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <span className="font-medium text-gray-800 truncate" title={userColumn}>
                          {userColumn}
                        </span>
                        {mappingResult?.confidence?.[userColumn] && (
                          <span className="ml-2 flex items-center">
                            <span className="text-lg">
                              {getConfidenceIcon(mappingResult.confidence[userColumn])}
                            </span>
                            <span className={`ml-1 text-xs ${getConfidenceColor(mappingResult.confidence[userColumn])}`}>
                              {Math.round(mappingResult.confidence[userColumn] * 100)}%
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center ml-4">
                      <span className="mx-3 text-gray-400">→</span>
                      <select 
                        value={editedMapping[userColumn] || ''} 
                        onChange={(e) => handleMappingChange(userColumn, e.target.value)}
                        className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                      >
                        <option value="">매핑 안함</option>
                        
                        {/* Dimensions Section */}
                        <optgroup label="Dimensions (계정, 캠페인, 광고 정보)">
                          {standardColumns.dimensions.map(col => (
                            <option key={col.key} value={col.key} className={col.required ? 'font-semibold' : ''}>
                              {col.name} {col.required ? '*' : ''}
                            </option>
                          ))}
                        </optgroup>
                        
                        {/* Metrics Section */}
                        <optgroup label="Metrics (성과 지표 및 수치)">
                          {standardColumns.metrics.map(col => (
                            <option key={col.key} value={col.key} className={col.required ? 'font-semibold' : ''}>
                              {col.name} {col.required ? '*' : ''}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* 매핑 상태 요약 */}
          <div>
            

            {/* 컬럼 추천 섹션 */}
            {(() => {
              console.log('🔍 Rendering recommendations section:');
              console.log('  - columnRecommendations:', !!columnRecommendations);
              console.log('  - recommendations:', columnRecommendations?.recommendations);
              console.log('  - recommendations type:', typeof columnRecommendations?.recommendations);
              console.log('  - isArray:', Array.isArray(columnRecommendations?.recommendations));
              console.log('  - constructor:', columnRecommendations?.recommendations?.constructor?.name);
              console.log('  - keys:', Object.keys(columnRecommendations?.recommendations || {}));
              
              // 안전한 배열 변환 함수
              const getRecommendationsArray = (recs) => {
                if (Array.isArray(recs)) return recs;
                if (typeof recs === 'object' && recs !== null) {
                  // recommendations 객체 안에 recommendations 배열이 있는 경우
                  if (recs.recommendations && Array.isArray(recs.recommendations)) {
                    return recs.recommendations;
                  }
                  // 객체의 값들을 배열로 변환
                  return Object.values(recs);
                }
                return [];
              };
              
              const recommendationsArray = getRecommendationsArray(columnRecommendations?.recommendations);
              
              if (recommendationsArray.length === 0) {
                return null; // 추천이 없으면 섹션을 표시하지 않음
              }
              
              return (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3 text-blue-800">Grouping Recommendation</h3>
                  <div className="space-y-3">
                    {recommendationsArray.map((rec, idx) => {
                      // 해당 그룹의 묶인 컬럼들 찾기
                      const groupedItems = columnRecommendations?.groupedColumns?.[rec.group] || [];
                      
                      return (
                        <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                                  <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-800 text-sm">
                              {rec.group}
                            </h4>
                            <span className="tossface text-blue-500">→</span>
                            <span className="text-sm font-medium text-gray-900">
                              추천 컬럼: <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">{rec.recommendedColumn}</span>
                            </span>
                          </div>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {groupedItems.length}개
                          </span>
                        </div>
                        
                        <div className="mb-3">
                          <p className="text-xs text-gray-700 leading-relaxed">
                            {rec.reason}
                          </p>
                        </div>
                        
                        {/* 묶인 컬럼들 표시 */}
                        {groupedItems.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs text-gray-600 mb-2">묶인 컬럼들:</p>
                            <div className="flex flex-wrap gap-2">
                              {groupedItems.map((item, itemIdx) => (
                                <span key={itemIdx} className="text-xs bg-gray-200 text-gray-800 px-3 py-1 rounded border border-gray-300">
                                  {item.original}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {rec.alternatives && rec.alternatives.length > 0 && (
                          <div className="mt-4">
                            <p className="text-xs text-gray-600 mb-2">대안 컬럼:</p>
                            <div className="flex flex-wrap gap-2">
                              {rec.alternatives.map((alt, altIdx) => (
                                <span key={altIdx} className="text-xs bg-gray-200 text-gray-800 px-3 py-1 rounded border border-gray-300">
                                  {alt}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}



            <h3 className="text-lg font-semibold mb-2">Unmapped Columns</h3>

            {/* 매핑되지 않은 컬럼들 (사용자 파일 + 표준 컬럼) */}
            {(mappingResult?.unmapped?.length > 0 || getUnmappedStandardColumns().length > 0) && (
              <div className="mt-4 mb-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* 왼쪽: 사용자 파일의 매핑되지 않은 컬럼들 */}
                  {mappingResult?.unmapped?.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded p-3">
                      <h4 className="font-medium text-gray-700 mb-3 text-sm">User File</h4>
                      
                      {/* Dimensions */}
                      {(() => {
                        const unmappedDimensions = mappingResult.unmapped.filter(col => {
                          const lowerCol = col.toLowerCase();
                          return lowerCol.includes('account') || lowerCol.includes('campaign') || 
                                 lowerCol.includes('ad') || lowerCol.includes('platform') || 
                                 lowerCol.includes('objective') || lowerCol.includes('date') ||
                                 lowerCol.includes('age') || lowerCol.includes('gender');
                        });
                        
                        if (unmappedDimensions.length > 0) {
                          return (
                            <div className="mb-3">
                              <h5 className="font-medium text-gray-600 mb-2 text-xs">Dimensions</h5>
                              <div className="flex flex-wrap gap-1">
                                {unmappedDimensions.map((col, idx) => {
                                  const isRequired = standardColumns.dimensions.some(dim => 
                                    dim.required && (col.toLowerCase().includes(dim.key.replace('_', '')) || 
                                                   dim.key.replace('_', '').includes(col.toLowerCase()))
                                  );
                                  return (
                                    <span key={col + '-' + idx} className={`px-2 py-1 rounded text-xs ${
                                      isRequired 
                                        ? 'border border-red-300 bg-red-50 text-red-700 font-medium' 
                                        : 'bg-gray-100 text-gray-600'
                                    }`}>
                                      {col}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Metrics */}
                      {(() => {
                        const unmappedMetrics = mappingResult.unmapped.filter(col => {
                          const lowerCol = col.toLowerCase();
                          return lowerCol.includes('impression') || lowerCol.includes('click') || 
                                 lowerCol.includes('cost') || lowerCol.includes('spend') || 
                                 lowerCol.includes('revenue') || lowerCol.includes('conversion') ||
                                 lowerCol.includes('order') || lowerCol.includes('purchase') ||
                                 lowerCol.includes('reach') || lowerCol.includes('view') ||
                                 lowerCol.includes('install') || lowerCol.includes('engagement');
                        });
                        
                        if (unmappedMetrics.length > 0) {
                          return (
                            <div className="mb-3">
                              <h5 className="font-medium text-gray-600 mb-2 text-xs">Metrics</h5>
                              <div className="flex flex-wrap gap-1">
                                {unmappedMetrics.map((col, idx) => {
                                  const isRequired = standardColumns.metrics.some(metric => 
                                    metric.required && (col.toLowerCase().includes(metric.key.replace('_', '')) || 
                                                      metric.key.replace('_', '').includes(col.toLowerCase()))
                                  );
                                  return (
                                    <span key={col + '-' + idx} className={`px-2 py-1 rounded text-xs ${
                                      isRequired 
                                        ? 'border border-red-300 bg-red-50 text-red-700 font-medium' 
                                        : 'bg-gray-100 text-gray-600'
                                    }`}>
                                      {col}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
                  
                  {/* 오른쪽: 표준 컬럼 중 매핑되지 않은 것들 */}
                  {getUnmappedStandardColumns().length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded p-3">
                      <h4 className="font-medium text-gray-700 mb-3 text-sm">Standard</h4>
                      
                      {/* Standard Dimensions */}
                      {(() => {
                        const unmappedStandardDimensions = getUnmappedStandardColumns().filter(col => col.category === 'dimensions');
                        if (unmappedStandardDimensions.length > 0) {
                          return (
                            <div className="mb-3">
                              <h5 className="font-medium text-gray-600 mb-2 text-xs">Dimensions</h5>
                              <div className="flex flex-wrap gap-1">
                                {unmappedStandardDimensions.map((col, idx) => (
                                  <span key={col.key + '-' + idx} className={`px-2 py-1 rounded text-xs ${
                                    col.required 
                                      ? 'border border-red-300 bg-red-50 text-red-700 font-medium' 
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {col.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Standard Metrics */}
                      {(() => {
                        const unmappedStandardMetrics = getUnmappedStandardColumns().filter(col => col.category === 'metrics');
                        if (unmappedStandardMetrics.length > 0) {
                          return (
                            <div className="mb-3">
                              <h5 className="font-medium text-gray-600 mb-2 text-xs">Metrics</h5>
                              <div className="flex flex-wrap gap-1">
                                {unmappedStandardMetrics.map((col, idx) => (
                                  <span key={col.key + '-' + idx} className={`px-2 py-1 rounded text-xs ${
                                    col.required 
                                      ? 'border border-red-300 bg-red-50 text-red-700 font-medium' 
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {col.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
                </div>
                
                <p className="text-gray-500 text-xs mt-3">
                  <span className="font-medium">User File:</span> 업로드한 파일의 매핑되지 않은 컬럼들 | 
                  <span className="font-medium"> Standard:</span> 표준 컬럼 중 매핑되지 않은 것들 | 
                  <span className="text-red-600 font-medium">빨간색은 필수 컬럼</span>
                </p>
              </div>
            )}

          </div>
        </div>


        {/* 버튼 영역 */}
        <div className="flex justify-end items-center mt-8 mt-4">
          <div className="flex space-x-3">
            <button 
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
            <button 
              onClick={handleConfirm}
              disabled={loading || getUnmappedRequiredColumns().length > 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  분석 중...
                </>
              ) : (
                '분석 시작'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColumnMappingModal;