import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

const HeatmapChart = forwardRef(({ data, title = "성과 히트맵" }, ref) => {
  const canvasRef = useRef(null);

  // 부모 컴포넌트에서 호출할 수 있는 함수들
  useImperativeHandle(ref, () => ({
    getImageAsBase64: () => {
      const canvas = canvasRef.current;
      if (canvas) {
        return canvas.toDataURL('image/png');
      }
      return null;
    },
    getImageAsBlob: () => {
      return new Promise((resolve) => {
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.toBlob(resolve, 'image/png');
        } else {
          resolve(null);
        }
      });
    }
  }));

  useEffect(() => {
    if (!data || data.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // 캔버스 크기 설정
    const width = canvas.width = 800;
    const height = canvas.height = 400;
    
    // 배경 클리어
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // 데이터 준비
    const campaigns = data.slice(0, 10); // 상위 10개만 표시
    const metrics = ['CTR', 'CVR', 'CPA'];
    
    if (campaigns.length === 0) return;
    
    // 그리드 크기 계산
    const cellWidth = (width - 200) / metrics.length;
    const cellHeight = (height - 100) / campaigns.length;
    const startX = 150;
    const startY = 50;
    
    // 각 지표별 정규화를 위한 최대/최소값 계산
    const maxValues = {};
    const minValues = {};
    
    metrics.forEach(metric => {
      const values = campaigns.map(c => {
        const value = parseFloat(c[metric]) || 0;
        return metric === 'CPA' ? (value === 0 ? 1000 : value) : value; // CPA는 낮을수록 좋음
      });
      maxValues[metric] = Math.max(...values);
      minValues[metric] = Math.min(...values);
    });
    
    // 히트맵 그리기
    campaigns.forEach((campaign, rowIndex) => {
      metrics.forEach((metric, colIndex) => {
        const x = startX + colIndex * cellWidth;
        const y = startY + rowIndex * cellHeight;
        
        // 값 정규화 (0-1 사이)
        let value = parseFloat(campaign[metric]) || 0;
        let normalizedValue;
        
        if (metric === 'CPA') {
          // CPA는 낮을수록 좋으므로 반전
          normalizedValue = value === 0 ? 0 : 1 - ((value - minValues[metric]) / (maxValues[metric] - minValues[metric]));
        } else {
          normalizedValue = (value - minValues[metric]) / (maxValues[metric] - minValues[metric]);
        }
        
        // 색상 계산 (빨강에서 초록으로)
        const intensity = Math.max(0, Math.min(1, normalizedValue));
        const red = Math.floor(255 * (1 - intensity));
        const green = Math.floor(255 * intensity);
        const blue = 0;
        
        // 셀 그리기
        ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
        ctx.fillRect(x, y, cellWidth - 2, cellHeight - 2);
        
        // 테두리
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellWidth - 2, cellHeight - 2);
        
        // 값 텍스트
        ctx.fillStyle = intensity > 0.5 ? '#fff' : '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        let displayValue = campaign[metric];
        if (typeof displayValue === 'string' && displayValue.includes('%')) {
          displayValue = displayValue;
        } else if (metric === 'CPA') {
          displayValue = '$' + parseFloat(value).toFixed(2);
        } else {
          displayValue = parseFloat(value).toFixed(2);
        }
        
        ctx.fillText(displayValue, x + cellWidth/2 - 1, y + cellHeight/2);
      });
    });
    
    // 행 레이블 (캠페인명)
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    campaigns.forEach((campaign, index) => {
      const y = startY + index * cellHeight + cellHeight/2;
      const campaignName = campaign.Campaign || campaign.campaign || `Campaign ${index + 1}`;
      const truncatedName = campaignName.length > 15 ? campaignName.substring(0, 15) + '...' : campaignName;
      ctx.fillText(truncatedName, startX - 10, y);
    });
    
    // 열 레이블 (지표명)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    
    metrics.forEach((metric, index) => {
      const x = startX + index * cellWidth + cellWidth/2;
      ctx.fillText(metric, x - 1, startY - 10);
    });
    
    // 범례
    const legendY = height - 30;
    const legendWidth = 200;
    const legendHeight = 15;
    
    // 범례 그라디언트
    const gradient = ctx.createLinearGradient(startX, legendY, startX + legendWidth, legendY);
    gradient.addColorStop(0, 'rgb(255, 0, 0)');
    gradient.addColorStop(0.5, 'rgb(255, 255, 0)');
    gradient.addColorStop(1, 'rgb(0, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(startX, legendY, legendWidth, legendHeight);
    
    ctx.strokeStyle = '#333';
    ctx.strokeRect(startX, legendY, legendWidth, legendHeight);
    
    // 범례 텍스트
    ctx.fillStyle = '#333';
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('낮음', startX, legendY + legendHeight + 15);
    ctx.textAlign = 'right';
    ctx.fillText('높음', startX + legendWidth, legendY + legendHeight + 15);
    
    // 제목
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, width/2, 25);
    
  }, [data, title]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-gray-600">히트맵 데이터가 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <canvas 
        ref={canvasRef}
        className="w-full h-auto border border-gray-200 rounded-lg bg-white"
        style={{ maxWidth: '100%' }}
      />
      <div className="mt-2 text-sm text-gray-600 text-center">
        <p>💡 색상이 진할수록 높은 성과를 나타냅니다</p>
        <p>CTR/CVR: 높을수록 좋음 | CPA: 낮을수록 좋음</p>
      </div>
    </div>
  );
});

export default HeatmapChart;