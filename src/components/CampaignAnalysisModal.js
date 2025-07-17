import React from 'react';
import ProgressSteps from './Common/ProgressSteps';

const CampaignAnalysisModal = ({ 
  isOpen, 
  onClose, 
  campaignAnalysis, 
  onContinue,
  loading = false 
}) => {
  if (!isOpen) return null;

  const getBrandColor = (brand) => {
    if (brand === '알 수 없는 브랜드') return 'text-gray-500';
    return 'text-blue-600';
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 mt-4">
          <h2 className="text-2xl font-bold text-gray-800 break-words">
            Campaign Analysis Results
            {campaignAnalysis && (
              <span className={`ml-2 text-sm font-normal ${getConfidenceColor(campaignAnalysis.confidence)}`}>
                (Confidence: {Math.round(campaignAnalysis.confidence * 100)}%)
              </span>
            )}
          </h2>
        </div>

        {/* Progress Steps */}
        {/* <div className="mb-6">
          <ProgressSteps currentStep={2} />
        </div> */}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mr-3"></div>
            <span className="text-lg text-gray-600">캠페인 분석 중...</span>
          </div>
        ) : campaignAnalysis ? (
          <div className="space-y-4">
            {/* Main Result */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-800 mb-4 text-lg">
                <span className="tossface">🎯</span> File Analysis Result
              </h3>
              
              <div className="space-y-4">
                {/* Analysis Table */}
                <div className="bg-white rounded-lg border border-blue-100 overflow-hidden">
                  <table className="w-full">
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="px-4 py-3 bg-gray-50 font-medium text-gray-700 w-1/3">Brand</td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-blue-600">
                            {campaignAnalysis.brand}
                          </span>
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="px-4 py-3 bg-gray-50 font-medium text-gray-700">Product</td>
                        <td className="px-4 py-3 text-gray-600">
                          {campaignAnalysis.product}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="px-4 py-3 bg-gray-50 font-medium text-gray-700">Industry</td>
                        <td className="px-4 py-3 text-gray-600">
                          {campaignAnalysis.industry}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 bg-gray-50 font-medium text-gray-700">Target Audience</td>
                        <td className="px-4 py-3 text-gray-600 text-sm">
                          {campaignAnalysis.target_audience && typeof campaignAnalysis.target_audience === 'object' ? (
                            <div className="space-y-1">
                              <div><span className="font-medium">연령대:</span> {campaignAnalysis.target_audience.demographics}</div>
                              <div><span className="font-medium">특징:</span> {campaignAnalysis.target_audience.characteristics}</div>
                            </div>
                          ) : (
                            <span>{campaignAnalysis.target_audience || 'Not specified'}</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Description */}
            {campaignAnalysis.description && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">
                  <span className="tossface">📝</span> Brand & Product Description
                </h4>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {campaignAnalysis.description}
                </p>
              </div>
            )}

            {/* Target Audience Analysis */}
            {campaignAnalysis.analysis_reason && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">
                  <span className="tossface">👥</span> Target Audience Analysis
                </h4>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {campaignAnalysis.analysis_reason}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">캠페인 분석 데이터를 사용할 수 없습니다.</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end items-center mt-8 mt-4">
          <div className="flex space-x-3">
            <button 
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Back
            </button>
            <button 
              onClick={onContinue}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Processing...
                </>
              ) : (
                'Continue to Column Mapping'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignAnalysisModal; 