const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Papa = require('papaparse');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const mongoose = require('mongoose');
const { processDataWithGemini, generateWeeklyReportWithGemini, generateTimeBasedAnalysisWithGemini } = require('./utils/geminiProcessor');
const OpenAI = require("openai");
const parquet = require('parquetjs');
const duckdb = require('duckdb');

const app = express();
const PORT = process.env.PORT || 3001;

// Import models and utilities with error handling
let Analysis;
let Chat;
let processRawData, createPivotTable, classifyPerformance;

try {
  Analysis = require('./models/Analysis');
  Chat = require('./models/Chat');
  const dataProcessor = require('../src/utils/dataProcessor');
  processRawData = dataProcessor.processRawData;
  createPivotTable = dataProcessor.createPivotTable;
  classifyPerformance = dataProcessor.classifyPerformance;
} catch (error) {
  console.warn('Warning: Could not import some modules. Some features may be limited.', error.message);
}

// MongoDB Connection
async function connectDB() {
  try {
    console.log('Attempting to connect to MongoDB Atlas...');
    const mongoURI = process.env.MONGODB_URI;
    console.log('MongoDB URI:', mongoURI);
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // Atlas 연결을 위해 타임아웃 증가
      socketTimeoutMS: 45000,
      family: 4,
      retryWrites: true,
      w: 'majority'
    });

    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB Atlas connected successfully');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Connect to database
connectDB().catch(err => {
  console.error('Failed to connect to MongoDB:', err);
});

const allowedOrigins = [
  'http://localhost:3000',
  'https://pivot-dashboard-production.up.railway.app',
  'https://pivot-dashboard.vercel.app'
];

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-user-id', 'Authorization', 'Origin', 'Accept'],
  exposedHeaders: ['Content-Type', 'x-user-id'],
  maxAge: 86400
}));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Request headers:', req.headers);
  console.log('Origin:', req.headers.origin);
  next();
});

// Ensure JSON responses
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'csv,xlsx,xls').split(',');
    const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
    
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`File type .${fileExtension} not allowed. Allowed types: ${allowedTypes.join(', ')}`));
    }
  }
});

// Utility functions for data processing
const processCSV = (buffer) => {
  return new Promise((resolve, reject) => {
    Papa.parse(buffer.toString(), {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      delimitersToGuess: [',', '\t', '|', ';'],
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV parsing warnings:', results.errors);
        }
        
        // Clean headers (remove whitespace)
        const cleanedData = results.data.map(row => {
          const cleanedRow = {};
          Object.keys(row).forEach(key => {
            const cleanKey = key.trim();
            cleanedRow[cleanKey] = row[key];
          });
          return cleanedRow;
        });
        
        resolve(cleanedData);
      },
      error: (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      }
    });
  });
};

const processExcel = (buffer) => {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: ''
    });
    
    if (jsonData.length < 2) {
      throw new Error('Excel file must contain at least a header row and one data row');
    }

    // Convert to objects with headers
    const headers = jsonData[0].map(h => String(h).trim());
    const dataRows = jsonData.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });

    return dataRows;
  } catch (error) {
    throw new Error(`Excel parsing error: ${error.message}`);
  }
};

// Parquet 파일 읽기 함수
const readParquetDataset = async (datasetId) => {
  try {
    console.log(`📊 Reading parquet dataset: ${datasetId}`);
    
    // Dataset configuration
    const datasetConfigs = {
      'campaign_data': {
        name: 'Campaign Data',
        file: path.join(__dirname, 'data/campaign_data.parquet')
      },
      'adpack_data': {
        name: 'AdPack Data',
        file: path.join(__dirname, 'data/adpack_data.parquet')
      }
    };

    const config = datasetConfigs[datasetId];
    if (!config) {
      throw new Error(`Invalid dataset ID: ${datasetId}`);
    }

    // Check if file exists
    if (!fs.existsSync(config.file)) {
      throw new Error(`Dataset file not found: ${config.file}`);
    }

    console.log(`📁 Reading parquet file: ${config.file}`);

    // DuckDB를 사용하여 parquet 파일 읽기
    const db = new duckdb.Database(':memory:');
    const con = db.connect();
    
    // DuckDB는 파일 경로를 직접 쿼리할 수 있음
    const query = `SELECT * FROM read_parquet('${config.file.replace(/'/g, "''")}')`;
    console.log(`🔍 Executing query: ${query}`);
    
    const result = await new Promise((resolve, reject) => {
      con.all(query, (err, res) => {
        if (err) {
          console.error('❌ DuckDB query error:', err);
          reject(err);
        } else {
          console.log(`✅ DuckDB query successful, returned ${res.length} rows`);
          resolve(res);
        }
      });
    });

    // BigInt 값을 일반 숫자로 변환
    const rows = convertBigInts(result);
    const columns = rows[0] ? Object.keys(rows[0]) : [];

    console.log(`📊 Dataset loaded successfully:`, {
      datasetId,
      fileName: config.name,
      rowCount: rows.length,
      columnCount: columns.length,
      columns: columns
    });

    con.close();
    db.close();

    return {
      rows,
      columns,
      datasetId,
      fileName: config.name
    };

  } catch (error) {
    console.error(`❌ Error reading parquet dataset ${datasetId}:`, error);
    throw error;
  }
};

// Simple AI insights placeholder (if Gemini API not available)
const generateSimpleInsights = (data) => {
  return `# 📊 분석 완료\n\n## 요약\n- 데이터 업로드 및 처리가 완료되었습니다\n- 피벗 테이블이 생성되었습니다\n- 추가적인 AI 분석을 위해서는 OpenAI API 키가 필요합니다\n\n## 다음 단계\n1. 생성된 피벗 테이블을 확인하세요\n2. 성과 히트맵을 통해 시각적 분석을 수행하세요\n3. 더 자세한 분석을 원하시면 관리자에게 API 설정을 요청하세요\n\n*더 상세한 AI 분석을 위해 OpenAI API를 설정해주세요.*`;
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// AI 인사이트 생성 함수 (수정된 버전)
const generateAIInsights = async (pivotTables) => {
  console.log('🤖 === GENERATE AI INSIGHTS START ===');
  console.log('🤖 Data available:', pivotTables ? Object.keys(pivotTables) : 'No data');
  console.log('🤖 Full pivot tables data:', JSON.stringify(pivotTables, null, 2));
  
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    console.log('⚠️ No OpenAI API key found, using simple insights');
    return generateSimpleInsights([]);
  }

  try {
    console.log('📝 === PREPARING PROMPT ===');
    
    // 데이터 검증 및 안전한 처리
    if (!pivotTables || typeof pivotTables !== 'object') {
      throw new Error('Invalid pivot tables data');
    }

    // 피봇 테이블 데이터를 더 상세하게 요약
    const getDetailedTableSummary = (tableData, tableName) => {
      if (!Array.isArray(tableData) || tableData.length === 0) {
        return `${tableName}: No data available`;
      }
      
      // 전체 통계 계산
      const totalImpressions = tableData.reduce((sum, item) => sum + (parseFloat(item.Impression) || 0), 0);
      const totalClicks = tableData.reduce((sum, item) => sum + (parseFloat(item.Click) || 0), 0);
      const totalPurchases = tableData.reduce((sum, item) => sum + (parseFloat(item.Purchase) || 0), 0);
      const totalCost = tableData.reduce((sum, item) => sum + (parseFloat(item.Cost) || 0), 0);
      const totalRevenue = tableData.reduce((sum, item) => sum + (parseFloat(item.Revenue) || 0), 0);
      
      const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : 0;
      const avgCVR = totalClicks > 0 ? (totalPurchases / totalClicks * 100).toFixed(2) : 0;
      const avgCPA = totalPurchases > 0 ? (totalCost / totalPurchases).toFixed(2) : 0;
      const roas = totalCost > 0 ? (totalRevenue / totalCost).toFixed(2) : 0;
      
      // 성과 분포 분석
      const performanceDistribution = tableData.map(item => ({
        name: item[tableName] || 'Unknown',
        impressions: parseFloat(item.Impression) || 0,
        ctr: parseFloat(item.CTR?.replace('%', '')) || 0,
        cvr: parseFloat(item.CVR?.replace('%', '')) || 0,
        cpa: parseFloat(item.CPA) || 0,
        cost: parseFloat(item.Cost) || 0,
        revenue: parseFloat(item.Revenue) || 0,
        clicks: parseFloat(item.Click) || 0,
        purchases: parseFloat(item.Purchase) || 0
      }));

      return `## ${tableName} Performance Dataset (${tableData.length} entities)

**Aggregate Metrics:**
- Total Impressions: ${totalImpressions.toLocaleString()}
- Total Clicks: ${totalClicks.toLocaleString()}
- Total Conversions: ${totalPurchases.toLocaleString()}
- Total Cost: $${totalCost.toLocaleString()}
- Total Revenue: $${totalRevenue.toLocaleString()}
- Average CTR: ${avgCTR}%
- Average CVR: ${avgCVR}%
- Average CPA: $${avgCPA}
- ROAS: ${roas}

**Individual Performance Data:**
${performanceDistribution.map(item => 
  `${item.name}: Impressions ${item.impressions.toLocaleString()}, CTR ${item.ctr}%, CVR ${item.cvr}%, CPA $${item.cpa}, Cost $${item.cost}, Revenue $${item.revenue}`
).join('\n')}`;
    };

    // 상세한 데이터 요약 생성
    let dataContext = '';
    
    if (pivotTables.Campaign && Array.isArray(pivotTables.Campaign) && pivotTables.Campaign.length > 0) {
      dataContext += getDetailedTableSummary(pivotTables.Campaign, 'Campaign') + '\n\n';
    }
    
    if (pivotTables['Ad Set'] && Array.isArray(pivotTables['Ad Set']) && pivotTables['Ad Set'].length > 0) {
      dataContext += getDetailedTableSummary(pivotTables['Ad Set'], 'Ad Set') + '\n\n';
    }
    
    if (pivotTables.Ad && Array.isArray(pivotTables.Ad) && pivotTables.Ad.length > 0) {
      dataContext += getDetailedTableSummary(pivotTables.Ad, 'Ad') + '\n\n';
    }

    if (!dataContext.trim()) {
      throw new Error('No valid data found in pivot tables');
    }

    const prompt = `You are a Senior Digital Marketing Analyst with 15+ years of experience in performance marketing and data analytics, similar to analysts at enterprise consulting firms like IBM, Microsoft, Oracle, and Salesforce. 

Your task is to analyze the following advertising performance data and provide a comprehensive, enterprise-grade analysis report that demonstrates deep marketing expertise and strategic thinking.

# 📊 CAMPAIGN PERFORMANCE DATA

${dataContext}

# 🎯 ANALYSIS REQUIREMENTS

Create a professional marketing analysis report in **English** with the following structure:

## Executive Summary
- Brief overview of overall account performance vs industry benchmarks
- Key findings and strategic recommendations (2-3 sentences maximum)

## Performance Analysis Framework

### Funnel Efficiency Assessment
Analyze the marketing funnel performance using the following framework:
- **Awareness Stage** (Impressions & Reach): Volume adequacy and audience targeting effectiveness
- **Interest Stage** (CTR): Creative resonance and audience-message fit
- **Consideration Stage** (CVR): Landing page alignment and offer compelling factor
- **Conversion Stage** (CPA & ROAS): Economic efficiency and scalability

### Creative Performance Categorization
Based on performance patterns, categorize ads/campaigns into:

**High-Performing Assets:**
- Strong volume + High CTR + High CVR = Winning combination (scale immediately)
- High volume + High CTR + Low CVR = Strong hook, poor landing alignment (fix landing page)
- Low volume + High CTR + High CVR = Audience too narrow (expand targeting)

**Underperforming Assets:**
- High volume + Low CTR + Any CVR = Poor creative-audience fit (refresh creative)
- Any volume + High CTR + Low CVR = Landing page disconnect (optimize post-click experience)
- Low volume + Low CTR + Low CVR = Fundamental mismatch (pause and redesign)

## Strategic Optimization Framework

### Immediate Actions (Week 1-2)
Specific tactical moves with expected impact:
- Budget reallocation priorities with percentage shifts
- Creative refresh requirements with reasoning
- Targeting adjustments with rationale

### Performance Enhancement (Month 1-3)
Strategic initiatives with measurable outcomes:
- Funnel optimization priorities
- Testing roadmap for improvement
- Scaling opportunities identification

### Portfolio Optimization
Advanced strategic recommendations:
- Resource allocation across campaigns/ad sets
- Performance pattern exploitation
- Risk mitigation for underperformers

## Data-Driven Insights

### Pattern Recognition
- Performance correlations discovered in the data
- Unexpected findings that require investigation
- Seasonal/temporal patterns if applicable

### Competitive Intelligence
- Performance vs typical industry benchmarks
- Efficiency gaps and improvement potential
- Market positioning implications

**IMPORTANT GUIDELINES:**
- Write in a consultative, professional tone appropriate for C-level executives
- Use specific metrics and data points to support every recommendation
- Provide clear, actionable next steps with expected business impact
- Focus on strategic insights rather than basic data summaries
- Limit bullet points - use analytical prose that demonstrates expertise
- Include numerical evidence for all claims and recommendations`;

    console.log('📝 Prompt length:', prompt.length);
    console.log('📝 Data context preview:', dataContext.substring(0, 500) + '...');

    console.log('🚀 === CALLING OPENAI API ===');
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a Senior Digital Marketing Analyst with 15+ years of experience at top-tier consulting firms. You specialize in performance marketing analysis and strategic optimization. Your analysis style is sophisticated, data-driven, and actionable - similar to reports produced by IBM, Microsoft, Oracle, and Salesforce marketing consulting divisions. Always write in professional English with strategic depth and specific, measurable recommendations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 3000,
      temperature: 0.6,
    });
    
    console.log('✅ === OPENAI API RESPONSE RECEIVED ===');
    
    if (!completion.choices || completion.choices.length === 0) {
      console.error('❌ No choices in OpenAI response');
      throw new Error('OpenAI API returned no choices');
    }

    const response = completion.choices[0];
    const aiResponse = response.message?.content;
    
    console.log('✅ AI Response length:', aiResponse ? aiResponse.length : 0);
    console.log('✅ AI Response preview:', aiResponse ? aiResponse.substring(0, 200) + '...' : 'No response');
    
    // 응답 검증
    if (!aiResponse || typeof aiResponse !== 'string' || aiResponse.length < 200) {
      console.error('❌ Invalid AI response:', aiResponse);
      throw new Error('Invalid or too short response from OpenAI');
    }
    
    console.log('✅ AI Insights generated successfully');
    return aiResponse;
    
  } catch (err) {
    console.error('❌ OpenAI API error:', {
      message: err.message,
      status: err.status,
      code: err.code
    });
    
    // 구체적인 에러 메시지 반환
    if (err.status === 401) {
      return '# ⚠️ API Authentication Error\n\nOpenAI API key is invalid. Please contact administrator.';
    } else if (err.status === 429) {
      return '# ⚠️ API Rate Limit Exceeded\n\nAPI usage limit exceeded. Please try again later.';
    } else if (err.status === 500) {
      return '# ⚠️ API Server Error\n\nOpenAI server is temporarily unavailable. Please try again later.';
    } else {
      return `# ⚠️ Analysis Report Generation Failed\n\nTechnical issue prevented AI analysis generation.\n\nError: ${err.message}\n\nPlease analyze the pivot tables manually.`;
    }
  }
};

// Column mapping with OpenAI
const generateColumnMapping = async (columns) => {
  if (!process.env.OPENAI_API_KEY) {
    return generateSimpleMapping(columns);
  }
  const prompt = `다음 컬럼명들을 표준 마케팅 데이터 컬럼에 매핑해주세요:\n\n입력 컬럼: ${columns.join(', ')}\n표준 컬럼: Date, Campaign, Ad Set, Ad, Cost, Impression, Click, Purchase, Revenue\n\n각 입력 컬럼을 가장 적절한 표준 컬럼에 매핑하고, 확신도(0-1)를 함께 제공해주세요.\n매핑이 어려운 컬럼은 unmapped에 포함시키고, 애매한 경우 suggestions에 대안을 제공해주세요.\n\n다음 JSON 형태로만 응답해주세요 (다른 텍스트 없이):\n{\n  "mapping": {\n    "사용자컬럼": "표준컬럼"\n  },\n  "confidence": {\n    "사용자컬럼": 0.95\n  },\n  "unmapped": ["매핑되지않은컬럼"],\n  "suggestions": {\n    "애매한컬럼": ["대안1", "대안2"]\n  }\n}`;
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1024,
    temperature: 0.3,
  });
  const mappingText = completion.choices[0].message.content;
  try {
    const cleanText = mappingText.replace(/```json\n?|```\n?/g, '').trim();
    const mappingResult = JSON.parse(cleanText);
    return mappingResult;
  } catch (parseError) {
    return generateSimpleMapping(columns);
  }
};

// Simple column mapping fallback
const generateSimpleMapping = (columns) => {
  const standardColumns = ['Date', 'Campaign', 'Ad Set', 'Ad', 'Cost', 'Impression', 'Click', 'Purchase', 'Revenue'];
  const mapping = {};
  const confidence = {};
  const unmapped = [];
  
  columns.forEach(col => {
    const lowerCol = col.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;
    
    // 간단한 키워드 매칭
    if (lowerCol.includes('date') || lowerCol.includes('time') || lowerCol.includes('day')) {
      bestMatch = 'Date';
      bestScore = 0.8;
    } else if (lowerCol.includes('campaign')) {
      bestMatch = 'Campaign';
      bestScore = 0.9;
    } else if (lowerCol.includes('adset') || lowerCol.includes('ad set') || lowerCol.includes('ad_set')) {
      bestMatch = 'Ad Set';
      bestScore = 0.9;
    } else if (lowerCol.includes('ad') && !lowerCol.includes('adset')) {
      bestMatch = 'Ad';
      bestScore = 0.8;
    } else if (lowerCol.includes('cost') || lowerCol.includes('spend') || lowerCol.includes('amount')) {
      bestMatch = 'Cost';
      bestScore = 0.8;
    } else if (lowerCol.includes('impression') || lowerCol.includes('reach') || lowerCol.includes('view')) {
      bestMatch = 'Impression';
      bestScore = 0.8;
    } else if (lowerCol.includes('click')) {
      bestMatch = 'Click';
      bestScore = 0.9;
    } else if (lowerCol.includes('purchase') || lowerCol.includes('conversion') || lowerCol.includes('order')) {
      bestMatch = 'Purchase';
      bestScore = 0.8;
    } else if (lowerCol.includes('revenue') || lowerCol.includes('sales') || lowerCol.includes('income')) {
      bestMatch = 'Revenue';
      bestScore = 0.8;
    }
    
    if (bestMatch && bestScore >= 0.7) {
      mapping[col] = bestMatch;
      confidence[col] = bestScore;
    } else {
      unmapped.push(col);
    }
  });
  
  return {
    mapping,
    confidence,
    unmapped,
    suggestions: {}
  };
};

// Enhanced pivot table generation
const generatePivotTables = (data, columnMapping) => {
  if (!data || data.length === 0) {
    throw new Error('No data provided for pivot table generation');
  }

  // Remap columns based on mapping
  const remappedData = data.map(row => {
    const newRow = {};
    Object.entries(columnMapping).forEach(([oldCol, newCol]) => {
      if (newCol && row[oldCol] !== undefined) {
        newRow[newCol] = row[oldCol];
      }
    });
    return newRow;
  });

  const levels = ['Campaign', 'Ad Set', 'Ad'];
  const results = {};
  
  levels.forEach(level => {
    if (!remappedData[0] || !remappedData[0][level]) {
      console.warn(`Column '${level}' not found in data, skipping`);
      return; // Skip this level entirely instead of adding empty array
    }

    const grouped = remappedData.reduce((acc, row) => {
      const key = row[level] || 'Unknown';
      if (!acc[key]) {
        acc[key] = {
          impression: 0,
          click: 0,
          purchase: 0,
          cost: 0,
          revenue: 0
        };
      }
      
      acc[key].impression += parseFloat(row.Impression || 0);
      acc[key].click += parseFloat(row.Click || 0);
      acc[key].purchase += parseFloat(row.Purchase || 0);
      acc[key].cost += parseFloat(row.Cost || 0);
      acc[key].revenue += parseFloat(row.Revenue || 0);
      
      return acc;
    }, {});
    
    const levelData = Object.entries(grouped).map(([name, metrics]) => ({
      [level]: name,
      Impression: Math.round(metrics.impression),
      CTR: metrics.impression ? (metrics.click / metrics.impression * 100).toFixed(2) + '%' : '0%',
      Click: Math.round(metrics.click),
      Purchase: Math.round(metrics.purchase),
      CVR: metrics.click ? (metrics.purchase / metrics.click * 100).toFixed(2) + '%' : '0%',
      Cost: metrics.cost.toFixed(2),
      CPA: metrics.purchase ? (metrics.cost / metrics.purchase).toFixed(2) : '0',
      Revenue: metrics.revenue.toFixed(2)
    })).sort((a, b) => b.Impression - a.Impression);
    
    // Only add to results if there's actual data
    if (levelData.length > 0) {
      results[level] = levelData;
    }
  });
  
  return results;
};

// Generate simple heatmap (text-based for now, can be enhanced with actual image generation)
const generateSimpleHeatmap = (pivotData) => {
  // For now, return a placeholder. In a full implementation, 
  // you would use a library like Chart.js or generate actual images
  return 'data:image/svg+xml;base64,' + Buffer.from(`
    <svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="200" fill="#f0f0f0"/>
      <text x="200" y="100" text-anchor="middle" font-family="Arial" font-size="16">
        Heatmap Placeholder
      </text>
      <text x="200" y="120" text-anchor="middle" font-family="Arial" font-size="12">
        (${pivotData.length} items analyzed)
      </text>
    </svg>
  `).toString('base64');
};

// API Routes

// In-memory storage for file data (temporary)
const fileStorage = new Map();

// 1. 파일 업로드 및 컬럼 추출 API
app.post('/api/upload/extract-columns', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }

    const { originalname, buffer, size } = req.file;
    const fileExtension = path.extname(originalname).toLowerCase();

    console.log(`Extracting columns from: ${originalname} (${size} bytes)`);

    let processedData;
    if (fileExtension === '.csv') {
      processedData = await processCSV(buffer);
    } else if (['.xlsx', '.xls'].includes(fileExtension)) {
      processedData = processExcel(buffer);
    } else {
      return res.status(400).json({ 
        success: false,
        error: 'Unsupported file type' 
      });
    }

    if (!processedData || processedData.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No valid data found in file' 
      });
    }

    // Filter out empty rows
    const validData = processedData.filter(row => {
      return Object.values(row).some(value => 
        value !== null && value !== undefined && value !== ''
      );
    });

    if (validData.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No valid data rows found' 
      });
    }

    const columns = Object.keys(validData[0] || {});
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store file data temporarily
    fileStorage.set(fileId, {
      data: validData,
      metadata: {
        fileName: originalname,
        fileSize: size,
        totalRows: validData.length,
        uploadedAt: new Date().toISOString()
      }
    });

    res.json({
      success: true,
      fileId,
      columns,
      previewData: validData.slice(0, 3), // 미리보기 3행
      metadata: {
        totalRows: validData.length,
        fileName: originalname,
        fileSize: size
      }
    });
  } catch (error) {
    console.error('Column extraction error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to extract columns',
      details: error.message 
    });
  }
});

// 2. 컬럼 매핑 제안 API
app.post('/api/mapping/suggest', async (req, res) => {
  try {
    const { columns } = req.body;
    
    if (!columns || !Array.isArray(columns)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid columns data' 
      });
    }

    console.log('Generating column mapping for:', columns);
    
    const mappingResult = await generateColumnMapping(columns);
    
    res.json({
      success: true,
      ...mappingResult
    });
  } catch (error) {
    console.error('Column mapping suggestion error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to generate column mapping',
      details: error.message 
    });
  }
});

// 3. 분석 실행 API (피벗테이블, 히트맵만 생성)
app.post('/api/analysis/execute', async (req, res) => {
  console.log('🎯 === ANALYSIS EXECUTE API HIT ===');
  console.log('🎯 Route: /api/analysis/execute');
  console.log('🎯 Method:', req.method);
  console.log('🎯 Headers:', {
    'x-user-id': req.headers['x-user-id'],
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length']
  });
  
  try {
    const userId = req.headers['x-user-id'];
    const { fileId, columnMapping } = req.body;
    
    console.log('📥 === REQUEST BODY PARSED ===');
    console.log('👤 User ID:', userId);
    console.log('📁 File ID:', fileId);
    console.log('🗺️ Column Mapping:', columnMapping);
    
    if (!userId) {
      console.error('❌ No user ID provided');
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }
    
    if (!fileId || !columnMapping) {
      console.error('❌ Missing required parameters');
      console.error('❌ fileId:', fileId);
      console.error('❌ columnMapping:', columnMapping);
      return res.status(400).json({ 
        success: false, 
        error: 'Missing fileId or columnMapping' 
      });
    }
    
    // 파일 데이터 조회 (데이터셋 또는 업로드된 파일)
    console.log('📁 === FETCHING FILE DATA ===');
    let fileData = fileStorage.get(fileId);
    
    // 데이터셋인 경우 처리
    if (fileId.startsWith('dataset_')) {
      const datasetId = fileId.replace('dataset_', '');
      console.log('📊 Processing dataset:', datasetId);
      
      // 실제 parquet 파일에서 데이터 읽기
      const realData = await readParquetDataset(datasetId);
      const datasetConfigs = {
        'campaign_data': { name: 'Campaign Data' },
        'adpack_data': { name: 'AdPack Data' }
      };
      
      fileData = {
        data: realData.rows,
        metadata: {
          fileName: datasetConfigs[datasetId]?.name || 'Dataset',
          fileSize: realData.rows.length,
          rowCount: realData.rows.length,
          columns: realData.columns
        }
      };
    }
    
    if (!fileData) {
      console.error('❌ File data not found for fileId:', fileId);
      console.error('❌ Available fileIds:', Array.from(fileStorage.keys()));
      return res.status(404).json({ 
        success: false, 
        error: 'File data not found or expired' 
      });
    }
    
    console.log('✅ File data found:', {
      fileName: fileData.metadata.fileName,
      fileSize: fileData.metadata.fileSize,
      rowCount: fileData.data.length,
      columnCount: fileData.data[0] ? Object.keys(fileData.data[0]).length : 0
    });
    
    console.log('📊 === STEP 1: GENERATING PIVOT TABLES ===');
    // 1단계: 피벗 테이블 생성
    const pivotTables = generatePivotTables(fileData.data, columnMapping);
    console.log('📊 Generated pivotTables:', {
      hasData: !!pivotTables,
      keys: Object.keys(pivotTables || {}),
      campaignCount: pivotTables?.Campaign?.length || 0,
      adSetCount: pivotTables?.['Ad Set']?.length || 0,
      adCount: pivotTables?.Ad?.length || 0
    });
    
    console.log('🖼️ === STEP 2: GENERATING HEATMAP ===');
    // 2단계: 히트맵 생성 (단순 버전)
    const heatmap = generateSimpleHeatmap(pivotTables.Campaign || []);
    console.log('🖼️ Heatmap generated:', {
      hasHeatmap: !!heatmap,
      heatmapLength: heatmap ? heatmap.length : 0
    });
    
    // 3단계: 결과 저장 (MongoDB) - AI 인사이트는 별도 API에서 생성
    let analysisDoc;
    if (Analysis && mongoose.connection.readyState === 1) {
      try {
        console.log('📊 Creating analysis document...');
        console.log('📊 pivotTables structure:', JSON.stringify(pivotTables, null, 2));
        console.log('📅 Setting createdAt to:', new Date());
        
        analysisDoc = new Analysis({
          userId,
          fileName: fileData.metadata.fileName,
          fileSize: fileData.metadata.fileSize,
          createdAt: new Date(),
          updatedAt: new Date(),
          rawData: fileData.data,
          pivotData: pivotTables || {},
          insights: '', // AI 인사이트는 별도 API에서 생성
          status: 'completed',
          metadata: {
            rowCount: fileData.data.length,
            columns: Object.keys(columnMapping),
            columnMapping,
            processedAt: new Date().toISOString()
          }
        });
        
        console.log('💾 Saving analysis to database...');
        await analysisDoc.save();
        console.log('✅ Analysis saved to database with ID:', analysisDoc._id);
        console.log('📅 Final createdAt value:', analysisDoc.createdAt);
      } catch (error) {
        console.error('❌ Database save failed:', error);
        console.error('❌ Error details:', error.message);
        console.error('❌ Error stack:', error.stack);
        console.warn('Analysis will be returned without database persistence');
      }
    } else {
      console.warn('⚠️ Database not available. Analysis will not be persisted.');
      console.log('MongoDB connection state:', mongoose.connection.readyState);
      console.log('Analysis model available:', !!Analysis);
    }
    
    console.log('🧹 === CLEANING UP ===');
    // 임시 파일 데이터 정리 (데이터셋이 아닌 경우에만)
    if (!fileId.startsWith('dataset_')) {
      fileStorage.delete(fileId);
      console.log('✅ File data cleaned up');
    } else {
      console.log('📊 Dataset data - no cleanup needed');
    }
    
    console.log('📤 === SENDING RESPONSE ===');
    const response = {
      success: true,
      analysisId: analysisDoc?._id || `temp_${Date.now()}`,
      fileName: fileData.metadata.fileName,
      pivotTables,
      heatmap,
      insights: '', // AI 인사이트는 별도 API에서 생성
      createdAt: analysisDoc?.createdAt || new Date(),
      metadata: {
        rowCount: fileData.data.length,
        columnMapping,
        processedAt: new Date().toISOString()
      }
    };
    
    console.log('📤 Response structure:', {
      success: response.success,
      analysisId: response.analysisId,
      fileName: response.fileName,
      hasPivotTables: !!response.pivotTables,
      hasHeatmap: !!response.heatmap,
      hasInsights: !!response.insights,
      insightsLength: response.insights ? response.insights.length : 0
    });
    
    res.json(response);
    console.log('✅ Analysis execution completed successfully');
  } catch (error) {
    console.error('❌ === ANALYSIS EXECUTION ERROR ===');
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Full error object:', error);
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to execute analysis',
      details: error.message 
    });
  }
});

// 4. AI 인사이트 생성 API (개선된 버전)
app.post('/api/analysis/insights', async (req, res) => {
  console.log('🤖 === AI INSIGHTS API HIT ===');
  console.log('🤖 Route: /api/analysis/insights');
  console.log('🤖 Method:', req.method);
  console.log('🤖 Headers:', {
    'x-user-id': req.headers['x-user-id'],
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length']
  });
  
  try {
    const userId = req.headers['x-user-id'];
    const { analysisId, pivotTables } = req.body;
    
    console.log('📥 === REQUEST BODY PARSED ===');
    console.log('👤 User ID:', userId);
    console.log('📊 Analysis ID:', analysisId);
    console.log('📊 PivotTables received:', pivotTables ? 'Yes' : 'No');
    console.log('📊 PivotTables keys:', pivotTables ? Object.keys(pivotTables) : 'N/A');
    
    // 데이터 구조 상세 로깅
    if (pivotTables) {
      Object.entries(pivotTables).forEach(([key, value]) => {
        console.log(`📊 ${key}:`, {
          type: typeof value,
          isArray: Array.isArray(value),
          length: Array.isArray(value) ? value.length : 'N/A',
          sample: Array.isArray(value) && value.length > 0 ? value[0] : value
        });
      });
    }
    
    if (!userId) {
      console.error('❌ No user ID provided');
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }
    
    if (!analysisId) {
      console.error('❌ No analysis ID provided');
      return res.status(400).json({ 
        success: false, 
        error: 'Analysis ID is required' 
      });
    }
    
    if (!pivotTables || typeof pivotTables !== 'object') {
      console.error('❌ Invalid pivot tables data:', pivotTables);
      return res.status(400).json({ 
        success: false, 
        error: 'Valid pivot tables data is required' 
      });
    }
    
    // 유효한 데이터가 있는지 확인
    const hasValidData = Object.values(pivotTables).some(data => 
      Array.isArray(data) && data.length > 0
    );
    
    if (!hasValidData) {
      console.error('❌ No valid data in pivot tables');
      return res.status(400).json({ 
        success: false, 
        error: 'No valid data found in pivot tables' 
      });
    }
    
    console.log('🤖 === GENERATING AI INSIGHTS ===');
    const insights = await generateAIInsights(pivotTables);
    
    console.log('✅ AI Insights generated:', {
      type: typeof insights,
      length: insights ? insights.length : 0,
      isString: typeof insights === 'string',
      preview: insights ? insights.substring(0, 100) + '...' : 'No insights',
      hasMarkdown: insights ? insights.includes('#') : false
    });
    
    // 데이터베이스에 인사이트 저장
    if (Analysis && mongoose.connection.readyState === 1) {
      try {
        console.log('💾 Saving insights to database...');
        const updateResult = await Analysis.findOneAndUpdate(
          { _id: analysisId, userId },
          { 
            insights,
            updatedAt: new Date()
          },
          { new: true }
        );
        
        if (updateResult) {
          console.log('✅ Insights saved to database');
        } else {
          console.warn('⚠️ Analysis not found for update, but continuing...');
        }
      } catch (error) {
        console.error('❌ Failed to save insights to database:', error);
        console.warn('Insights will be returned without database persistence');
      }
    } else {
      console.warn('⚠️ Database not available. Insights will not be persisted.');
    }
    
    console.log('📤 === SENDING INSIGHTS RESPONSE ===');
    const response = {
      success: true,
      analysisId,
      insights,
      generatedAt: new Date().toISOString(),
      metadata: {
        dataKeys: Object.keys(pivotTables),
        totalItems: Object.values(pivotTables).reduce((sum, data) => 
          sum + (Array.isArray(data) ? data.length : 0), 0
        )
      }
    };
    
    console.log('📤 Insights response structure:', {
      success: response.success,
      analysisId: response.analysisId,
      hasInsights: !!response.insights,
      insightsLength: response.insights ? response.insights.length : 0,
      totalItems: response.metadata.totalItems
    });
    
    res.json(response);
    console.log('✅ AI Insights generation completed successfully');
  } catch (error) {
    console.error('❌ === AI INSIGHTS GENERATION ERROR ===');
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to generate AI insights',
      details: error.message 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: mongoStatus
  });
});

// File upload and processing
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, buffer, size } = req.file;
    const fileExtension = path.extname(originalname).toLowerCase();

    console.log(`Processing file: ${originalname} (${size} bytes)`);

    let processedData;

    // Process based on file type
    if (fileExtension === '.csv') {
      processedData = await processCSV(buffer);
    } else if (['.xlsx', '.xls'].includes(fileExtension)) {
      processedData = processExcel(buffer);
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    // Validate data
    if (!processedData || processedData.length === 0) {
      return res.status(400).json({ error: 'No valid data found in file' });
    }

    // Filter out empty rows
    const validData = processedData.filter(row => {
      return Object.values(row).some(value => 
        value !== null && value !== undefined && value !== ''
      );
    });

    if (validData.length === 0) {
      return res.status(400).json({ error: 'No valid data rows found' });
    }

    console.log(`Successfully processed ${validData.length} rows`);

    // Generate analysis ID
    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    res.json({
      success: true,
      analysisId,
      data: validData,
      metadata: {
        filename: originalname,
        rows: validData.length,
        columns: Object.keys(validData[0] || {}),
        fileSize: size,
        processedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Upload processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process file',
      details: error.message 
    });
  }
});

// Upload and analyze endpoint
app.post('/api/upload-analyze', upload.single('file'), async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    
    if (!userId) {
      console.log('Auth Error: No user ID provided in headers');
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }

    console.log('Processing upload for user:', userId);

    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }

    const { originalname, buffer, size } = req.file;
    const fileExtension = path.extname(originalname).toLowerCase();

    // 1. File parsing
    let processedData;
    if (fileExtension === '.csv') {
      processedData = await processCSV(buffer);
    } else if (['.xlsx', '.xls'].includes(fileExtension)) {
      processedData = processExcel(buffer);
    } else {
      return res.status(400).json({ 
        success: false,
        error: 'Unsupported file type' 
      });
    }

    if (!processedData || processedData.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No valid data found in file' 
      });
    }

    // 2. Data analysis (with fallback if processors not available)
    const rawData = processedData;
    let pivotData = [];
    let classifiedData = [];

    if (processRawData && createPivotTable && classifyPerformance) {
      try {
        const processed = processRawData(rawData);
        pivotData = createPivotTable(processed, 'campaign');
        classifiedData = classifyPerformance(pivotData);
      } catch (error) {
        console.warn('Data processing error, using raw data:', error.message);
      }
    }

    // 3. Generate insights
    const insights = await generateAIInsights(pivotData);

    // 4. Save to MongoDB (if available)
    let analysisDoc;
    if (Analysis && mongoose.connection.readyState === 1) {
      try {
        console.log('Saving to database...');
        console.log('📅 Setting createdAt to:', new Date());
        analysisDoc = new Analysis({
          userId,
          fileName: originalname,
          fileSize: size,
          createdAt: new Date(),
          updatedAt: new Date(),
          rawData,
          pivotData: pivotData || {},
          classifiedData,
          insights,
          status: 'completed',
          metadata: {
            rowCount: rawData.length,
            columns: Object.keys(rawData[0] || {}),
            fileType: fileExtension.slice(1)
          }
        });

        await analysisDoc.save();
        console.log('Successfully saved to database with ID:', analysisDoc._id);
        console.log('📅 Final createdAt value:', analysisDoc.createdAt);
      } catch (error) {
        console.error('❌ Database save failed:', error);
        // 데이터베이스 저장 실패 시에도 응답은 반환하되, 경고 추가
        console.warn('Analysis will be returned without database persistence');
      }
    } else {
      console.warn('⚠️ Database not available. Analysis will not be persisted.');
      console.log('MongoDB connection state:', mongoose.connection.readyState);
      console.log('Analysis model available:', !!Analysis);
    }

    // 5. Return results
    res.json({
      success: true,
      analysisId: analysisDoc?._id || `temp_${Date.now()}`,
      fileName: originalname,
      rawData,
      pivotTables: pivotData || {},
      classifiedData,
      insights
    });
  } catch (error) {
    console.error('Upload-analyze error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to process file'
    });
  }
});

// Get user's analyses
app.get('/api/analyses', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    // Check if Analysis model and database are available
    if (!Analysis || mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        analyses: []
      });
    }

    const analyses = await Analysis.find({ userId })
      .sort({ createdAt: -1 })
      .select('_id fileName fileSize createdAt updatedAt status');

    res.json({
      success: true,
      analyses: analyses.map(analysis => ({
        _id: analysis._id,
        fileName: analysis.fileName,
        fileSize: analysis.fileSize,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt,
        status: analysis.status
      }))
    });
  } catch (error) {
    console.error('Error fetching analyses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analyses'
    });
  }
});

// Delete analysis
app.delete('/api/analyses/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    // Check if Analysis model and database are available
    if (!Analysis || mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: 'Database not available'
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid analysis ID'
      });
    }

    const result = await Analysis.deleteOne({ 
      _id: id, 
      userId 
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Analysis not found'
      });
    }

    console.log('✅ Analysis deleted:', id);
    res.json({
      success: true,
      message: 'Analysis deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete analysis',
      details: error.message
    });
  }
});

// Update analysis (rename)
app.patch('/api/analyses/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { id } = req.params;
    const { fileName } = req.body;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    if (!fileName || typeof fileName !== 'string' || fileName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid fileName is required'
      });
    }

    // Check if Analysis model and database are available
    if (!Analysis || mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: 'Database not available'
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid analysis ID'
      });
    }

    const analysis = await Analysis.findOneAndUpdate(
      { _id: id, userId },
      { 
        fileName: fileName.trim(),
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'Analysis not found'
      });
    }

    console.log('✅ Analysis renamed:', id, 'to:', fileName.trim());
    res.json({
      success: true,
      analysis: {
        _id: analysis._id,
        fileName: analysis.fileName,
        updatedAt: analysis.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update analysis',
      details: error.message
    });
  }
});
app.get('/api/analysis/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    // Check if Analysis model and database are available
    if (!Analysis || mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: 'Database not available'
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid analysis ID'
      });
    }

    const analysis = await Analysis.findOne({ 
      _id: id, 
      userId 
    });

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'Analysis not found'
      });
    }

    console.log('📊 Retrieved analysis:', {
      id: analysis._id,
      fileName: analysis.fileName,
      pivotDataLength: analysis.pivotData ? Object.keys(analysis.pivotData).length : 0,
      pivotDataKeys: analysis.pivotData ? Object.keys(analysis.pivotData) : [],
      hasCampaign: analysis.pivotData && analysis.pivotData.Campaign ? analysis.pivotData.Campaign.length : 0
    });

    // Safely convert pivotData to ensure it's always an object with arrays
    const safePivotTables = {};
    if (analysis.pivotData && typeof analysis.pivotData === 'object') {
      Object.keys(analysis.pivotData).forEach(key => {
        const value = analysis.pivotData[key];
        if (Array.isArray(value)) {
          safePivotTables[key] = value;
        } else if (value && typeof value === 'object') {
          // If it's an object, try to convert it to array format
          safePivotTables[key] = Object.values(value);
        } else {
          safePivotTables[key] = [];
        }
      });
    }

    res.json({
      success: true,
      analysis: {
        _id: analysis._id,
        fileName: analysis.fileName,
        fileSize: analysis.fileSize,
        rawData: Array.isArray(analysis.rawData) ? analysis.rawData : [],
        pivotTables: safePivotTables,
        classifiedData: Array.isArray(analysis.classifiedData) ? analysis.classifiedData : [],
        insights: analysis.insights || '',
        heatmapImage: analysis.heatmapImage || '',
        status: analysis.status,
        metadata: analysis.metadata || {},
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt
      }
    });
  } catch (error) {
    console.error('Error in /api/analysis/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analysis',
      details: error.message
    });
  }
});

// Add Gemini API endpoint
app.post('/api/analyze/gemini', async (req, res) => {
  try {
    const { data, analysisType } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }

    let result;
    switch (analysisType) {
      case 'weekly':
        result = await generateWeeklyReportWithGemini(data);
        break;
      case 'timeBased':
        const { timeFrame } = req.body;
        result = await generateTimeBasedAnalysisWithGemini(data, timeFrame);
        break;
      default:
        result = await processDataWithGemini(data);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in Gemini analysis:', error);
    res.status(500).json({ error: 'Failed to process data with Gemini API' });
  }
});

// Save analysis results
app.post('/api/analysis/save', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { analysisId, fileName, metadata, pivotTables, insights, heatmapImage, createdAt } = req.body;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    if (!analysisId || !fileName) {
      return res.status(400).json({
        success: false,
        error: 'Analysis ID and fileName are required'
      });
    }

    // Check if Analysis model and database are available
    if (!Analysis || mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: 'Database not available'
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(analysisId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid analysis ID'
      });
    }

    const analysis = await Analysis.findOneAndUpdate(
      { _id: analysisId, userId },
      { 
        fileName,
        metadata: metadata || {},
        pivotData: pivotTables || {},
        insights: insights || '',
        heatmapImage: heatmapImage || '',
        status: 'completed',
        updatedAt: new Date(),
        ...(createdAt && { createdAt: new Date(createdAt) })
      },
      { new: true }
    );

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'Analysis not found'
      });
    }

    console.log('✅ Analysis saved:', analysisId);
    res.json({
      success: true,
      analysis: {
        _id: analysis._id,
        fileName: analysis.fileName,
        status: analysis.status,
        updatedAt: analysis.updatedAt
      }
    });
  } catch (error) {
    console.error('Error saving analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save analysis',
      details: error.message
    });
  }
});

// Get analysis list (alias for /api/analyses)
app.get('/api/analysis/list', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    
    console.log('🔍 /api/analysis/list called');
    console.log('Headers:', req.headers);
    console.log('User ID:', userId);
    
    if (!userId) {
      console.log('❌ No user ID provided');
      return res.status(401).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    // Check if Analysis model and database are available
    if (!Analysis || mongoose.connection.readyState !== 1) {
      console.log('❌ Database not available');
      return res.json({
        success: true,
        analyses: []
      });
    }

    console.log('✅ Fetching analyses for user:', userId);
    const analyses = await Analysis.find({ userId })
      .sort({ createdAt: -1 })
      .select('_id fileName fileSize createdAt updatedAt status');

    console.log('✅ Found', analyses.length, 'analyses');

    res.json({
      success: true,
      analyses: analyses.map(analysis => ({
        _id: analysis._id,
        fileName: analysis.fileName,
        fileSize: analysis.fileSize,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt,
        status: analysis.status
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching analyses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analyses',
      details: error.message
    });
  }
});

// ===== CHAT API ENDPOINTS =====

// Debug middleware for chat routes
app.use('/api/chat/*', (req, res, next) => {
  console.log('🔍 Chat route debug:', {
    method: req.method,
    url: req.url,
    path: req.path,
    originalUrl: req.originalUrl
  });
  next();
});

// Send message to OpenAI
app.post('/api/chat/send', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { message, contexts, analysisData, chatHistory } = req.body;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID is required' });
    }
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.json({
        success: true,
        response: "I'm sorry, but I need a valid OpenAI API key to provide intelligent responses. Please check your configuration and try again."
      });
    }
    // Build prompt
    let fullPrompt = `You are an AI assistant specialized in marketing data analysis. You have access to campaign performance data and should provide helpful insights, answer questions, and make recommendations based on the data provided.\n\nUser's question: ${message}\n\n`;
    if (analysisData) {
      fullPrompt += `\nAnalysis Context:\n- File: ${analysisData.fileName || 'Unknown'}\n- Total rows: ${analysisData.metadata?.rowCount || 'Unknown'}\n- Created: ${analysisData.createdAt ? new Date(analysisData.createdAt).toLocaleDateString() : 'Unknown'}\n\n`;
    }
    if (contexts && contexts.length > 0) {
      fullPrompt += `\nSpecific Data Context:\n`;
      contexts.forEach((context) => {
        fullPrompt += `\n${context.name}:\n`;
        if (context.type === 'data' || context.type === 'pivot') {
          const limitedData = Array.isArray(context.data) ? context.data.slice(0, 20) : context.data;
          fullPrompt += JSON.stringify(limitedData, null, 2);
        } else if (context.type === 'report') {
          fullPrompt += context.data;
        } else if (context.type === 'visualization') {
          if (Array.isArray(context.data) && context.data.length > 0 && typeof context.data[0] === 'string' && context.data[0].startsWith('data:image')) {
            fullPrompt += `Heatmap visualization image (base64 encoded):\n`;
            fullPrompt += `![Performance Heatmap](${context.data[0]})\n`;
            fullPrompt += `This is a visual representation of campaign performance metrics. Please analyze this heatmap image and provide insights about the performance patterns shown.`;
          } else {
            fullPrompt += `Heatmap data with ${Array.isArray(context.data) ? context.data.length : 0} campaigns`;
          }
        }
        fullPrompt += '\n';
      });
    }
    if (chatHistory && chatHistory.length > 0) {
      fullPrompt += `\nRecent conversation history:\n`;
      chatHistory.forEach((msg) => {
        fullPrompt += `${msg.type === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
      });
    }
    fullPrompt += `\nPlease provide a helpful, accurate response based on the data and context provided. Use markdown formatting for better readability. Focus on actionable insights and specific recommendations when possible.`;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: fullPrompt }],
      max_tokens: 1024,
      temperature: 0.7,
    });
    const aiResponse = completion.choices[0].message.content;
    res.json({
      success: true,
      response: aiResponse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to process chat message',
      details: error.message
    });
  }
});

// Get chat history for an analysis
app.get('/api/chat/:analysisId', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { analysisId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    if (!analysisId) {
      return res.status(400).json({
        success: false,
        error: 'Analysis ID is required'
      });
    }

    console.log('📬 Loading chat history for:', { userId, analysisId });

    // Check if Chat model and database are available
    if (!Chat || mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        messages: []
      });
    }

    const chat = await Chat.findOne({ 
      userId, 
      analysisId 
    });

    res.json({
      success: true,
      messages: chat ? chat.messages : []
    });
  } catch (error) {
    console.error('Error loading chat history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load chat history',
      details: error.message
    });
  }
});

// Save chat history for an analysis
app.post('/api/chat/:analysisId', async (req, res) => {
  console.log('🎯 HIT: /api/chat/:analysisId route with analysisId:', req.params.analysisId);
  try {
    const userId = req.headers['x-user-id'];
    const { analysisId } = req.params;
    const { messages } = req.body;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    if (!analysisId || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Analysis ID and messages array are required'
      });
    }

    console.log('💾 Saving chat history for:', { userId, analysisId, messageCount: messages.length });

    // Check if Chat model and database are available
    if (!Chat || mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        message: 'Chat history saved (in memory only - database not available)'
      });
    }

    await Chat.findOneAndUpdate(
      { userId, analysisId },
      { 
        messages,
        updatedAt: new Date()
      },
      { 
        upsert: true,
        new: true
      }
    );

    console.log('✅ Chat history saved successfully');
    res.json({
      success: true,
      message: 'Chat history saved successfully'
    });
  } catch (error) {
    console.error('Error saving chat history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save chat history',
      details: error.message
    });
  }
});

// Delete chat history for an analysis
app.delete('/api/chat/:analysisId', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { analysisId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    // Check if Chat model and database are available
    if (!Chat || mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        message: 'Chat history cleared (database not available)'
      });
    }

    await Chat.deleteOne({ userId, analysisId });

    console.log('🗑️ Chat history deleted for:', { userId, analysisId });
    res.json({
      success: true,
      message: 'Chat history deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting chat history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete chat history',
      details: error.message
    });
  }
});

// Get recent chats for a user (optional - for future dashboard feature)
app.get('/api/chat/recent', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    // Check if Chat model and database are available
    if (!Chat || mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        chats: []
      });
    }

    const recentChats = await Chat.getRecentChats(userId, 10);

    res.json({
      success: true,
      chats: recentChats
    });
  } catch (error) {
    console.error('Error fetching recent chats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent chats',
      details: error.message
    });
  }
});

// ===== END CHAT API ENDPOINTS =====

// ===== DATASET API ENDPOINTS =====

// Get available datasets
app.get('/api/datasets', async (req, res) => {
  try {
    const datasets = [
      {
        id: 'campaign_data',
        name: 'Campaign Data',
        description: '캠페인 레벨 데이터 (Publisher: Meta)',
        file: '/db/campaign_data.parquet',
        icon: '📊',
        expectedColumns: [
          'campaign_id', 'campaign_name', 'campaign_status', 'budget', 
          'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm'
        ]
      },
      {
        id: 'adpack_data',
        name: 'AdPack Data',
        description: '광고 팩 레벨 데이터 (Campaign ID 기반 맵핑)',
        file: '/db/adpack_data.parquet',
        icon: '📈',
        expectedColumns: [
          'adpack_id', 'campaign_id', 'ad_name', 'ad_status', 
          'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'conversions'
        ]
      }
    ];

    res.json({
      success: true,
      datasets
    });
  } catch (error) {
    console.error('Error fetching datasets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch datasets',
      details: error.message
    });
  }
});

// Process dataset for analysis
app.post('/api/datasets/process', async (req, res) => {
  try {
    const { datasetId } = req.body;
    const userId = req.headers['x-user-id'];

    if (!datasetId) {
      return res.status(400).json({
        success: false,
        error: 'Dataset ID is required'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Dataset configuration
    const datasetConfigs = {
      'campaign_data': {
        name: 'Campaign Data',
        file: path.join(__dirname, 'data/campaign_data.parquet')
      },
      'adpack_data': {
        name: 'AdPack Data',
        file: path.join(__dirname, 'data/adpack_data.parquet')
      }
    };

    const config = datasetConfigs[datasetId];
    if (!config) {
      return res.status(400).json({
        success: false,
        error: 'Invalid dataset ID'
      });
    }

    // Check if file exists
    if (!fs.existsSync(config.file)) {
      return res.status(404).json({
        success: false,
        error: 'Dataset file not found'
      });
    }

    // 1. Parquet 파일에서 데이터 읽기 (DuckDB 사용)
    let rows = [];
    let columns = [];
    try {
      const db = new duckdb.Database(':memory:');
      const con = db.connect();
      // DuckDB는 파일 경로를 직접 쿼리할 수 있음
      const query = `SELECT * FROM read_parquet('${config.file.replace(/'/g, "''")}')`;
      const result = await new Promise((resolve, reject) => {
        con.all(query, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        });
      });
      // BigInt 값을 일반 숫자로 변환
      rows = convertBigInts(result);
      columns = rows[0] ? Object.keys(rows[0]) : [];
      con.close();
      db.close();
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: 'Failed to read parquet file',
        details: err.message
      });
    }

    if (!columns.length) {
      return res.status(400).json({
        success: false,
        error: 'No columns found in dataset'
      });
    }

    // 2. 컬럼 매핑 추천 (내부 함수 직접 호출)
    let mappingResult;
    try {
      mappingResult = await generateColumnMapping(columns);
    } catch (err) {
      mappingResult = generateSimpleMapping(columns);
    }

    res.json({
      success: true,
      datasetId,
      datasetName: config.name,
      columns,
      data: rows,
      ...mappingResult,
      fileId: `dataset_${datasetId}`,
      rowCount: rows.length
    });

  } catch (error) {
    console.error('Error processing dataset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process dataset',
      details: error.message
    });
  }
});

// Generate mock data for datasets
const generateMockDataForDataset = (datasetId) => {
  const mockData = {
    'campaign_data': [
      {
        campaign_id: 'CAMP001',
        campaign_name: 'Summer Sale Campaign',
        campaign_status: 'ACTIVE',
        budget: 5000,
        spend: 3200,
        impressions: 150000,
        clicks: 4500,
        ctr: '3.0%',
        cpc: 0.71,
        cpm: 21.33
      },
      {
        campaign_id: 'CAMP002',
        campaign_name: 'Brand Awareness',
        campaign_status: 'ACTIVE',
        budget: 3000,
        spend: 2800,
        impressions: 200000,
        clicks: 3200,
        ctr: '1.6%',
        cpc: 0.88,
        cpm: 14.00
      },
      {
        campaign_id: 'CAMP003',
        campaign_name: 'Product Launch',
        campaign_status: 'PAUSED',
        budget: 8000,
        spend: 6500,
        impressions: 300000,
        clicks: 8900,
        ctr: '3.0%',
        cpc: 0.73,
        cpm: 21.67
      }
    ],
    'adpack_data': [
      {
        adpack_id: 'ADP001',
        campaign_id: 'CAMP001',
        ad_name: 'Summer Sale Banner',
        ad_status: 'ACTIVE',
        spend: 1200,
        impressions: 50000,
        clicks: 1800,
        ctr: '3.6%',
        cpc: 0.67,
        cpm: 24.00,
        conversions: 45
      },
      {
        adpack_id: 'ADP002',
        campaign_id: 'CAMP001',
        ad_name: 'Summer Sale Video',
        ad_status: 'ACTIVE',
        spend: 2000,
        impressions: 100000,
        clicks: 2700,
        ctr: '2.7%',
        cpc: 0.74,
        cpm: 20.00,
        conversions: 67
      },
      {
        adpack_id: 'ADP003',
        campaign_id: 'CAMP002',
        ad_name: 'Brand Video',
        ad_status: 'ACTIVE',
        spend: 2800,
        impressions: 200000,
        clicks: 3200,
        ctr: '1.6%',
        cpc: 0.88,
        cpm: 14.00,
        conversions: 89
      }
    ]
  };

  return mockData[datasetId] || [];
};

// Generate column mapping for datasets
const generateColumnMappingForDataset = (datasetId) => {
  const mappings = {
    'campaign_data': {
      campaign: 'campaign_name',
      spend: 'spend',
      impressions: 'impressions',
      clicks: 'clicks',
      ctr: 'ctr',
      cpc: 'cpc',
      cpm: 'cpm',
      budget: 'budget',
      status: 'campaign_status'
    },
    'adpack_data': {
      campaign: 'campaign_id',
      ad: 'ad_name',
      spend: 'spend',
      impressions: 'impressions',
      clicks: 'clicks',
      ctr: 'ctr',
      cpc: 'cpc',
      cpm: 'cpm',
      conversions: 'conversions',
      status: 'ad_status'
    }
  };

  return mappings[datasetId] || {};
};

// ===== END DATASET API ENDPOINTS =====

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large', 
        details: `Maximum file size is ${process.env.MAX_FILE_SIZE || '10MB'}` 
      });
    }
  }

  res.status(500).json({ 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Marketing Analyzer Backend running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 OpenAI API: ${process.env.OPENAI_API_KEY ? 'Configured' : 'Missing (using fallback)'}`);
  console.log(`📁 Max file size: ${process.env.MAX_FILE_SIZE || '10MB'}`);
  console.log(`🗄️ Database: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Not connected'}`);
});

// OpenAI API 테스트 엔드포인트
app.post('/api/test-openai', async (req, res) => {
  console.log('🧪 === OPENAI API TEST ===');
  
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      return res.status(400).json({
        success: false,
        error: 'OpenAI API key not configured'
      });
    }
    
    console.log('🔑 Testing OpenAI API with key:', OPENAI_API_KEY.substring(0, 7) + '...');
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant. Please respond with a simple test message."
        },
        {
          role: "user",
          content: "Hello, this is a test. Please respond with 'OpenAI API is working correctly' in Korean."
        }
      ],
      max_tokens: 100,
      temperature: 0.7,
    });
    
    const response = completion.choices[0].message.content;
    
    console.log('✅ OpenAI API test successful:', response);
    
    res.json({
      success: true,
      message: 'OpenAI API is working correctly',
      response: response,
      model: 'gpt-4o',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ OpenAI API test failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'OpenAI API test failed',
      details: error.message,
      status: error.status,
      code: error.code
    });
  }
});

// BigInt를 일반 숫자로 변환하는 함수
const convertBigInts = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertBigInts);
  }
  
  if (typeof obj === 'object') {
    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigInts(value);
    }
    return converted;
  }
  
  return obj;
};

module.exports = app;
