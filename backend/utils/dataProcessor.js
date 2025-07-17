const _ = require('lodash');

// Utility to normalize column names (handle variations in naming)
const normalizeColumnName = (columns, patterns) => {
  for (const pattern of patterns) {
    const match = columns.find(col => new RegExp(pattern, 'i').test(col));
    if (match) return match;
  }
  return null;
};

// Get standardized column mappings
const getColumnMappings = (data) => {
  if (!data || data.length === 0) return {};
  
  const columns = Object.keys(data[0]);
  
  return {
    campaign: normalizeColumnName(columns, ['campaign', 'camp']),
    adGroup: normalizeColumnName(columns, ['ad.?group', 'adgroup', 'group']),
    creative: normalizeColumnName(columns, ['creative', 'ad', 'creative.?name', 'ad.?name']),
    spend: normalizeColumnName(columns, ['spend', 'cost', 'budget']),
    impressions: normalizeColumnName(columns, ['impression', 'impr', 'views', 'imp']),
    clicks: normalizeColumnName(columns, ['click', 'clicks']),
    conversions: normalizeColumnName(columns, ['conversion', 'conv', 'convert', 'purchases']),
    date: normalizeColumnName(columns, ['date', 'day', 'timestamp'])
  };
};

// Clean and process raw data
const processRawData = (rawData) => {
  const columnMappings = getColumnMappings(rawData);
  
  return rawData.map(row => {
    // Convert to standardized format
    const processedRow = {
      campaign: row[columnMappings.campaign] || 'Unknown Campaign',
      adGroup: row[columnMappings.adGroup] || 'Unknown Ad Group',
      creative: row[columnMappings.creative] || 'Unknown Creative',
      spend: parseFloat(row[columnMappings.spend]) || 0,
      impressions: parseFloat(row[columnMappings.impressions]) || 0,
      clicks: parseFloat(row[columnMappings.clicks]) || 0,
      conversions: parseFloat(row[columnMappings.conversions]) || 0,
      date: row[columnMappings.date] || null
    };

    // Calculate derived metrics
    processedRow.ctr = processedRow.impressions > 0 
      ? (processedRow.clicks / processedRow.impressions) * 100 
      : 0;
    
    processedRow.cvr = processedRow.clicks > 0 
      ? (processedRow.conversions / processedRow.clicks) * 100 
      : 0;
    
    processedRow.cpa = processedRow.conversions > 0 
      ? processedRow.spend / processedRow.conversions 
      : 0;

    processedRow.cpc = processedRow.clicks > 0 
      ? processedRow.spend / processedRow.clicks 
      : 0;

    processedRow.cpm = processedRow.impressions > 0 
      ? (processedRow.spend / processedRow.impressions) * 1000 
      : 0;

    return processedRow;
  });
};

// Create pivot table by specified dimension
const createPivotTable = (data, groupBy = 'campaign') => {
  const grouped = _.groupBy(data, groupBy);
  
  return Object.entries(grouped).map(([key, rows]) => {
    const totalSpend = _.sumBy(rows, 'spend');
    const totalImpressions = _.sumBy(rows, 'impressions');
    const totalClicks = _.sumBy(rows, 'clicks');
    const totalConversions = _.sumBy(rows, 'conversions');

    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cvr = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
    const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;

    return {
      [groupBy]: key,
      spend: totalSpend,
      impressions: totalImpressions,
      clicks: totalClicks,
      conversions: totalConversions,
      ctr: ctr,
      cvr: cvr,
      cpa: cpa,
      cpc: cpc,
      cpm: cpm,
      rowCount: rows.length
    };
  }).sort((a, b) => b.spend - a.spend); // Sort by spend desc
};

// Performance classification rules
const classifyPerformance = (pivotData, thresholds = {}) => {
  const defaultThresholds = {
    highCTR: 2.0,
    lowCTR: 0.5,
    highCVR: 3.0,
    lowCVR: 1,
    highSpendThreshold: 100,
    minConversions: 5,
    ...thresholds
  };

  const averageCPA = _.meanBy(pivotData.filter(row => row.conversions >= defaultThresholds.minConversions), 'cpa');

  return pivotData.map(row => {
    const classification = {
      ...row,
      performanceClass: 'neutral',
      insights: [],
      recommendations: []
    };

    // High volume, high CTR, low CVR - hooking but not converting
    if (row.impressions > 10000 && row.ctr > defaultThresholds.highCTR && row.cvr < defaultThresholds.lowCVR) {
      classification.performanceClass = 'hooking-not-converting';
      classification.insights.push('High engagement but low conversion');
      classification.recommendations.push('Review landing page alignment');
      classification.recommendations.push('Check creative-to-offer match');
    }
    // High CTR and high CVR
    else if (row.ctr > defaultThresholds.highCTR && row.cvr > defaultThresholds.highCVR) {
      classification.performanceClass = 'top-performer';
      classification.insights.push('Excellent performance on all metrics');
      classification.recommendations.push('Scale budget if CPA is profitable');
      classification.recommendations.push('Use as creative template');
    }
    // Low CTR, decent CVR
    else if (row.ctr < defaultThresholds.lowCTR && row.cvr > defaultThresholds.highCVR) {
      classification.performanceClass = 'low-engagement-good-quality';
      classification.insights.push('Quality traffic but low initial appeal');
      classification.recommendations.push('Improve creative hook');
      classification.recommendations.push('Test new ad formats');
    }
    // Low performance overall
    else if (row.ctr < defaultThresholds.lowCTR && row.cvr < defaultThresholds.lowCVR) {
      classification.performanceClass = 'underperformer';
      classification.insights.push('Poor performance across metrics');
      classification.recommendations.push('Pause or completely rework');
      classification.recommendations.push('Review targeting and creative');
    }
    // High spend with poor CPA
    else if (row.spend > defaultThresholds.highSpendThreshold && row.cpa > averageCPA * 1.5) {
      classification.performanceClass = 'budget-waster';
      classification.insights.push('High spend with poor efficiency');
      classification.recommendations.push('Reduce budget or pause');
      classification.recommendations.push('Investigate targeting issues');
    }

    return classification;
  });
};

module.exports = {
  processRawData,
  createPivotTable,
  classifyPerformance,
  getColumnMappings,
  normalizeColumnName
};
