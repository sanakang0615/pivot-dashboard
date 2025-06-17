import React, { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Upload, X, FileText, ArrowRight, CheckCircle } from 'lucide-react';
import ColumnMappingModal from '../ColumnMappingModal';

const FileUpload = ({ onFileUploaded, onCancel }) => {
  const { userId, isLoaded, isSignedIn } = useAuth();
  
  const [step, setStep] = useState(1); // 1: upload, 2: mapping, 3: analysis
  
  const [file, setFile] = useState(null);
  const [fileData, setFileData] = useState(null);
  
  const [mappingResult, setMappingResult] = useState(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  
  const [analysisResult, setAnalysisResult] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };
  
  const handleFileUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    if (!isSignedIn || !userId) {
      setError('Please sign in to upload files');
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

  // Step 2: Column mapping suggestion
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

  // Step 3: Execute analysis after mapping confirmation
  const executeAnalysis = async (confirmedMapping) => {
    setLoading(true);
    setShowMappingModal(false);
    setStep(3);
    setError(null);
    
    try {
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
      
      // Pass to dashboard after analysis completion
      setTimeout(() => {
        onFileUploaded(result);
      }, 2000);
      
    } catch (error) {
      console.error('Analysis execution failed:', error);
      setError(error.message);
      setStep(2); // Return to previous step on error
      setShowMappingModal(true);
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep(1);
    setFile(null);
    setFileData(null);
    setMappingResult(null);
    setShowMappingModal(false);
    setAnalysisResult(null);
    setError(null);
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
        maxWidth: step === 3 ? '800px' : '600px',
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
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1rem', color: '#374151', fontSize: '1.5rem', fontWeight: '600' }}>
            Marketing Data Analysis
          </h2>
          
          {/* Progress Steps */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {[
              { num: 1, label: 'File Upload', icon: '📁' },
              { num: 2, label: 'Column Mapping', icon: '🔗' },
              { num: 3, label: 'Analysis Complete', icon: '📊' }
            ].map((stepInfo, index) => (
              <div key={stepInfo.num} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  background: step >= stepInfo.num ? '#2563eb' : '#e5e7eb',
                  color: step >= stepInfo.num ? 'white' : '#6b7280',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}>
                  <span>{stepInfo.icon}</span>
                  <span>{stepInfo.label}</span>
                </div>
                {index < 2 && (
                  <ArrowRight 
                    size={16} 
                    style={{ 
                      color: step > stepInfo.num ? '#2563eb' : '#d1d5db',
                      margin: '0 0.5rem'
                    }} 
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            color: '#ef4444',
            marginBottom: '1.5rem',
            padding: '1rem',
            background: '#fee2e2',
            borderRadius: '8px',
            fontSize: '0.875rem',
            border: '1px solid #fecaca'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>❌</span>
              <strong>Error occurred</strong>
            </div>
            <div style={{ marginTop: '0.5rem' }}>{error}</div>
          </div>
        )}

        {/* 1st Step: File Upload */}
        {step === 1 && (
          <div>
            <div style={{
              border: file ? '2px solid #84cc16' : '2px dashed #e5e7eb',
              borderRadius: '8px',
              padding: '3rem 2rem',
              textAlign: 'center',
              marginBottom: '1.5rem',
              transition: 'border-color 0.2s',
              background: file ? '#f0f9ff' : '#fafafa'
            }}>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="file-upload"
                disabled={loading}
              />
              <label
                htmlFor="file-upload"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {file ? (
                  <>
                    <FileText size={64} style={{ color: '#84cc16', marginBottom: '1rem' }} />
                    <span style={{ color: '#374151', fontWeight: '600', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
                      {file.name}
                    </span>
                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </>
                ) : (
                  <>
                    <Upload size={64} style={{ color: '#9ca3af', marginBottom: '1rem' }} />
                    <span style={{ color: '#374151', marginBottom: '0.5rem', fontSize: '1.1rem', fontWeight: '500' }}>
                      Select or drag and drop a file
                    </span>
                    <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                      Supports CSV, Excel files (up to 10MB)
                    </span>
                  </>
                )}
              </label>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={onCancel}
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  opacity: loading ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleFileUpload}
                disabled={!file || loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(135deg, #84cc16, #65a30d)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: file && !loading ? 'pointer' : 'not-allowed',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  opacity: file && !loading ? 1 : 0.5
                }}
              >
                {loading ? 'Processing...' : 'Start Analysis'}
              </button>
            </div>
          </div>
        )}

        {/* 2nd Step: Column Mapping Modal */}
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

        {/* 3rd Step: Analysis Complete */}
        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            {loading ? (
              <div>
                <div style={{
                  width: '80px',
                  height: '80px',
                  border: '8px solid #f3f4f6',
                  borderTop: '8px solid #84cc16',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 2rem auto'
                }} />
                <h3 style={{ color: '#374151', marginBottom: '1rem' }}>
                  Analyzing data...
                </h3>
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                  AI is generating insights and suggesting improvements
                </p>
              </div>
            ) : analysisResult ? (
              <div>
                <CheckCircle size={80} style={{ color: '#10b981', margin: '0 auto 2rem auto' }} />
                <h3 style={{ color: '#374151', marginBottom: '1rem' }}>
                  Analysis completed!
                </h3>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '2rem' }}>
                  You can view the analysis results for {analysisResult.fileName}
                </p>
                <div style={{
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '2rem',
                  textAlign: 'left'
                }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#0369a1' }}>Analysis Summary</h4>
                  <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                    <div>• Analyzed {analysisResult.metadata?.rowCount?.toLocaleString()} rows of data</div>
                    <div>• Created {Object.keys(analysisResult.pivotTables || {}).length} level pivot tables</div>
                    <div>• Provided AI insights and improvement suggestions</div>
                  </div>
                </div>
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                  You will be redirected to the analysis results page in a moment...
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Loading Background Click Prevention */}
      {loading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'transparent',
          zIndex: -1
        }} />
      )}

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default FileUpload;