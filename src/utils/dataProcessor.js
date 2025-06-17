import _ from 'lodash';

// Utility to normalize column names (handle variations in naming)
export const normalizeColumnName = (columns, patterns) => {
  for (const pattern of patterns) {
    const match = columns.find(col => new RegExp(pattern, 'i').test(col));
    if (match) return match;
  }
  return null;
};

// Get standardized column mappings
export const getColumnMappings = (data) => {
  if (!data || data.length === 0) return {};
  
  const columns = Object.keys(data[0]);
  
  return {
    campaign: normalizeColumnName(columns, ['campaign', 'camp']),
    adGroup: normalizeColumnName(columns, ['ad.?group', 'adgroup', 'group']),
    creative: normalizeColumnName(columns, ['creative', 'ad', 'creative.?name', 'ad.?name']),
    spend: normalizeColumnName(columns, ['spend', 'cost', 'budget', 'amount']),
    impressions: normalizeColumnName(columns, ['impression', 'impr', 'views', 'imp']),
    clicks: normalizeColumnName(columns, ['click', 'clicks']),
    conversions: normalizeColumnName(columns, ['conversion', 'conv', 'convert', 'purchases']),
    date: normalizeColumnName(columns, ['date', 'day', 'timestamp'])
  };
};

// Clean and process raw data
export const processRawData = (rawData) => {
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
export const createPivotTable = (data, groupBy = 'campaign') => {
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
export const classifyPerformance = (pivotData, thresholds = {}) => {
  const defaultThresholds = {
    highCTR: 2.0,
    lowCTR: 0.5,
    highCVR: 3.0,
    lowCVR: 1.0,
    highSpendThreshold: 1000,
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

// Generate budget optimization suggestions
export const generateBudgetOptimization = (classifiedData, totalBudget) => {
  const recommendations = [];
  
  // Sort by performance score (combination of volume and efficiency)
  const sortedData = classifiedData
    .filter(row => row.conversions >= 5) // Only consider items with sufficient data
    .map(row => ({
      ...row,
      performanceScore: (row.ctr * row.cvr) / (row.cpa || 1) // Higher is better
    }))
    .sort((a, b) => b.performanceScore - a.performanceScore);

  const topPerformers = sortedData.slice(0, Math.ceil(sortedData.length * 0.3));
  const poorPerformers = sortedData.slice(-Math.ceil(sortedData.length * 0.3));

  // Recommendations for top performers
  topPerformers.forEach(item => {
    if (item.performanceClass === 'top-performer') {
      recommendations.push({
        type: 'increase_budget',
        target: item[Object.keys(item)[0]], // First column (campaign/adgroup/creative)
        currentSpend: item.spend,
        suggestedChange: '+20-50%',
        reason: 'Excellent performance metrics warrant scaling',
        priority: 'high'
      });
    }
  });

  // Recommendations for poor performers
  poorPerformers.forEach(item => {
    if (item.performanceClass === 'underperformer' || item.performanceClass === 'budget-waster') {
      recommendations.push({
        type: 'decrease_budget',
        target: item[Object.keys(item)[0]],
        currentSpend: item.spend,
        suggestedChange: '-50% or pause',
        reason: 'Poor performance metrics, reallocate budget',
        priority: 'high'
      });
    }
  });

  // Reallocation suggestions
  const savingsFromCuts = poorPerformers.reduce((sum, item) => sum + (item.spend * 0.5), 0);
  if (savingsFromCuts > 0 && topPerformers.length > 0) {
    recommendations.push({
      type: 'reallocation',
      amount: savingsFromCuts,
      targets: topPerformers.slice(0, 3).map(item => item[Object.keys(item)[0]]),
      reason: `Reallocate $${savingsFromCuts.toFixed(2)} from underperformers to top performers`,
      priority: 'medium'
    });
  }

  return recommendations;
};

// Generate weekly report comments
export const generateWeeklyReport = (originalData, pivotData, classifiedData) => {
  const totalSpend = _.sumBy(pivotData, 'spend');
  const totalConversions = _.sumBy(pivotData, 'conversions');
  const averageCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const averageCTR = _.meanBy(pivotData, 'ctr');
  const averageCVR = _.meanBy(pivotData, 'cvr');

  const topPerformer = _.maxBy(classifiedData.filter(row => row.conversions >= 5), 'conversions');
  const worstPerformer = _.minBy(classifiedData.filter(row => row.spend >= 100), item => item.ctr + item.cvr);

  const insights = [];
  const actionItems = [];

  // Performance summary
  insights.push(`Campaign analysis for ${pivotData.length} active campaigns with total spend of $${totalSpend.toLocaleString()}.`);
  insights.push(`Generated ${totalConversions} conversions at an average CPA of $${averageCPA.toFixed(2)}.`);
  insights.push(`Overall CTR: ${averageCTR.toFixed(2)}%, CVR: ${averageCVR.toFixed(2)}%.`);

  // Top performer insight
  if (topPerformer) {
    insights.push(`Best performing ${Object.keys(topPerformer)[0]}: "${topPerformer[Object.keys(topPerformer)[0]]}" with ${topPerformer.conversions} conversions and ${topPerformer.ctr.toFixed(2)}% CTR.`);
    actionItems.push(`Scale budget for top performer: ${topPerformer[Object.keys(topPerformer)[0]]}`);
  }

  // Worst performer insight
  if (worstPerformer) {
    insights.push(`Underperforming ${Object.keys(worstPerformer)[0]}: "${worstPerformer[Object.keys(worstPerformer)[0]]}" needs attention with ${worstPerformer.ctr.toFixed(2)}% CTR and ${worstPerformer.cvr.toFixed(2)}% CVR.`);
    actionItems.push(`Review or pause: ${worstPerformer[Object.keys(worstPerformer)[0]]}`);
  }

  // Performance distribution
  const topPerformersCount = classifiedData.filter(item => item.performanceClass === 'top-performer').length;
  const underperformersCount = classifiedData.filter(item => item.performanceClass === 'underperformer').length;
  
  insights.push(`Performance distribution: ${topPerformersCount} top performers, ${underperformersCount} underperformers identified.`);

  return {
    summary: insights.join(' '),
    actionItems: actionItems,
    metrics: {
      totalSpend,
      totalConversions,
      averageCPA,
      averageCTR,
      averageCVR,
      campaignCount: pivotData.length
    }
  };
};

// Time-based analysis functions
export const getTimeBasedAnalysis = (data, analysisType = 'daily') => {
  const dataWithDates = data.filter(row => row.date);
  
  if (dataWithDates.length === 0) {
    return { error: 'No date information available for time-based analysis' };
  }

  // Group by date periods
  const grouped = _.groupBy(dataWithDates, row => {
    const date = new Date(row.date);
    switch (analysisType) {
      case 'daily':
        return date.toISOString().split('T')[0];
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split('T')[0];
      case 'monthly':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      default:
        return date.toISOString().split('T')[0];
    }
  });

  const timeSeriesData = Object.entries(grouped).map(([period, rows]) => ({
    period,
    spend: _.sumBy(rows, 'spend'),
    impressions: _.sumBy(rows, 'impressions'),
    clicks: _.sumBy(rows, 'clicks'),
    conversions: _.sumBy(rows, 'conversions'),
    ctr: _.meanBy(rows, 'ctr'),
    cvr: _.meanBy(rows, 'cvr'),
    cpa: _.meanBy(rows, 'cpa')
  })).sort((a, b) => new Date(a.period) - new Date(b.period));

  return timeSeriesData;
};