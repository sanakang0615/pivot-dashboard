import React from 'react';

const ProgressSteps = ({ currentStep, totalSteps = 4 }) => {
  const steps = [
    { num: 1, label: 'Upload File', emoji: '📁' },
    { num: 2, label: 'Analyze Campaigns', emoji: '🔍' },
    { num: 3, label: 'Map Columns', emoji: '🔗' },
    { num: 4, label: 'View Results', emoji: '📊' }
  ];

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: '0.75rem',
        flexWrap: 'wrap'
      }}>
        {steps.map((stepInfo, index) => (
          <div key={stepInfo.num} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              background: currentStep >= stepInfo.num 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'rgba(255, 255, 255, 0.7)',
              color: currentStep >= stepInfo.num ? 'white' : '#64748b',
              backdropFilter: 'blur(20px)',
              border: '1px solid ' + (currentStep >= stepInfo.num ? 'transparent' : 'rgba(255, 255, 255, 0.3)'),
              boxShadow: currentStep >= stepInfo.num 
                ? '0 6px 20px rgba(102, 126, 234, 0.2)'
                : '0 2px 8px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.3s ease',
              transform: currentStep >= stepInfo.num ? 'translateY(-1px)' : 'translateY(0)'
            }}>
              <span className="tossface" style={{ fontSize: '1.1rem' }}>
                {stepInfo.emoji}
              </span>
              <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                {stepInfo.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div style={{
                width: '2rem',
                height: '2px',
                margin: '0 0.5rem',
                background: currentStep > stepInfo.num 
                  ? 'linear-gradient(90deg, #667eea, #764ba2)'
                  : 'rgba(0, 0, 0, 0.1)',
                borderRadius: '1px',
                transition: 'all 0.3s ease'
              }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgressSteps; 