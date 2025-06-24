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
const { GoogleGenAI } = require("@google/genai");

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

// Middleware
app.use(cors({
  origin: true, // Allow all origins temporarily for debugging
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-user-id', 'Authorization', 'Origin', 'Accept'],
  exposedHeaders: ['Content-Type', 'x-user-id'],
  maxAge: 86400 // 24 hours
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

// Simple AI insights placeholder (if Gemini API not available)
const generateSimpleInsights = (data) => {
  if (!data || data.length === 0) {
    return "No data available for analysis.";
  }

  const columns = Object.keys(data[0]);
  const insights = [
    `Data contains ${data.length} rows and ${columns.length} columns.`,
    `Columns include: ${columns.slice(0, 5).join(', ')}${columns.length > 5 ? '...' : ''}.`,
    "Upload successful! Your data is ready for analysis."
  ];

  return insights.join(' ');
};

const MARKETING_ANALYSIS_PROMPT = `You are a performance marketing analyst with expertise in interpreting campaign-level ad data.

You will receive marketing performance data in CSV format. The columns will be similar to: 'Date', 'Campaign', 'Ad Set', 'Ad', 'Cost', 'Impression', 'Click', 'Purchase', 'Revenue'. Column names may vary slightly.

Your task is to complete **three structured steps**:

---

### 📊 Step 1: Pivot Table Generation (CSV Output)

- Generate **three pivot tables** grouped by:
  1. Campaign
  2. Ad Set
  3. Ad

- For each group, calculate the following metrics:
  - **Impression**
  - **CTR** = Click / Impression
  - **Purchase**
  - **CVR** = Purchase / Click
  - **Cost**
  - **Click**
  - **CPA** = Cost / Purchase
  - **Revenue**

- Sort each pivot table **by Impression, CTR, and Purchase in descending order**.

- Return each pivot table using:
  \`\`\`csv
  (table)
  \`\`\`

---

### 🌡️ Step 2: Heatmap Visualization (Base64 Encoded Image)

- Create a **heatmap** visualizing performance metrics (CTR, CVR, CPA, Revenue) across campaigns or ad sets.
- You can use Python (e.g., Matplotlib, Seaborn) to generate the heatmap.
- Convert the image to base64 and return it using:

\`\`\`image
data:image/png;base64,...(base64 string)
\`\`\`

Do **not return the code** — only the base64 image.

---

### 📈 Step 3: Insightful Analysis & Recommendations (Marketing Report)

Analyze the performance based on the above data. Structure your response as a marketing report in natural language, including:

#### A. Good / Bad Creative Classification
- Identify **high CTR but low CVR** ads (good hook but poor conversion).
- Identify **high CVR with low CTR** (effective but not attractive).
- Use this to infer strengths and weaknesses of creative assets (copy, image, CTA alignment with landing page).

#### B. Key Insights (3–5 bullet points)
- Top-performing campaigns, ads, and ad sets
- Low-performing segments needing attention
- Patterns in targeting, budget allocation, and creative success

#### C. Actionable Recommendations
- What should be optimized? (budget reallocation, ad structure, creative)
- How to address underperformance?
- Which creative types work best?

Format your response as a JSON object like below:

{
  "pivotTables": {
    "campaign": "...",   // CSV block
    "adSet": "...",      // CSV block
    "ad": "..."          // CSV block
  },
  "heatmap": "...",       // Base64 image block
  "report": {
    "creativeAnalysis": "...",
    "insights": "...",
    "recommendations": "..."
  }
}`;

// Column mapping with Gemini AI
const generateColumnMapping = async (columns) => {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    console.log('No Gemini API key found, using simple mapping');
    return generateSimpleMapping(columns);
  }

  try {
    const prompt = `
다음 컬럼명들을 표준 마케팅 데이터 컬럼에 매핑해주세요:

입력 컬럼: ${columns.join(', ')}
표준 컬럼: Date, Campaign, Ad Set, Ad, Cost, Impression, Click, Purchase, Revenue

각 입력 컬럼을 가장 적절한 표준 컬럼에 매핑하고, 확신도(0-1)를 함께 제공해주세요.
매핑이 어려운 컬럼은 unmapped에 포함시키고, 애매한 경우 suggestions에 대안을 제공해주세요.

다음 JSON 형태로만 응답해주세요 (다른 텍스트 없이):
{
  "mapping": {
    "사용자컬럼": "표준컬럼"
  },
  "confidence": {
    "사용자컬럼": 0.95
  },
  "unmapped": ["매핑되지않은컬럼"],
  "suggestions": {
    "애매한컬럼": ["대안1", "대안2"]
  }
}
    `;

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const mappingText = result.response.text();
    
    if (!mappingText) {
      throw new Error('No mapping result from Gemini API');
    }

    // JSON 파싱 시도
    try {
      const cleanText = mappingText.replace(/```json\n?|```\n?/g, '').trim();
      const mappingResult = JSON.parse(cleanText);
      return mappingResult;
    } catch (parseError) {
      console.warn('Failed to parse Gemini mapping result, using fallback');
      return generateSimpleMapping(columns);
    }
  } catch (error) {
    console.error('Column mapping error:', error);
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
      results[level] = [];
      return;
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
    
    results[level] = Object.entries(grouped).map(([name, metrics]) => ({
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

// Gemini AI integration (with fallback)
const generateAIInsights = async (data, analysisType = 'general') => {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  console.log('Gemini API Key status:', GEMINI_API_KEY ? 'Present' : 'Missing');
  
  if (!GEMINI_API_KEY) {
    console.log('No Gemini API key found, using simple insights');
    return generateSimpleInsights(data);
  }

  try {
    // Prepare data summary for AI analysis
    const dataSummary = {
      totalRows: data.length,
      columns: Object.keys(data[0] || {}),
      data: data
    };

    // 데이터를 문자열로 변환
    const dataStr = data.map(row => 
      Object.entries(row)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
    ).join('\n');

    const prompt = `${MARKETING_ANALYSIS_PROMPT}

Data Summary:
- Total rows: ${dataSummary.totalRows}
- Columns: ${dataSummary.columns.join(', ')}

Complete Data:
${dataStr}`;

    console.log('Sending request to Gemini API with data length:', data.length);

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    let geminiResponseText = '';
    try {
      const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);
      geminiResponseText = result.response.text();
      console.log('✅ Gemini 2.5-flash response:', geminiResponseText.substring(0, 200) + '...');
    } catch (err) {
      console.error('❌ Gemini 2.5-flash API error:', err);
      throw new Error('Gemini 2.5-flash API error: ' + err.message);
    }

    if (!geminiResponseText) {
      throw new Error('No response generated from Gemini 2.5-flash API');
    }

    return geminiResponseText;
  } catch (error) {
    console.error('AI Insights Error:', error);
    return generateSimpleInsights(data);
  }
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

// 3. 분석 실행 API
app.post('/api/analysis/execute', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { fileId, columnMapping } = req.body;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }

    if (!fileId || !columnMapping) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing fileId or columnMapping' 
      });
    }

    // 파일 데이터 조회
    const fileData = fileStorage.get(fileId);
    if (!fileData) {
      return res.status(404).json({ 
        success: false,
        error: 'File data not found or expired' 
      });
    }

    console.log('Executing analysis for file:', fileData.metadata.fileName);

    // 1단계: 피벗 테이블 생성
    const pivotTables = generatePivotTables(fileData.data, columnMapping);
    console.log('📊 Generated pivotTables:', {
      hasData: !!pivotTables,
      keys: Object.keys(pivotTables || {}),
      campaignCount: pivotTables?.Campaign?.length || 0,
      adSetCount: pivotTables?.['Ad Set']?.length || 0,
      adCount: pivotTables?.Ad?.length || 0
    });
    
    // 2단계: 히트맵 생성 (단순 버전)
    const heatmap = generateSimpleHeatmap(pivotTables.Campaign || []);
    
    // 3단계: Gemini API로 리포트 생성
    const reportPrompt = `
다음 피벗 테이블 데이터를 분석하여 마케팅 성과 리포트를 작성해주세요:

Campaign 레벨 데이터:
${JSON.stringify(pivotTables.Campaign, null, 2)}

Ad Set 레벨 데이터:
${JSON.stringify(pivotTables['Ad Set'], null, 2)}

Ad 레벨 데이터:
${JSON.stringify(pivotTables.Ad, null, 2)}

다음 구조로 분석해주세요:

## 📊 전체 성과 요약
- 총 캠페인 수, 노출수, 클릭수, 전환수 등 핵심 지표 요약

## 🎯 크리에이티브 분석
- CTR이 높지만 CVR이 낮은 광고 (관심 유발은 되지만 전환이 어려운 광고)
- CTR은 낮지만 CVR이 높은 광고 (타겟팅이 정확한 광고)
- 전반적인 크리에이티브 품질 평가

## 💡 핵심 인사이트 (3-5개)
- 가장 성과가 좋은 캠페인/광고세트/광고
- 개선이 필요한 부분
- 예산 배분이나 타겟팅 관련 패턴

## 🚀 실행 가능한 개선 방안
- 구체적인 액션 아이템들
- 예산 재배분 제안
- 크리에이티브 최적화 방향

한국어로 작성해주세요.
    `;
    
    // 3단계: Gemini API로 리포트 생성
    let insights;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (GEMINI_API_KEY) {
      try {
        insights = await generateAIInsights(fileData.data, 'general');
      } catch (error) {
        console.error('Gemini API error:', error);
        insights = '리포트 생성에 실패했습니다.';
      }
    } else {
      insights = `# 📊 분석 완료\n\n캠페인 ${pivotTables.Campaign?.length || 0}개, 광고세트 ${pivotTables['Ad Set']?.length || 0}개, 광고 ${pivotTables.Ad?.length || 0}개를 분석했습니다.\n\n더 자세한 분석을 위해 Gemini API 키를 설정해주세요.`;
    }
    
    // 4단계: 결과 저장 (MongoDB)
    let analysisDoc;
    if (Analysis && mongoose.connection.readyState === 1) {
      try {
        console.log('Creating analysis document...');
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
          insights,
          status: 'completed',
          metadata: {
            rowCount: fileData.data.length,
            columns: Object.keys(columnMapping),
            columnMapping,
            processedAt: new Date().toISOString()
          }
        });

        console.log('Saving analysis to database...');
        await analysisDoc.save();
        console.log('✅ Analysis saved to database with ID:', analysisDoc._id);
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

    // 임시 파일 데이터 정리
    fileStorage.delete(fileId);

    res.json({
      success: true,
      analysisId: analysisDoc?._id || `temp_${Date.now()}`,
      fileName: fileData.metadata.fileName,
      pivotTables,
      heatmap,
      insights,
      metadata: {
        rowCount: fileData.data.length,
        columnMapping,
        processedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Analysis execution error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to execute analysis',
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
    const insights = await generateAIInsights(rawData, 'general');

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

// Send message to Gemini AI
app.post('/api/chat/send', async (req, res) => {
  console.log('🎯 === CHAT SEND API HIT ===');
  console.log('🎯 Route: /api/chat/send');
  console.log('🎯 Method:', req.method);
  console.log('🎯 Headers:', {
    'x-user-id': req.headers['x-user-id'],
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length']
  });
  
  try {
    const userId = req.headers['x-user-id'];
    const { message, contexts, analysisData, chatHistory } = req.body;
    
    console.log('📥 === REQUEST BODY PARSED ===');
    console.log('👤 User ID:', userId);
    console.log('📝 Message length:', message ? message.length : 0);
    console.log('📝 Message preview:', message ? message.substring(0, 100) + '...' : 'No message');
    console.log('🔗 Contexts count:', contexts ? contexts.length : 0);
    console.log('📊 Has analysis data:', !!analysisData);
    console.log('💬 Chat history count:', chatHistory ? chatHistory.length : 0);
    
    if (!userId) {
      console.error('❌ No user ID provided');
      return res.status(401).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    if (!message || typeof message !== 'string') {
      console.error('❌ Invalid message format');
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    console.log('🤖 === PROCESSING CHAT MESSAGE ===');
    console.log('🤖 Processing for user:', userId);
    console.log('🤖 Message length:', message.length);
    console.log('🤖 Context count:', contexts ? contexts.length : 0);
    console.log('🤖 Has analysis data:', !!analysisData);
    console.log('🤖 Chat history length:', chatHistory ? chatHistory.length : 0);

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    console.log('🔑 === GEMINI API KEY CHECK ===');
    console.log('🔑 API Key present:', !!GEMINI_API_KEY);
    console.log('🔑 API Key length:', GEMINI_API_KEY ? GEMINI_API_KEY.length : 0);
    console.log('🔑 API Key preview:', GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 10) + '...' : 'No key');
    
    if (!GEMINI_API_KEY) {
      console.log('❌ No Gemini API key found, using fallback response');
      return res.json({
        success: true,
        response: "I'm sorry, but I need a valid API key to provide intelligent responses. Please check your configuration and try again."
      });
    }

    console.log('📝 === BUILDING PROMPT ===');
    
    // Build context for Gemini
    let fullPrompt = `You are an AI assistant specialized in marketing data analysis. You have access to campaign performance data and should provide helpful insights, answer questions, and make recommendations based on the data provided.\n\nUser's question: ${message}\n\n`;

    console.log('📝 Base prompt length:', fullPrompt.length);

    // Add analysis context if provided
    if (analysisData) {
      console.log('📊 Adding analysis context...');
      fullPrompt += `\nAnalysis Context:\n- File: ${analysisData.fileName || 'Unknown'}\n- Total rows: ${analysisData.metadata?.rowCount || 'Unknown'}\n- Created: ${analysisData.createdAt ? new Date(analysisData.createdAt).toLocaleDateString() : 'Unknown'}\n\n`;
      console.log('📊 Analysis context added');
    }

    // Add specific data contexts if selected
    if (contexts && contexts.length > 0) {
      console.log('🔗 === ADDING CONTEXT DATA ===');
      fullPrompt += `\nSpecific Data Context:\n`;
      
      contexts.forEach((context, index) => {
        console.log(`🔗 Context ${index + 1}: ${context.name} (${context.type})`);
        fullPrompt += `\n${context.name}:\n`;
        
        if (context.type === 'data' || context.type === 'pivot') {
          // Limit data size for API call
          const limitedData = Array.isArray(context.data) 
            ? context.data.slice(0, 20)
            : context.data;
          console.log(`  📊 Data type: ${context.type}, Limited to 20 items`);
          fullPrompt += JSON.stringify(limitedData, null, 2);
        } else if (context.type === 'report') {
          console.log(`  📄 Report data length: ${context.data ? context.data.length : 0}`);
          fullPrompt += context.data;
        } else if (context.type === 'visualization') {
          console.log(`  🖼️ Visualization type detected`);
          // Check if this is a heatmap with base64 image data
          if (Array.isArray(context.data) && context.data.length > 0 && 
              typeof context.data[0] === 'string' && context.data[0].startsWith('data:image')) {
            console.log(`  🔥 Heatmap image detected`);
            fullPrompt += `Heatmap visualization image (base64 encoded):\n`;
            fullPrompt += `![Performance Heatmap](${context.data[0]})\n`;
            fullPrompt += `This is a visual representation of campaign performance metrics. Please analyze this heatmap image and provide insights about the performance patterns shown.`;
          } else {
            console.log(`  📊 Heatmap data with ${Array.isArray(context.data) ? context.data.length : 0} campaigns`);
            fullPrompt += `Heatmap data with ${Array.isArray(context.data) ? context.data.length : 0} campaigns`;
          }
        }
        fullPrompt += '\n';
      });
      console.log('🔗 Context data added to prompt');
    }

    // Add recent chat history for context
    if (chatHistory && chatHistory.length > 0) {
      console.log('💬 Adding chat history...');
      fullPrompt += `\nRecent conversation history:\n`;
      chatHistory.forEach((msg, index) => {
        console.log(`  💬 Message ${index + 1}: ${msg.type} - ${msg.content.substring(0, 50)}...`);
        fullPrompt += `${msg.type === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
      });
      console.log('💬 Chat history added');
    }

    console.log('📝 Final prompt length:', fullPrompt.length);

    // Check if we have any heatmap images in contexts
    const heatmapImages = [];
    if (contexts && contexts.length > 0) {
      console.log('🖼️ === CHECKING FOR HEATMAP IMAGES ===');
      contexts.forEach((context, index) => {
        if (context.type === 'visualization' && 
            Array.isArray(context.data) && 
            context.data.length > 0 && 
            typeof context.data[0] === 'string' && 
            context.data[0].startsWith('data:image')) {
          heatmapImages.push(context.data[0]);
          console.log(`🔥 Heatmap image ${index + 1} detected in context:`, {
            contextName: context.name,
            imageDataLength: context.data[0].length,
            imageDataPreview: context.data[0].substring(0, 100) + '...'
          });
        }
      });
    }

    console.log('🖼️ Total heatmap images found:', heatmapImages.length);

    // If we have heatmap images, update the prompt to mention image analysis
    if (heatmapImages.length > 0) {
      console.log('🖼️ Adding heatmap analysis instructions...');
      fullPrompt += `\n\nIMPORTANT: You have been provided with a heatmap visualization image showing campaign performance metrics. Please analyze this image and provide insights about:\n- Performance patterns visible in the heatmap\n- Which campaigns/ads are performing well (darker green areas)\n- Which campaigns/ads need attention (darker red areas)\n- Overall performance distribution and trends\n- Specific recommendations based on the visual patterns you observe\n\nPlease reference the heatmap image in your analysis and provide specific insights about what you can see in the visualization.`;
    }

    fullPrompt += `\nPlease provide a helpful, accurate response based on the data and context provided. Use markdown formatting for better readability. Focus on actionable insights and specific recommendations when possible.`;

    console.log('📤 === PREPARING GEMINI API REQUEST ===');
    console.log('📤 Final prompt length:', fullPrompt.length);
    console.log('📤 Heatmap images count:', heatmapImages.length);

    // Prepare request parts (for Gemini 2.5 SDK)
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    let geminiResponseText = '';
    try {
      const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(fullPrompt);
      geminiResponseText = result.response.text();
      console.log('✅ Gemini 2.5-flash response:', geminiResponseText.substring(0, 200) + '...');
    } catch (err) {
      console.error('❌ Gemini 2.5-flash API error:', err);
      throw new Error('Gemini 2.5-flash API error: ' + err.message);
    }

    if (!geminiResponseText) {
      throw new Error('No response generated from Gemini 2.5-flash API');
    }

    console.log('📤 === SENDING RESPONSE TO CLIENT ===');
    res.json({
      success: true,
      response: geminiResponseText
    });
    console.log('✅ Response sent to client successfully');
    
  } catch (error) {
    console.error('❌ === CHAT API ERROR ===');
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Full error object:', error);
    
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
  console.log(`🔑 Gemini API: ${process.env.GEMINI_API_KEY ? 'Configured' : 'Missing (using fallback)'}`);
  console.log(`📁 Max file size: ${process.env.MAX_FILE_SIZE || '10MB'}`);
  console.log(`🗄️ Database: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Not connected'}`);
});

module.exports = app;
