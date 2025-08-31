import React, { useState, useEffect } from 'react';
import { Database, FileText, ArrowRight, CheckCircle, Loader } from 'lucide-react';
import { getDatasetInfo } from '../../utils/parquetReader';
import { useAuth } from '@clerk/clerk-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { config } from '../../utils/config';

const DatasetSelector = ({ onDatasetSelected, onCancel }) => {
  const { userId, isSignedIn } = useAuth();
  const { t, language } = useLanguage();
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [datasetInfo, setDatasetInfo] = useState(null);

  const datasets = [
    {
      ...getDatasetInfo('campaign_data'),
      name: t('datasetSelector.campaignData.name'),
      description: t('datasetSelector.campaignData.description')
    },
    {
      ...getDatasetInfo('adpack_data'),
      name: t('datasetSelector.adpackData.name'),
      description: t('datasetSelector.adpackData.description')
    }
  ].filter(Boolean);

  const handleDatasetSelect = async (dataset) => {
    console.log('[DatasetSelector] handleDatasetSelect called with:', dataset);
    if (!isSignedIn || !userId) {
      setError('Please sign in to use datasets');
      return;
    }

    // 디버깅: 어떤 파일을 불러오는지 콘솔에 출력
    if (dataset && dataset.id) {
      const expectedPath = `/backend/data/${dataset.id}.parquet`;
      console.log(`[DatasetSelector] datasetId: ${dataset.id}, 예상 백엔드 파일 경로: ${expectedPath}`);
    }

    setSelectedDataset(dataset);
    setLoading(true);
    setError(null);

    try {
      // 백엔드 API를 통해 데이터셋 처리
      const response = await fetch(`${config.api.baseURL}/api/datasets/process`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({ 
          datasetId: dataset.id,
          language: language // 언어 정보 전달
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      setDatasetInfo({
        ...dataset,
        columns: result.columns,
        rowCount: result.rowCount,
        data: result.data,
        columnMapping: result.columnMapping
      });

    } catch (error) {
      console.error('Dataset loading failed:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };



  const confirmSelection = () => {
    if (datasetInfo) {
      onDatasetSelected(datasetInfo);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative'
      }}>
        <button
          onClick={onCancel}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.5rem',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>×</span>
        </button>

        {/* Header */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h2 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '600', 
            color: '#1f2937',
            marginBottom: '0.5rem'
          }}>
            {t('datasetSelector.title')}
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
            {t('datasetSelector.subtitle')}
          </p>
        </div>

        {/* Dataset Options */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ 
            display: 'grid', 
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))'
          }}>
            {datasets.map((dataset) => (
              <div
                key={dataset.id}
                onClick={() => handleDatasetSelect(dataset)}
                style={{
                  border: selectedDataset?.id === dataset.id 
                    ? '2px solid #10b981' 
                    : '2px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: selectedDataset?.id === dataset.id 
                    ? '#f0fdf4' 
                    : 'white',
                  position: 'relative'
                }}
              >
                {selectedDataset?.id === dataset.id && (
                  <div style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    color: '#10b981'
                  }}>
                    <CheckCircle size={20} />
                  </div>
                )}
                
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '2rem', marginRight: '1rem' }}>
                    {dataset.icon}
                  </span>
                  <div>
                    <h3 style={{ 
                      fontSize: '1.1rem', 
                      fontWeight: '600', 
                      color: '#1f2937',
                      margin: 0
                    }}>
                      {dataset.name}
                    </h3>
                    <p style={{ 
                      color: '#6b7280', 
                      fontSize: '0.9rem',
                      margin: '0.25rem 0 0 0'
                    }}>
                      {dataset.description}
                    </p>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  color: '#6b7280',
                  fontSize: '0.8rem'
                }}>
                  <Database size={14} style={{ marginRight: '0.5rem' }} />
                  {t('datasetSelector.parquetFile')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            color: '#6b7280'
          }}>
            <Loader size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
            <p>{t('datasetSelector.loading')}</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
            color: '#dc2626'
          }}>
            <p style={{ margin: 0 }}>Error: {error}</p>
          </div>
        )}

        {/* Dataset Info */}
        {datasetInfo && !loading && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '2rem'
          }}>
            <h4 style={{ 
              fontSize: '1rem', 
              fontWeight: '600', 
              color: '#1f2937',
              marginBottom: '1rem'
            }}>
              {t('datasetSelector.selectedInfo')}
            </h4>
            
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <p style={{ 
                  fontSize: '0.9rem', 
                  color: '#6b7280',
                  margin: '0 0 0.25rem 0'
                }}>
                  {t('datasetSelector.datasetName')}
                </p>
                <p style={{ 
                  fontSize: '1rem', 
                  fontWeight: '500',
                  margin: 0
                }}>
                  {datasetInfo.name}
                </p>
              </div>
              
              <div>
                <p style={{ 
                  fontSize: '0.9rem', 
                  color: '#6b7280',
                  margin: '0 0 0.25rem 0'
                }}>
                  {t('datasetSelector.numberOfColumns')}
                </p>
                <p style={{ 
                  fontSize: '1rem', 
                  fontWeight: '500',
                  margin: 0
                }}>
                  {datasetInfo.columns.length}
                </p>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <p style={{ 
                fontSize: '0.9rem', 
                color: '#6b7280',
                margin: '0 0 0.5rem 0'
              }}>
                {t('datasetSelector.includedColumns')}
              </p>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                {datasetInfo.columns.map((column, index) => (
                  <span
                    key={index}
                    style={{
                      background: '#e0e7ff',
                      color: '#3730a3',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: '500'
                    }}
                  >
                    {column}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '0.75rem 1.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              background: 'white',
              color: '#374151',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}
          >
            {t('buttons.cancel')}
          </button>
          {/* Fix parquet error */}
          <button
            onClick={confirmSelection}
            disabled={!datasetInfo || loading}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '8px',
              background: datasetInfo && !loading ? '#10b981' : '#d1d5db',
              color: 'white',
              cursor: datasetInfo && !loading ? 'pointer' : 'not-allowed',
              fontSize: '0.9rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <ArrowRight size={16} />
            {t('datasetSelector.startAnalysis')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatasetSelector; 