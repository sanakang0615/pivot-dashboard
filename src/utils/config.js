// Configuration settings for Marketing Analyzer
export const config = {
  // API Configuration
  api: {
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001',
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000 // 1 second
  },

  // File Upload Configuration
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['csv', 'xlsx', 'xls'],
    chunkSize: 1024 * 1024, // 1MB chunks for large files
    supportedMimeTypes: [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  },

  // Data Processing Configuration
  dataProcessing: {
    maxRows: 100000, // Maximum rows to process
    batchSize: 1000, // Process data in batches
    decimalPlaces: 2, // Default decimal places for calculations
    defaultThresholds: {
      highCTR: 2.0,
      lowCTR: 0.5,
      highCVR: 3.0,
      lowCVR: 1.0,
      highSpendThreshold: 1000,
      minConversions: 5
    }
  },

  // Chart Configuration
  charts: {
    defaultHeight: 400,
    animationDuration: 750,
    colors: {
      primary: '#84cc16',
      secondary: '#3b82f6', 
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#06b6d4',
      purple: '#8b5cf6'
    },
    heatmapColors: {
      good: '#10b981',
      average: '#f59e0b',
      poor: '#ef4444'
    }
  },

  // AI Configuration
  ai: {
    maxDataPoints: 100, // Limit data sent to AI for analysis
    analysisTypes: [
      { id: 'general', label: 'General Analysis' },
      { id: 'performance', label: 'Performance Review' },
      { id: 'optimization', label: 'Optimization Tips' },
      { id: 'creative', label: 'Creative Analysis' }
    ],
    retryOnError: true,
    maxRetries: 2
  },

  // UI Configuration
  ui: {
    sidebar: {
      width: 300,
      maxAnalysesToShow: 10
    },
    pagination: {
      defaultPageSize: 20,
      pageSizeOptions: [10, 20, 50, 100]
    },
    dateFormats: {
      display: 'MMM DD, YYYY',
      input: 'YYYY-MM-DD',
      api: 'YYYY-MM-DD'
    }
  },

  // Performance Classification
  performanceClasses: {
    'top-performer': {
      label: 'Top Performer',
      color: '#10b981',
      description: 'High CTR and CVR, excellent overall performance',
      icon: '🏆'
    },
    'hooking-not-converting': {
      label: 'Hooking Not Converting',
      color: '#f59e0b',
      description: 'High CTR but low CVR, needs landing page optimization',
      icon: '⚡'
    },
    'low-engagement-good-quality': {
      label: 'Low Engagement Good Quality',
      color: '#3b82f6',
      description: 'Low CTR but good CVR, needs creative improvement',
      icon: '🎯'
    },
    'underperformer': {
      label: 'Underperformer',
      color: '#ef4444',
      description: 'Poor performance across all metrics',
      icon: '📉'
    },
    'budget-waster': {
      label: 'Budget Waster',
      color: '#dc2626',
      description: 'High spend with poor efficiency',
      icon: '💸'
    }
  },

  // Column Mapping Patterns
  columnMappings: {
    campaign: ['campaign', 'camp', 'campaign name', 'campaign_name'],
    adGroup: ['ad group', 'adgroup', 'ad_group', 'group', 'ad set', 'adset', 'ad_pack_name'],
    creative: ['creative', 'ad', 'creative name', 'ad name', 'creative_name', 'ad_name'],
    spend: ['spend', 'cost', 'budget', 'amount', 'investment'],
    impressions: ['impression', 'impressions', 'impr', 'views', 'imp', 'reach'],
    clicks: ['click', 'clicks', 'link clicks', 'link_clicks'],
    conversions: ['conversion', 'conversions', 'conv', 'purchase', 'purchases', 'sales', 'orders'],
    date: ['date', 'day', 'timestamp', 'created_date', 'report_date']
  },

  // Export Configuration
  export: {
    formats: ['csv', 'xlsx', 'json'],
    defaultFormat: 'csv',
    includeCharts: false, // Future feature
    compression: false // Future feature
  },

  // Development Configuration
  development: {
    enableDebugLogs: process.env.NODE_ENV === 'development',
    showPerformanceMetrics: process.env.NODE_ENV === 'development',
    enableTestDataGeneration: true
  }
};

// Helper function to get configuration values with fallbacks
export const getConfig = (path, fallback = null) => {
  const keys = path.split('.');
  let current = config;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return fallback;
    }
  }
  
  return current;
};

// Environment-specific overrides
if (process.env.NODE_ENV === 'production') {
  config.development.enableDebugLogs = false;
  config.development.showPerformanceMetrics = false;
  config.ai.maxDataPoints = 50; // Reduce for production
}

export default config;