import React from 'react';

const CampaignAnalysisModal = ({ 
  isOpen, 
  onClose, 
  campaignAnalysis, 
  onContinue,
  loading = false 
}) => {
  if (!isOpen) return null;

  const getBrandColor = (brand) => {
    if (brand === 'Unknown Brand') return 'text-gray-500';
    return 'text-blue-600';
  };

  const getIndustryColor = (industry) => {
    const colors = {
      'Technology': 'bg-blue-100 text-blue-800',
      'E-commerce': 'bg-green-100 text-green-800',
      'Finance': 'bg-purple-100 text-purple-800',
      'Healthcare': 'bg-red-100 text-red-800',
      'Education': 'bg-yellow-100 text-yellow-800',
      'Entertainment': 'bg-pink-100 text-pink-800',
      'Food & Beverage': 'bg-orange-100 text-orange-800',
      'Fashion': 'bg-indigo-100 text-indigo-800',
      'Beauty/Cosmetics': 'bg-pink-100 text-pink-800',
      'Marketing': 'bg-purple-100 text-purple-800'
    };
    return colors[industry] || 'bg-gray-100 text-gray-800';
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceIcon = (confidence) => {
    if (confidence >= 0.8) return '✅';
    if (confidence >= 0.6) return '⚠️';
    return '❌';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Campaign Analysis Results</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mr-3"></div>
            <span className="text-lg text-gray-600">Analyzing campaigns...</span>
          </div>
        ) : campaignAnalysis ? (
          <div className="space-y-6">
            {/* Main Result */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-800 mb-4 text-lg">🎯 File Analysis Result</h3>
              
              <div className="space-y-4">
                {/* Brand & Product */}
                <div className="bg-white rounded-lg p-4 border border-blue-100">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-800 mb-2">
                      This file contains data for:
                    </div>
                    <div className="text-xl font-semibold text-blue-600 mb-1">
                      {campaignAnalysis.brand}
                    </div>
                    <div className="text-lg text-gray-600 mb-3">
                      {campaignAnalysis.product}
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-lg">
                        {getConfidenceIcon(campaignAnalysis.confidence)}
                      </span>
                      <span className={`font-medium ${getConfidenceColor(campaignAnalysis.confidence)}`}>
                        Confidence: {Math.round(campaignAnalysis.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Industry & Target */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-blue-100">
                    <h4 className="font-medium text-gray-700 mb-2">Industry</h4>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getIndustryColor(campaignAnalysis.industry)}`}>
                      {campaignAnalysis.industry}
                    </span>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-blue-100">
                    <h4 className="font-medium text-gray-700 mb-2">Target Audience</h4>
                    <span className="text-gray-600 text-sm">
                      {campaignAnalysis.target_audience || 'Not specified'}
                    </span>
                  </div>
                </div>

                {/* Campaign Count */}
                <div className="bg-white rounded-lg p-4 border border-blue-100">
                  <h4 className="font-medium text-gray-700 mb-2">Data Overview</h4>
                  <div className="text-gray-600">
                    <span className="font-medium">{campaignAnalysis.total_campaigns}</span> unique campaigns analyzed
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            {campaignAnalysis.description && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">📝 Brand & Product Description</h4>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {campaignAnalysis.description}
                </p>
              </div>
            )}

            {/* Context Information */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-800 mb-2">💡 Context for Column Mapping</h4>
              <p className="text-yellow-700 text-sm">
                This analysis helps understand the context of your advertising data. 
                The identified brand and product information will be considered when mapping columns 
                to ensure appropriate categorization for this specific campaign type.
                {campaignAnalysis.brand === 'Unknown Brand' && (
                  <span className="block mt-2 text-orange-600 font-medium">
                    Note: Specific brand could not be identified. The system will use industry context for column mapping.
                  </span>
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No campaign analysis data available.</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-8">
          <div className="text-sm text-gray-500">
            {campaignAnalysis?.total_campaigns || 0} campaigns analyzed
          </div>
          
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