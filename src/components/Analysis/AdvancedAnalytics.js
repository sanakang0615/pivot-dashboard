import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, ScatterChart, Scatter, ComposedChart, Bar, Area, AreaChart 
} from 'recharts';
import { Calendar, TrendingUp, BarChart3, Target, Filter, Download } from 'lucide-react';
import _ from 'lodash';

const AdvancedAnalytics = ({ data, pivotData, classifiedData }) => {
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [correlationData, setCorrelationData] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('spend');
  const [dateRange, setDateRange] = useState('all');
  const [showTrendlines, setShowTrendlines] = useState(true);

  useEffect(() => {
    generateTimeSeriesAnalysis();
    generateCorrelationAnalysis();
  }, [data, selectedMetric, dateRange]);

  const generateTimeSeriesAnalysis = () => {
    // Filter data by date if date column exists
    const dataWithDates = data.filter(row => row.date);
    
    if (dataWithDates.length === 0) {
      setTimeSeriesData([]);
      return;
    }

    // Group by date and calculate daily metrics
    const grouped = _.groupBy(dataWithDates, row => {
      const date = new Date(row.date);
      return date.toISOString().split('T')[0];
    });

    const timeSeries = Object.entries(grouped)
      .map(([date, rows]) => ({
        date,
        spend: _.sumBy(rows, 'spend'),
        impressions: _.sumBy(rows, 'impressions'),
        clicks: _.sumBy(rows, 'clicks'),
        conversions: _.sumBy(rows, 'conversions'),
        ctr: _.meanBy(rows, 'ctr'),
        cvr: _.meanBy(rows, 'cvr'),
        cpa: _.meanBy(rows, 'cpa'),
        campaigns: [...new Set(rows.map(r => r.campaign))].length
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Add moving averages
    const withMovingAverage = timeSeries.map((item, index) => {
      const window = Math.min(7, index + 1); // 7-day moving average
      const slice = timeSeries.slice(Math.max(0, index - window + 1), index + 1);
      
      return {
        ...item,
        spendMA: _.meanBy(slice, 'spend'),
        ctrMA: _.meanBy(slice, 'ctr'),
        cvrMA: _.meanBy(slice, 'cvr'),
        cpaMA: _.meanBy(slice, 'cpa')
      };
    });

    setTimeSeriesData(withMovingAverage);
  };

  const generateCorrelationAnalysis = () => {
    // Create scatter plot data for correlation analysis
    const correlation = pivotData.map(item => ({
      name: item[Object.keys(item)[0]], // First column (campaign/adgroup/creative)
      ctr: item.ctr,
      cvr: item.cvr,
      spend: item.spend,
      conversions: item.conversions,
      cpa: item.cpa,
      impressions: item.impressions,
      clicks: item.clicks,
      performanceScore: (item.ctr * item.cvr) / Math.max(item.cpa, 1),
      efficiency: item.conversions / Math.max(item.spend, 1) * 100
    }));

    setCorrelationData(correlation);
  };

  const generateForecast = () => {
    if (timeSeriesData.length < 7) return [];

    // Simple linear regression for trend prediction
    const recent = timeSeriesData.slice(-14); // Last 14 days
    const trend = recent.map((item, index) => ({ x: index, y: item[selectedMetric] }));
    
    // Calculate slope
    const n = trend.length;
    const sumX = trend.reduce((sum, p) => sum + p.x, 0);
    const sumY = trend.reduce((sum, p) => sum + p.y, 0);
    const sumXY = trend.reduce((sum, p) => sum + (p.x * p.y), 0);
    const sumXX = trend.reduce((sum, p) => sum + (p.x * p.x), 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate forecast for next 7 days
    const forecast = [];
    for (let i = 1; i <= 7; i++) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + i);
      
      forecast.push({
        date: futureDate.toISOString().split('T')[0],
        [selectedMetric]: Math.max(0, slope * (n + i - 1) + intercept),
        forecast: true
      });
    }

    return forecast;
  };

  const getMetricColor = (metric) => {
    const colors = {
      spend: '#84cc16',
      impressions: '#3b82f6',
      clicks: '#f59e0b',
      conversions: '#10b981',
      ctr: '#8b5cf6',
      cvr: '#ef4444',
      cpa: '#06b6d4'
    };
    return colors[metric] || '#6b7280';
  };

  const exportAnalysis = () => {
    const analysisData = {
      timeSeries: timeSeriesData,
      correlation: correlationData,
      forecast: generateForecast(),
      summary: {
        totalDays: timeSeriesData.length,
        avgDailySpend: _.meanBy(timeSeriesData, 'spend'),
        trendSlope: timeSeriesData.length > 1 ? 
          (timeSeriesData[timeSeriesData.length - 1][selectedMetric] - timeSeriesData[0][selectedMetric]) / timeSeriesData.length : 0
      }
    };

    const blob = new Blob([JSON.stringify(analysisData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `advanced_analysis_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const forecastData = generateForecast();
  const combinedTimeData = [...timeSeriesData, ...forecastData];

  return (
    <div style={{ marginTop: '2rem' }}>
      {/* Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem',
        padding: '1rem',
        background: 'white',
        borderRadius: '8px',
        border: '1px solid #e5e5e5'
      }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: '500', marginRight: '0.5rem' }}>
              Metric:
            </label>
            <select 
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              style={{
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem'
              }}
            >
              <option value="spend">Spend</option>
              <option value="impressions">Impressions</option>
              <option value="clicks">Clicks</option>
              <option value="conversions">Conversions</option>
              <option value="ctr">CTR</option>
              <option value="cvr">CVR</option>
              <option value="cpa">CPA</option>
            </select>
          </div>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <input 
              type="checkbox"
              checked={showTrendlines}
              onChange={(e) => setShowTrendlines(e.target.checked)}
            />
            Show Moving Average
          </label>
        </div>

        <button 
          onClick={exportAnalysis}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: '#84cc16',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          <Download size={16} /> Export Analysis
        </button>
      </div>

      {/* Time Series Analysis */}
      {timeSeriesData.length > 0 && (
        <div className="chart-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Calendar size={20} color="#3b82f6" />
            <h2 className="chart-title">Time Series Analysis - {selectedMetric.toUpperCase()}</h2>
          </div>
          
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={combinedTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  typeof value === 'number' ? value.toFixed(2) : value,
                  name
                ]}
                labelFormatter={(date) => `Date: ${date}`}
              />
              <Legend />
              
              <Bar 
                dataKey={selectedMetric}
                fill={getMetricColor(selectedMetric)}
                fillOpacity={0.3}
                name={selectedMetric.toUpperCase()}
              />
              
              {showTrendlines && (
                <Line 
                  type="monotone"
                  dataKey={`${selectedMetric}MA`}
                  stroke={getMetricColor(selectedMetric)}
                  strokeWidth={2}
                  dot={false}
                  name="Moving Average"
                />
              )}
              
              {forecastData.length > 0 && (
                <Line 
                  type="monotone"
                  dataKey={selectedMetric}
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  dot={{ fill: '#ef4444' }}
                  name="Forecast"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          
          {forecastData.length > 0 && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '1rem', 
              background: '#fef2f2', 
              borderRadius: '6px',
              fontSize: '0.875rem',
              color: '#dc2626'
            }}>
              <strong>7-Day Forecast:</strong> Based on recent trends, projected {selectedMetric} for next week.
              Note: Forecasts are estimates and actual results may vary.
            </div>
          )}
        </div>
      )}

      {/* Performance Correlation Matrix */}
      <div className="chart-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Target size={20} color="#8b5cf6" />
          <h2 className="chart-title">CTR vs CVR Performance Matrix</h2>
        </div>
        
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart data={correlationData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              type="number" 
              dataKey="ctr" 
              name="CTR (%)"
              domain={[0, 'dataMax + 1']}
            />
            <YAxis 
              type="number" 
              dataKey="cvr" 
              name="CVR (%)"
              domain={[0, 'dataMax + 1']}
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(value, name) => [value.toFixed(2), name]}
              labelFormatter={() => ''}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div style={{ 
                      background: 'white', 
                      padding: '1rem', 
                      border: '1px solid #e5e5e5',
                      borderRadius: '4px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                        {data.name}
                      </div>
                      <div>CTR: {data.ctr.toFixed(2)}%</div>
                      <div>CVR: {data.cvr.toFixed(2)}%</div>
                      <div>Spend: ${data.spend.toLocaleString()}</div>
                      <div>Conversions: {data.conversions}</div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Scatter 
              fill="#84cc16"
              fillOpacity={0.6}
            />
          </ScatterChart>
        </ResponsiveContainer>
        
        <div style={{ 
          marginTop: '1rem', 
          padding: '1rem', 
          background: '#f9fafb', 
          borderRadius: '6px',
          fontSize: '0.875rem'
        }}>
          <strong>Interpretation:</strong>
          <ul style={{ marginTop: '0.5rem', marginLeft: '1rem', color: '#6b7280' }}>
            <li>Top-right quadrant: High CTR + High CVR (Best performers)</li>
            <li>Top-left quadrant: Low CTR + High CVR (Improve creative hook)</li>
            <li>Bottom-right quadrant: High CTR + Low CVR (Landing page issues)</li>
            <li>Bottom-left quadrant: Low CTR + Low CVR (Poor performers)</li>
          </ul>
        </div>
      </div>

      {/* Efficiency Analysis */}
      <div className="chart-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <BarChart3 size={20} color="#10b981" />
          <h2 className="chart-title">Spend vs Efficiency Analysis</h2>
        </div>
        
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart data={correlationData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              type="number" 
              dataKey="spend" 
              name="Spend ($)"
              scale="log"
              domain={['dataMin', 'dataMax']}
            />
            <YAxis 
              type="number" 
              dataKey="efficiency" 
              name="Efficiency (Conversions/$100)"
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div style={{ 
                      background: 'white', 
                      padding: '1rem', 
                      border: '1px solid #e5e5e5',
                      borderRadius: '4px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                        {data.name}
                      </div>
                      <div>Spend: ${data.spend.toLocaleString()}</div>
                      <div>Efficiency: {data.efficiency.toFixed(2)} conv/$100</div>
                      <div>Total Conversions: {data.conversions}</div>
                      <div>CPA: ${data.cpa.toFixed(2)}</div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Scatter 
              fill="#3b82f6"
              fillOpacity={0.6}
            />
          </ScatterChart>
        </ResponsiveContainer>
        
        <div style={{ 
          marginTop: '1rem', 
          padding: '1rem', 
          background: '#f0fdf4', 
          borderRadius: '6px',
          fontSize: '0.875rem'
        }}>
          <strong>Efficiency Insights:</strong>
          <div style={{ marginTop: '0.5rem', color: '#059669' }}>
            High-efficiency campaigns (top of chart) generate more conversions per dollar spent.
            Focus budget allocation on high-efficiency campaigns for better ROI.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedAnalytics;