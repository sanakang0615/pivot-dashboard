import React, { useState, useEffect } from 'react';

const ColumnMappingModal = ({ 
  isOpen, 
  onClose, 
  mappingResult, 
  onConfirm,
  loading = false 
}) => {
  const [editedMapping, setEditedMapping] = useState({});
  
  const standardColumns = [
    'Date', 'Campaign', 'Ad Set', 'Ad', 
    'Cost', 'Impression', 'Click', 'Purchase', 'Revenue'
  ];

  useEffect(() => {
    if (mappingResult?.mapping) {
      setEditedMapping(mappingResult.mapping);
    }
  }, [mappingResult]);

  const handleMappingChange = (userColumn, standardColumn) => {
    setEditedMapping(prev => ({
      ...prev,
      [userColumn]: standardColumn
    }));
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceIcon = (confidence) => {
    if (confidence >= 0.9) return '✅';
    if (confidence >= 0.7) return '⚠️';
    return '❌';
  };

  const handleConfirm = () => {
    // 빈 매핑 제거
    const cleanedMapping = Object.entries(editedMapping)
      .filter(([key, value]) => value && value.trim() !== '')
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});
    
    onConfirm(cleanedMapping);
  };

  const getMappedStandardColumns = () => {
    return Object.values(editedMapping).filter(col => col);
  };

  const getUnmappedStandardColumns = () => {
    const mapped = getMappedStandardColumns();
    return standardColumns.filter(col => !mapped.includes(col));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-ㅊlg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Column Mapping Review</h2>
          {/* <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button> */}
        </div>
        
        <div className="mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">📋 Mapping Guide</h3>
            <p className="text-blue-700 text-sm">
              The columns of the uploaded file have been automatically mapped to standard marketing data columns. If you need to make changes, please select the correct column from the dropdown.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 매핑 설정 영역 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Column Mapping Settings</h3>
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-xs text-gray-500 font-semibold">업로드 파일의 컬럼</span>
              <span className="text-xs text-gray-500 font-semibold">스탠다드 컬럼명</span>
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
                        className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">매핑 안함</option>
                        {standardColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* 매핑 상태 요약 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Mapping Status</h3>
            
            {/* 매핑된 컬럼들 */}
            <div className="mb-4">
              <h4 className="font-medium text-green-700 mb-2">✅ Mapped Standard Columns</h4>
              <div className="bg-green-50 border border-green-200 rounded p-3">
                {getMappedStandardColumns().length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {getMappedStandardColumns().map((col, idx) => (
                      <span key={col + '-' + idx} className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                        {col}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-green-600 text-sm">아직 매핑된 컬럼이 없습니다.</p>
                )}
              </div>
            </div>

            {/* 누락된 컬럼들 */}
            {getUnmappedStandardColumns().length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-orange-700 mb-2">⚠️ Missing Standard Columns</h4>
                <div className="bg-orange-50 border border-orange-200 rounded p-3">
                  <div className="flex flex-wrap gap-2">
                    {getUnmappedStandardColumns().map((col, idx) => (
                      <span key={col + '-' + idx} className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm">
                        {col}
                      </span>
                    ))}
                  </div>
                  <p className="text-orange-600 text-xs mt-2">
                    이 컬럼들은 분석에 포함되지 않습니다.
                  </p>
                </div>
              </div>
            )}

            {/* 매핑되지 않은 원본 컬럼들 */}
            {mappingResult?.unmapped?.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-700 mb-2">🔍 Unmapped Columns</h4>
                <div className="bg-gray-50 border border-gray-200 rounded p-3">
                  <div className="flex flex-wrap gap-2">
                    {mappingResult.unmapped.map((col, idx) => (
                      <span key={col + '-' + idx} className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-sm">
                        {col}
                      </span>
                    ))}
                  </div>
                  <p className="text-gray-500 text-xs mt-2">
                    이 컬럼들은 자동 매핑에 실패했습니다. 필요시 수동으로 매핑해주세요.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 제안사항 */}
        {mappingResult?.suggestions && Object.keys(mappingResult.suggestions).length > 0 && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-800 mb-2">💡 Mapping Suggestions</h4>
            {Object.entries(mappingResult.suggestions).map(([col, suggestions]) => (
              <div key={col} className="text-yellow-700 text-sm mb-1">
                <strong>{col}</strong>: {suggestions.join(' 또는 ')}
              </div>
            ))}
          </div>
        )}

        {/* 버튼 영역 */}
        <div className="flex justify-between items-center mt-8">
          <div className="text-sm text-gray-500">
            {getMappedStandardColumns().length}/{standardColumns.length} 개 컬럼이 매핑됨
          </div>
          
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
              disabled={loading || getMappedStandardColumns().length === 0}
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