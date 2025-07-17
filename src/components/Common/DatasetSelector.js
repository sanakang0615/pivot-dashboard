import React, { useState, useEffect } from 'react';
import { Database, FileText, ArrowRight, CheckCircle, Loader } from 'lucide-react';
import { getDatasetInfo } from '../../utils/parquetReader';
import { useAuth } from '@clerk/clerk-react';

const DatasetSelector = ({ onDatasetSelected, onCancel }) => {
  const { userId, isSignedIn } = useAuth();
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [datasetInfo, setDatasetInfo] = useState(null);

  const datasets = [
    getDatasetInfo('campaign_data'),
    getDatasetInfo('adpack_data')
  ].filter(Boolean);

  const handleDatasetSelect = async (dataset) => {
    if (!isSignedIn || !userId) {
      setError('Please sign in to use datasets');
      return;
    }

    setSelectedDataset(dataset);
    setLoading(true);
    setError(null);

    try {
      // 백엔드 API를 통해 데이터셋 처리
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/datasets/process`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({ datasetId: dataset.id })
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
            Select Built-in Dataset
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
            Select one of the datasets provided by Snowflake
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
                  Parquet File
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
            <p>Loading dataset...</p>
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
              Selected Dataset Information
            </h4>
            
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <p style={{ 
                  fontSize: '0.9rem', 
                  color: '#6b7280',
                  margin: '0 0 0.25rem 0'
                }}>
                  Dataset Name
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
                  Number of Columns
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
                Included Columns
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
            Cancel
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
            Start Analysis
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatasetSelector; 