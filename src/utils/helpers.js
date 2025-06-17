import { config } from './config';

// Number formatting utilities
export const formatNumber = (value, decimals = 0) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

export const formatCurrency = (value, currency = 'USD') => {
  if (value === null || value === undefined || isNaN(value)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(Number(value));
};

export const formatPercentage = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  return `${Number(value).toFixed(decimals)}%`;
};

// Date formatting utilities
export const formatDate = (dateString, format = 'short') => {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  
  const options = {
    short: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
    time: { hour: '2-digit', minute: '2-digit' },
    relative: null // Will be calculated
  };
  
  if (format === 'relative') {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString(undefined, options.short);
  }
  
  return date.toLocaleDateString(undefined, options[format] || options.short);
};

// File utilities
export const getFileExtension = (filename) => {
  return filename.split('.').pop().toLowerCase();
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const validateFileType = (filename) => {
  const extension = getFileExtension(filename);
  return config.upload.allowedTypes.includes(extension);
};

export const validateFileSize = (fileSize) => {
  return fileSize <= config.upload.maxFileSize;
};

// Data validation utilities
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidNumber = (value) => {
  return !isNaN(parseFloat(value)) && isFinite(value);
};

export const sanitizeColumnName = (columnName) => {
  return columnName
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim() // Remove leading/trailing spaces
    .toLowerCase(); // Convert to lowercase
};

// Performance calculation utilities
export const calculateCTR = (clicks, impressions) => {
  if (!impressions || impressions === 0) return 0;
  return (clicks / impressions) * 100;
};

export const calculateCVR = (conversions, clicks) => {
  if (!clicks || clicks === 0) return 0;
  return (conversions / clicks) * 100;
};

export const calculateCPA = (spend, conversions) => {
  if (!conversions || conversions === 0) return 0;
  return spend / conversions;
};

export const calculateCPC = (spend, clicks) => {
  if (!clicks || clicks === 0) return 0;
  return spend / clicks;
};

export const calculateCPM = (spend, impressions) => {
  if (!impressions || impressions === 0) return 0;
  return (spend / impressions) * 1000;
};

export const calculateROAS = (revenue, spend) => {
  if (!spend || spend === 0) return 0;
  return revenue / spend;
};

// Color utilities for charts and UI
export const getPerformanceColor = (performanceClass) => {
  return config.performanceClasses[performanceClass]?.color || config.charts.colors.primary;
};

export const getMetricColor = (metric) => {
  const colors = {
    spend: config.charts.colors.primary,
    impressions: config.charts.colors.info,
    clicks: config.charts.colors.warning,
    conversions: config.charts.colors.success,
    ctr: config.charts.colors.purple,
    cvr: config.charts.colors.danger,
    cpa: config.charts.colors.secondary
  };
  return colors[metric] || config.charts.colors.primary;
};

export const generateColorPalette = (count) => {
  const baseColors = Object.values(config.charts.colors);
  const colors = [];
  
  for (let i = 0; i < count; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  
  return colors;
};

// Array and object utilities
export const groupBy = (array, key) => {
  return array.reduce((groups, item) => {
    const group = item[key];
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {});
};

export const sortBy = (array, key, direction = 'asc') => {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (direction === 'desc') {
      return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
    }
    return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
  });
};

export const filterByDateRange = (array, dateField, startDate, endDate) => {
  return array.filter(item => {
    const itemDate = new Date(item[dateField]);
    const start = new Date(startDate);
    const end = new Date(endDate);
    return itemDate >= start && itemDate <= end;
  });
};

// Error handling utilities
export const createErrorMessage = (error, defaultMessage = 'An error occurred') => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.details) return error.details;
  return defaultMessage;
};

export const logError = (error, context = '') => {
  if (config.development.enableDebugLogs) {
    console.error(`[${context}]`, error);
  }
};

// Local storage utilities
export const saveToLocalStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    logError(error, 'saveToLocalStorage');
    return false;
  }
};

export const loadFromLocalStorage = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    logError(error, 'loadFromLocalStorage');
    return defaultValue;
  }
};

export const removeFromLocalStorage = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    logError(error, 'removeFromLocalStorage');
    return false;
  }
};

// API utilities
export const buildApiUrl = (endpoint, params = {}) => {
  const url = new URL(endpoint, config.api.baseURL);
  Object.keys(params).forEach(key => {
    if (params[key] !== null && params[key] !== undefined) {
      url.searchParams.append(key, params[key]);
    }
  });
  return url.toString();
};

export const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error status
    const message = error.response.data?.message || error.response.data?.error || 'Server error';
    return new Error(message);
  } else if (error.request) {
    // Request was made but no response received
    return new Error('Network error - please check your connection');
  } else {
    // Something else happened
    return new Error(error.message || 'An unexpected error occurred');
  }
};

// Performance monitoring utilities
export const measurePerformance = (name, fn) => {
  if (!config.development.showPerformanceMetrics) {
    return fn();
  }
  
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  
  console.log(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
  return result;
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Export all utilities as default object
export default {
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatDate,
  getFileExtension,
  formatFileSize,
  validateFileType,
  validateFileSize,
  isValidEmail,
  isValidNumber,
  sanitizeColumnName,
  calculateCTR,
  calculateCVR,
  calculateCPA,
  calculateCPC,
  calculateCPM,
  calculateROAS,
  getPerformanceColor,
  getMetricColor,
  generateColorPalette,
  groupBy,
  sortBy,
  filterByDateRange,
  createErrorMessage,
  logError,
  saveToLocalStorage,
  loadFromLocalStorage,
  removeFromLocalStorage,
  buildApiUrl,
  handleApiError,
  measurePerformance,
  debounce,
  throttle
};