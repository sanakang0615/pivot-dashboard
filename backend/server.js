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
const ParquetConverter = require('./utils/parquetConverter');

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
  'https://pivot-dashboard.vercel.app',
  'https://pivot-dashboard-production.up.railway.app'
];

const corsOptions = {
  origin: (origin, callback) => {
    console.log('→ CORS origin:', origin);
    if (!origin) return callback(null, true); // allow non-browser clients
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS 차단: ${origin}`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','x-user-id','Authorization','X-Requested-With'],
  exposedHeaders: ['Content-Length','X-Requested-With'],
  optionsSuccessStatus: 200,
  maxAge: 86400
};

// CORS 미들웨어는 반드시 라우트 정의 전에!
app.use(cors(corsOptions));

// Handle preflight requests explicitly for better compatibility
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-user-id, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '6400');
  res.sendStatus(200);
});

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

// 간단한 parquet 데이터셋 읽기 함수 (Python 변환 사용)
const readParquetDataset = async (datasetId) => {
  try {
    console.log(`📊 Reading dataset: ${datasetId}`);
    
    // ParquetConverter 인스턴스 생성
    const dataDirectory = path.join(__dirname, 'data');
    const converter = new ParquetConverter(dataDirectory);
    
    // Parquet을 CSV로 변환
    const csvPath = await converter.convertParquetToCSV(datasetId);
    
    // 변환된 CSV 파일 읽기
    const csvBuffer = fs.readFileSync(csvPath);
    const processedData = await processCSV(csvBuffer);
    
    if (!processedData || processedData.length === 0) {
      throw new Error('No data found in converted CSV file');
    }
    
    const columns = Object.keys(processedData[0] || {});
    
    console.log(`📊 Dataset loaded successfully:`, {
      datasetId,
      rowCount: processedData.length,
      columnCount: columns.length,
      csvPath
    });
    
    return {
      rows: processedData,
      columns,
      datasetId,
      fileName: converter.getDatasetName(datasetId)
    };
    
  } catch (error) {
    console.error(`❌ Error reading dataset ${datasetId}:`, error);
    
    // 더 구체적인 에러 메시지
    if (error.code === 'ENOENT') {
      throw new Error(`Dataset file not found: ${datasetId}`);
    } else {
      throw new Error(`Failed to read dataset: ${error.message}`);
    }
  }
};

// 파일 존재 확인 디버깅 엔드포인트
app.get('/api/debug/files', (req, res) => {
  try {
    const dataDir = path.join(__dirname, 'data');
    const files = fs.readdirSync(dataDir);
    const fileInfo = files.map(file => {
      const filePath = path.join(dataDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        path: filePath,
        exists: fs.existsSync(filePath)
      };
    });
    res.json({
      success: true,
      dataDirectory: dataDir,
      files: fileInfo
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      dataDirectory: path.join(__dirname, 'data')
    });
  }
});

// Simple AI insights placeholder (if Gemini API not available)
const generateSimpleInsights = (data) => {
  return `# 📊 분석 완료\n\n## 요약\n- 데이터 업로드 및 처리가 완료되었습니다\n- 피벗 테이블이 생성되었습니다\n- 추가적인 AI 분석을 위해서는 OpenAI API 키가 필요합니다\n\n## 다음 단계\n1. 생성된 피벗 테이블을 확인하세요\n2. 성과 히트맵을 통해 시각적 분석을 수행하세요\n3. 더 자세한 분석을 원하시면 관리자에게 API 설정을 요청하세요\n\n*더 상세한 AI 분석을 위해 OpenAI API를 설정해주세요.*`;
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// AI 인사이트 생성 함수 (수정된 버전)
const generateAIInsights = async (pivotTables, language = 'en') => {
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
      const totalImpressions = tableData.reduce((sum, item) => sum + (parseFloat(item.impressions) || 0), 0);
      const totalClicks = tableData.reduce((sum, item) => sum + (parseFloat(item.clicks) || 0), 0);
      const totalPurchases = tableData.reduce((sum, item) => sum + (parseFloat(item.orders) || 0), 0);
      const totalCost = tableData.reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0);
      const totalRevenue = tableData.reduce((sum, item) => sum + (parseFloat(item.revenue) || 0), 0);
      
      const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : 0;
      const avgCVR = totalClicks > 0 ? (totalPurchases / totalClicks * 100).toFixed(2) : 0;
      const avgCPA = totalPurchases > 0 ? (totalCost / totalPurchases).toFixed(2) : 0;
      const roas = totalCost > 0 ? (totalRevenue / totalCost).toFixed(2) : 0;
      
      // 성과 분포 분석
      const performanceDistribution = tableData.map(item => ({
        name: item[tableName] || 'Unknown',
        impressions: parseFloat(item.impressions) || 0,
        ctr: parseFloat(item.ctr?.replace('%', '')) || 0,
        cvr: parseFloat(item.cvr?.replace('%', '')) || 0,
        cpa: parseFloat(item.cpa) || 0,
        cost: parseFloat(item.cost) || 0,
        revenue: parseFloat(item.revenue) || 0,
        clicks: parseFloat(item.clicks) || 0,
        purchases: parseFloat(item.orders) || 0
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

    const isKorean = language === 'ko';
    const prompt = isKorean ? 
      `당신은 IBM, Microsoft, Oracle, Salesforce와 같은 엔터프라이즈 컨설팅 회사의 분석가들과 유사한 15년 이상의 성과 마케팅 및 데이터 분석 경험을 가진 시니어 디지털 마케팅 분석가입니다.

당신의 임무는 다음 광고 성과 데이터를 분석하고 깊은 마케팅 전문성과 전략적 사고를 보여주는 포괄적이고 엔터프라이즈급 분석 보고서를 제공하는 것입니다.

# 📊 캠페인 성과 데이터

${dataContext}

# 🎯 분석 요구사항

다음 구조로 **한국어** 전문 마케팅 분석 보고서를 작성하세요:

## 실행 요약
- 업계 벤치마크 대비 전체 계정 성과 간략 개요
- 주요 발견사항 및 전략적 권장사항 (최대 2-3문장)

## 성과 분석 프레임워크

### 퍼널 효율성 평가
다음 프레임워크를 사용하여 마케팅 퍼널 성과를 분석하세요:
- **인지 단계** (노출수 & 도달): 볼륨 적절성 및 타겟 오디언스 효과성
- **관심 단계** (CTR): 크리에이티브 공감도 및 오디언스-메시지 적합성
- **고려 단계** (CVR): 랜딩 페이지 정렬 및 오퍼 매력도
- **전환 단계** (CPA & ROAS): 경제적 효율성 및 확장성

### 크리에이티브 성과 분류
성과 패턴에 따라 광고/캠페인을 분류하세요:

**고성과 자산:**
- 높은 볼륨 + 높은 CTR + 높은 CVR = 승리 조합 (즉시 확장)
- 높은 볼륨 + 높은 CTR + 낮은 CVR = 강한 훅, 부족한 랜딩 정렬 (랜딩 페이지 수정)
- 낮은 볼륨 + 높은 CTR + 높은 CVR = 오디언스 너무 좁음 (타겟팅 확장)

**저성과 자산:**
- 높은 볼륨 + 낮은 CTR + 모든 CVR = 부족한 크리에이티브-오디언스 적합성 (크리에이티브 새로고침)
- 모든 볼륨 + 높은 CTR + 낮은 CVR = 랜딩 페이지 불일치 (클릭 후 경험 최적화)
- 낮은 볼륨 + 낮은 CTR + 낮은 CVR = 근본적 불일치 (일시정지 및 재설계)

## 전략적 최적화 프레임워크

### 즉시 조치 (1-2주)
예상 영향과 함께한 구체적인 전술적 움직임:
- 백분율 변화와 함께한 예산 재배치 우선순위
- 근거와 함께한 크리에이티브 새로고침 요구사항
- 근거와 함께한 타겟팅 조정

### 성과 향상 (1-3개월)
측정 가능한 결과와 함께한 전략적 이니셔티브:
- 퍼널 최적화 우선순위
- 개선을 위한 테스팅 로드맵
- 확장 기회 식별

### 포트폴리오 최적화
고급 전략적 권장사항:
- 캠페인/광고 세트 간 리소스 할당
- 성과 패턴 활용
- 저성과자에 대한 리스크 완화

## 데이터 기반 인사이트

### 패턴 인식
- 데이터에서 발견된 성과 상관관계
- 조사가 필요한 예상치 못한 발견사항
- 해당하는 경우 계절적/시간적 패턴

### 경쟁 정보
- 일반적인 업계 벤치마크 대비 성과
- 효율성 격차 및 개선 잠재력
- 시장 포지셔닝 함의

**중요한 가이드라인:**
- C레벨 임원진에게 적합한 컨설팅적이고 전문적인 톤으로 작성
- 모든 권장사항을 뒷받침하기 위해 구체적인 지표와 데이터 포인트 사용
- 예상 비즈니스 영향과 함께 명확하고 실행 가능한 다음 단계 제공
- 기본 데이터 요약보다는 전략적 인사이트에 집중
- 글머리 기호 제한 - 전문성을 보여주는 분석적 산문 사용
- 모든 주장과 권장사항에 수치적 증거 포함` :
      `You are a Senior Digital Marketing Analyst with 15+ years of experience in performance marketing and data analytics, similar to analysts at enterprise consulting firms like IBM, Microsoft, Oracle, and Salesforce. 

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
const generateColumnMapping = async (columns, language = 'en') => {
  if (!process.env.OPENAI_API_KEY) {
    return generateSimpleMapping(columns);
  }
  
  const isKorean = language === 'ko';
  const prompt = isKorean ? 
    `다음 컬럼명들을 표준 마케팅 데이터 컬럼에 매핑해주세요:\n\n입력 컬럼: ${columns.join(', ')}\n표준 컬럼: account_name, account_id, date, campaign_name, campaign_id, ad_pack_name, ad_pack_id, ad_name, ad_id, platform, objective, age, gender, impressions, clicks, link_clicks, cost, reach, views, installs, orders, revenue, engagements, content_views, content_views_all\n\n각 입력 컬럼을 가장 적절한 표준 컬럼에 매핑하고, 확신도(0-1)를 함께 제공해주세요.\n매핑이 어려운 컬럼은 unmapped에 포함시키고, 애매한 경우 suggestions에 대안을 제공해주세요.\n\n다음 JSON 형태로만 응답해주세요 (다른 텍스트 없이):\n{\n  "mapping": {\n    "사용자컬럼": "표준컬럼"\n  },\n  "confidence": {\n    "사용자컬럼": 0.95\n  },\n  "unmapped": ["매핑되지않은컬럼"],\n  "suggestions": {\n    "애매한컬럼": ["대안1", "대안2"]\n  }\n}` :
    `Map the following column names to standard marketing data columns:\n\nInput columns: ${columns.join(', ')}\nStandard columns: account_name, account_id, date, campaign_name, campaign_id, ad_pack_name, ad_pack_id, ad_name, ad_id, platform, objective, age, gender, impressions, clicks, link_clicks, cost, reach, views, installs, orders, revenue, engagements, content_views, content_views_all\n\nMap each input column to the most appropriate standard column and provide confidence (0-1).\nInclude difficult-to-map columns in unmapped and provide alternatives in suggestions for ambiguous cases.\n\nRespond only in the following JSON format (no other text):\n{\n  "mapping": {\n    "user_column": "standard_column"\n  },\n  "confidence": {\n    "user_column": 0.95\n  },\n  "unmapped": ["unmapped_column"],\n  "suggestions": {\n    "ambiguous_column": ["alternative1", "alternative2"]\n  }\n}`;
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
  const standardColumns = [
    'account_name', 'account_id', 'date', 'campaign_name', 'campaign_id', 
    'ad_pack_name', 'ad_pack_id', 'ad_name', 'ad_id', 'platform', 'objective', 
    'age', 'gender', 'impressions', 'clicks', 'link_clicks', 'cost', 'reach', 'views', 
    'installs', 'orders', 'revenue', 'engagements', 'content_views', 'content_views_all'
  ];
  const mapping = {};
  const confidence = {};
  const unmapped = [];
  
  columns.forEach(col => {
    const lowerCol = col.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;
    
    // 간단한 키워드 매칭 - 새로운 컬럼 구조에 맞게 수정
    if (lowerCol.includes('account') && lowerCol.includes('name')) {
      bestMatch = 'account_name';
      bestScore = 0.9;
    } else if (lowerCol.includes('account') && lowerCol.includes('id')) {
      bestMatch = 'account_id';
      bestScore = 0.9;
    } else if (lowerCol.includes('date') || lowerCol.includes('time') || lowerCol.includes('day')) {
      bestMatch = 'date';
      bestScore = 0.8;
    } else if (lowerCol.includes('campaign') && lowerCol.includes('name')) {
      bestMatch = 'campaign_name';
      bestScore = 0.9;
    } else if (lowerCol.includes('campaign') && lowerCol.includes('id')) {
      bestMatch = 'campaign_id';
      bestScore = 0.9;
    } else if (lowerCol.includes('campaign') && !lowerCol.includes('id')) {
      bestMatch = 'campaign_name';
      bestScore = 0.8;
    } else if (lowerCol.includes('adset') || lowerCol.includes('ad set') || lowerCol.includes('ad_set') || lowerCol.includes('ad pack')) {
      bestMatch = 'ad_pack_name';
      bestScore = 0.9;
    } else if (lowerCol.includes('ad') && !lowerCol.includes('adset') && !lowerCol.includes('ad set') && !lowerCol.includes('ad pack')) {
      bestMatch = 'ad_name';
      bestScore = 0.8;
    } else if (lowerCol.includes('platform')) {
      bestMatch = 'platform';
      bestScore = 0.9;
    } else if (lowerCol.includes('objective')) {
      bestMatch = 'objective';
      bestScore = 0.9;
    } else if (lowerCol.includes('age')) {
      bestMatch = 'age';
      bestScore = 0.9;
    } else if (lowerCol.includes('gender')) {
      bestMatch = 'gender';
      bestScore = 0.9;
    } else if (lowerCol.includes('cost') || lowerCol.includes('spend') || lowerCol.includes('amount')) {
      bestMatch = 'cost';
      bestScore = 0.8;
    } else if (lowerCol.includes('impression') || lowerCol.includes('reach') || lowerCol.includes('view')) {
      bestMatch = 'impressions';
      bestScore = 0.8;
    } else if (lowerCol.includes('click')) {
      bestMatch = 'clicks';
      bestScore = 0.9;
    } else if (lowerCol.includes('purchase') || lowerCol.includes('conversion') || lowerCol.includes('order')) {
      bestMatch = 'orders';
      bestScore = 0.8;
    } else if (lowerCol.includes('revenue') || lowerCol.includes('sales') || lowerCol.includes('income')) {
      bestMatch = 'revenue';
      bestScore = 0.8;
    } else if (lowerCol.includes('install')) {
      bestMatch = 'installs';
      bestScore = 0.8;
    } else if (lowerCol.includes('engagement')) {
      bestMatch = 'engagements';
      bestScore = 0.8;
    } else if (lowerCol.includes('content') && lowerCol.includes('view')) {
      bestMatch = 'content_views';
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

  console.log('🔍 generatePivotTables: Input data length:', data.length);
  console.log('🔍 generatePivotTables: Column mapping:', columnMapping);

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

  console.log('🔍 generatePivotTables: Remapped data sample:', remappedData[0]);

  // 새로운 컬럼 구조에 맞게 수정
  const levels = [
    { key: 'campaign_name', display: 'Campaign' },
    { key: 'ad_pack_name', display: 'Ad Set' },
    { key: 'ad_name', display: 'Ad' }
  ];
  
  const results = {};
  
  levels.forEach(level => {
    if (!remappedData[0] || !remappedData[0][level.key]) {
      console.warn(`Column '${level.key}' not found in data, skipping`);
      return; // Skip this level entirely instead of adding empty array
    }

    const grouped = remappedData.reduce((acc, row) => {
      const key = row[level.key] || 'Unknown';
      if (!acc[key]) {
        acc[key] = {
          impressions: 0,
          clicks: 0,
          orders: 0,
          cost: 0,
          revenue: 0
        };
      }
      
      // 새로운 컬럼명에 맞게 수정
      acc[key].impressions += parseFloat(row.impressions || row.Impression || 0);
      acc[key].clicks += parseFloat(row.clicks || row.Click || 0);
      acc[key].orders += parseFloat(row.orders || row.Purchase || 0);
      acc[key].cost += parseFloat(row.cost || row.Cost || 0);
      acc[key].revenue += parseFloat(row.revenue || row.Revenue || 0);
      
      return acc;
    }, {});
    
    const levelData = Object.entries(grouped).map(([name, metrics]) => ({
      [level.display]: name,
      impressions: Math.round(metrics.impressions),
      ctr: metrics.impressions ? (metrics.clicks / metrics.impressions * 100).toFixed(2) + '%' : '0%',
      clicks: Math.round(metrics.clicks),
      orders: Math.round(metrics.orders),
      cvr: metrics.clicks ? (metrics.orders / metrics.clicks * 100).toFixed(2) + '%' : '0%',
      cost: metrics.cost.toFixed(2),
      cpa: metrics.orders ? (metrics.cost / metrics.orders).toFixed(2) : '0',
      revenue: metrics.revenue.toFixed(2)
    })).sort((a, b) => b.impressions - a.impressions);
    
    // Only add to results if there's actual data
    if (levelData.length > 0) {
      results[level.display] = levelData;
      console.log(`✅ Generated pivot table for ${level.display}: ${levelData.length} items`);
    }
  });
  
  console.log('🔍 generatePivotTables: Final results keys:', Object.keys(results));
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
    const { columns, language = 'en' } = req.body;
    
    if (!columns || !Array.isArray(columns)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid columns data' 
      });
    }

    console.log('Generating column mapping for:', columns, 'Language:', language);
    
    const mappingResult = await generateColumnMapping(columns, language);
    
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

// 2.1. 컬럼 그룹화 및 추천 API
app.post('/api/mapping/group-and-recommend', async (req, res) => {
  try {
    const { columns, campaignContext, language = 'en' } = req.body;
    
    if (!columns || !Array.isArray(columns)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid columns data' 
      });
    }

    console.log('🔍 === COLUMN GROUPING AND RECOMMENDATION ===');
    console.log('📊 Input columns:', columns);
    console.log('🎯 Campaign context:', campaignContext);
    console.log('🌐 Language:', language);

    // 1단계: 숫자 제거하여 컬럼 그룹화
    const groupedColumns = groupSimilarColumns(columns);
    
    // 그룹화된 컬럼이 없는 경우 메시지 반환
    if (Object.keys(groupedColumns).length === 0) {
      const isKorean = language === 'ko';
      const message = isKorean 
        ? '그룹화할 수 있는 컬럼이 없어 추천을 제공할 수 없습니다.\n\n예를 들어, "10% 재생률", "20% 재생률", "30% 재생률"과 같이 숫자만 다른 동일한 성격의 컬럼들이 있을 때 그룹화하여 추천해드립니다.'
        : 'No grouping columns available for recommendations.\n\nFor example, this service groups and recommends columns like "10% play rate", "20% play rate", "30% play rate" where only the numbers differ but the column type is the same.';
      
      console.log('🔍 No grouped columns found, returning message:', message);
      
      return res.json({
        success: true,
        groupedColumns: {},
        recommendations: { recommendations: [] },
        message: message
      });
    }
    
    // 2단계: LLM 기반 컬럼 추천
    const recommendations = await generateColumnRecommendations(groupedColumns, campaignContext, language);
    
    console.log('🔍 API Response structure:');
    console.log('  - groupedColumns:', groupedColumns);
    console.log('  - recommendations:', recommendations);
    console.log('  - recommendations type:', typeof recommendations);
    
    res.json({
      success: true,
      groupedColumns,
      recommendations
    });
  } catch (error) {
    console.error('Column grouping and recommendation error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to group columns and generate recommendations',
      details: error.message 
    });
  }
});

// 컬럼 그룹화 함수
const groupSimilarColumns = (columns) => {
  const groups = {};
  
  columns.forEach((column, index) => {
    // 숫자 제거 (예: "Video played to 25%" -> "Video played to %")
    const normalizedColumn = column.replace(/\d+/g, '');
    
    if (!groups[normalizedColumn]) {
      groups[normalizedColumn] = [];
    }
    
    groups[normalizedColumn].push({
      original: column,
      index: index
    });
  });
  
  // 그룹이 2개 이상인 것만 반환
  const result = {};
  Object.entries(groups).forEach(([normalized, items]) => {
    if (items.length > 1) {
      result[normalized] = items;
    }
  });
  
  return result;
};

// LLM 기반 컬럼 추천 함수
const generateColumnRecommendations = async (groupedColumns, campaignContext, language = 'en') => {
  if (!process.env.OPENAI_API_KEY) {
    return generateSimpleColumnRecommendations(groupedColumns);
  }

  try {
    const isKorean = language === 'ko';
    const prompt = isKorean ? 
      `당신은 마케팅 데이터 분석 전문가입니다. 동일한 성격의 컬럼들 중에서 가장 적합한 컬럼을 선택하는 것이 당신의 임무입니다.

캠페인 컨텍스트:
- 브랜드: ${campaignContext?.brand || '알 수 없음'}
- 제품: ${campaignContext?.product || '알 수 없음'}
- 업계: ${campaignContext?.industry || '알 수 없음'}
- 타겟 오디언스: ${campaignContext?.target_audience?.demographics || '알 수 없음'}

분석 규칙:
1. 마케팅 성과 측정의 정확성과 효율성을 고려하세요
2. 해당 브랜드/제품의 특성을 고려하세요
3. 타겟 오디언스의 특성을 고려하세요
4. 업계 표준과 베스트 프랙티스를 고려하세요

각 그룹에서 가장 적합한 컬럼을 선택하고 근거를 제공해주세요.

분석할 컬럼 그룹:
${Object.entries(groupedColumns).map(([normalized, items]) => {
  return `\n그룹: ${normalized}
  컬럼들: ${items.map(item => item.original).join(', ')}`;
}).join('\n')}

다음 JSON 형식으로만 응답해주세요 (다른 텍스트 없이):
{
  "recommendations": [
    {
      "group": "그룹명",
      "recommendedColumn": "추천 컬럼명",
      "reason": "추천 근거 (브랜드/제품 특성을 고려한 상세한 설명)",
      "alternatives": ["대안 컬럼1", "대안 컬럼2"]
    }
  ]
}` :
      `You are a marketing data analysis expert. Your task is to select the most suitable column from columns with similar characteristics.

Campaign Context:
- Brand: ${campaignContext?.brand || 'Unknown'}
- Product: ${campaignContext?.product || 'Unknown'}
- Industry: ${campaignContext?.industry || 'Unknown'}
- Target Audience: ${campaignContext?.target_audience?.demographics || 'Unknown'}

Analysis Rules:
1. Consider accuracy and efficiency of marketing performance measurement
2. Consider the characteristics of the brand/product
3. Consider the characteristics of the target audience
4. Consider industry standards and best practices

Select the most suitable column from each group and provide reasoning.

Column groups to analyze:
${Object.entries(groupedColumns).map(([normalized, items]) => {
  return `\nGroup: ${normalized}
  Columns: ${items.map(item => item.original).join(', ')}`;
}).join('\n')}

Respond only in the following JSON format (no other text):
{
  "recommendations": [
    {
      "group": "group_name",
      "recommendedColumn": "recommended_column_name",
      "reason": "recommendation_reason (detailed explanation considering brand/product characteristics)",
      "alternatives": ["alternative_column1", "alternative_column2"]
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const responseText = completion.choices[0].message.content;
    const cleanText = responseText.replace(/```json\n?|```\n?/g, '').trim();
    
    try {
      const recommendations = JSON.parse(cleanText);
      return recommendations;
    } catch (parseError) {
      console.error('JSON parsing failed for column recommendations:', parseError);
      return generateSimpleColumnRecommendations(groupedColumns);
    }
  } catch (error) {
    console.error('OpenAI API error for column recommendations:', error);
    return generateSimpleColumnRecommendations(groupedColumns);
  }
};

// 간단한 컬럼 추천 fallback
const generateSimpleColumnRecommendations = (groupedColumns) => {
  const recommendations = [];
  
  Object.entries(groupedColumns).forEach(([normalized, items]) => {
    // 간단한 규칙 기반 추천
    let recommendedColumn = items[0].original;
    let reason = "첫 번째 컬럼을 기본값으로 선택했습니다.";
    
    // 특정 패턴에 따른 추천
    const columnNames = items.map(item => item.original);
    
    // Video 관련: 100% 완료를 선호
    if (normalized.includes('Video') && columnNames.some(col => col.includes('100%'))) {
      recommendedColumn = columnNames.find(col => col.includes('100%')) || recommendedColumn;
      reason = "비디오 완료율 측정에서는 100% 완료 지표가 가장 의미있는 성과 지표입니다.";
    }
    
    // Conversion 관련: 짧은 기간을 선호
    if (normalized.includes('conversion') || normalized.includes('Conversion')) {
      const shortestPeriod = columnNames
        .filter(col => /\d+/.test(col))
        .sort((a, b) => {
          const aNum = parseInt(a.match(/\d+/)[0]);
          const bNum = parseInt(b.match(/\d+/)[0]);
          return aNum - bNum;
        })[0];
      
      if (shortestPeriod) {
        recommendedColumn = shortestPeriod;
        reason = "전환율 측정에서는 짧은 기간의 지표가 더 즉각적인 성과를 반영합니다.";
      }
    }
    
    recommendations.push({
      group: normalized,
      recommendedColumn,
      reason,
      alternatives: items.map(item => item.original).filter(col => col !== recommendedColumn)
    });
  });
  
  return { recommendations };
};

// 2.5. 캠페인 분석 API
app.post('/api/analysis/campaigns', async (req, res) => {
  try {
    const { fileId, columnMapping, language = 'en' } = req.body;
    
    if (!fileId || !columnMapping) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing fileId or columnMapping' 
      });
    }

    console.log('🔍 === CAMPAIGN ANALYSIS API HIT ===');
    console.log('📁 File ID:', fileId);
    console.log('🗺️ Column Mapping:', columnMapping);
    console.log('🌐 Language:', language);

    // 파일 데이터 조회
    let fileData = fileStorage.get(fileId);
    
    // 데이터셋인 경우 처리
    if (fileId.startsWith('dataset_')) {
      const datasetId = fileId.replace('dataset_', '');
      console.log('📊 Processing dataset for campaign analysis:', datasetId);
      
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
      console.error('❌ File data not found for campaign analysis:', fileId);
      return res.status(404).json({ 
        success: false, 
        error: 'File data not found or expired' 
      });
    }

    console.log('✅ File data found for campaign analysis:', {
      fileName: fileData.metadata.fileName,
      rowCount: fileData.data.length
    });

    // 캠페인 분석 실행
    const campaignAnalysis = await analyzeCampaigns(fileData, columnMapping, language);
    
    if (!campaignAnalysis.success) {
      return res.status(500).json(campaignAnalysis);
    }

    res.json({
      success: true,
      ...campaignAnalysis
    });

  } catch (error) {
    console.error('Campaign analysis error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to analyze campaigns',
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
    const { fileId, columnMapping, language = 'en' } = req.body;
    
    console.log('📥 === REQUEST BODY PARSED ===');
    console.log('👤 User ID:', userId);
    console.log('📁 File ID:', fileId);
    console.log('🗺️ Column Mapping:', columnMapping);
    console.log('🌐 Language:', language);
    
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
          language: language, // <-- top-level language field for easier querying
          metadata: {
            rowCount: fileData.data.length,
            columns: Object.keys(columnMapping),
            columnMapping,
            language: language, // <-- always save language in metadata
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
        processedAt: new Date().toISOString(),
        language: language // <-- always return language in metadata
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
    const { analysisId, pivotTables, language = 'en' } = req.body;
    
    console.log('📥 === REQUEST BODY PARSED ===');
    console.log('👤 User ID:', userId);
    console.log('📊 Analysis ID:', analysisId);
    console.log('🌐 Language:', language);
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
    const insights = await generateAIInsights(pivotTables, language);
    
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
            'metadata.language': language,
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
    const insights = await generateAIInsights(pivotData, 'en'); // Default to English for file uploads

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
          language: 'en', // <-- top-level language field for easier querying
          metadata: {
            rowCount: rawData.length,
            columns: Object.keys(rawData[0] || {}),
            fileType: fileExtension.slice(1),
            language: 'en' // <-- always save language in metadata
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
      .select('_id fileName fileSize createdAt updatedAt status metadata.language language');

    res.json({
      success: true,
      analyses: analyses.map(analysis => ({
        _id: analysis._id,
        fileName: analysis.fileName,
        fileSize: analysis.fileSize,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt,
        status: analysis.status,
        language: analysis.metadata?.language || analysis.language || null // always return language
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
    const { datasetId, language = 'en' } = req.body;
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

    console.log(`[DATASET PROCESS] User ${userId} selected dataset: ${datasetId}`);
    
    // ParquetConverter를 사용하여 데이터 읽기
    const dataDirectory = path.join(__dirname, 'data');
    const converter = new ParquetConverter(dataDirectory);
    
    const datasetInfo = await readParquetDataset(datasetId);
    const { rows, columns } = datasetInfo;
    
    if (!columns.length) {
      return res.status(400).json({
        success: false,
        error: 'No columns found in dataset'
      });
    }
    
    // 컬럼 매핑 추천
    let mappingResult;
    try {
      mappingResult = await generateColumnMapping(columns, language);
    } catch (err) {
      mappingResult = generateSimpleMapping(columns);
    }
    
    res.json({
      success: true,
      datasetId,
      datasetName: converter.getDatasetName(datasetId),
      columns,
      data: rows.slice(0, 5), // 미리보기용 5행만 전송
      ...mappingResult,
      fileId: `dataset_${datasetId}`,
      rowCount: rows.length,
      metadata: {
        processedAt: new Date().toISOString(),
        source: 'parquet_converted',
        language: language
      }
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
      spend: 'cost',
      impressions: 'impressions',
      clicks: 'clicks',
      ctr: 'ctr',
      cpc: 'cpc',
      cpm: 'cpm',
      budget: 'budget',
      status: 'campaign_status'
    },
    'adpack_data': {
      campaign: 'campaign_name',
      adpack_id: 'ad_pack_id',
      ad_name: 'ad_name',
      spend: 'cost',
      impressions: 'impressions',
      clicks: 'clicks',
      ctr: 'ctr',
      cpc: 'cpc',
      cpm: 'cpm',
      conversions: 'orders',
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

// Campaign analysis with LLM
const analyzeCampaigns = async (fileData, columnMapping, language = 'en') => {
  if (!process.env.OPENAI_API_KEY) {
    return {
      success: false,
      error: 'OpenAI API 키가 설정되지 않았습니다'
    };
  }

  try {
    // 1단계: 캠페인 컬럼 찾기 (매핑이 없으면 유추)
    let campaignColumn = Object.keys(columnMapping).find(key => 
      columnMapping[key] === 'campaign_name'
    );

    // 매핑이 없으면 컬럼명으로 유추
    if (!campaignColumn) {
      const allColumns = Object.keys(fileData.data[0] || {});
      campaignColumn = allColumns.find(col => {
        const lowerCol = col.toLowerCase();
        return lowerCol.includes('campaign') || 
               lowerCol.includes('camp') || 
               lowerCol.includes('캠페인') ||
               lowerCol.includes('광고') ||
               lowerCol.includes('ad');
      });
    }

    if (!campaignColumn) {
      return {
        success: false,
        error: '데이터에서 캠페인 컬럼을 찾을 수 없습니다'
      };
    }

    console.log(`🔍 Found campaign column: ${campaignColumn}`);

    // 2단계: 유니크한 캠페인명 추출 및 전처리
    const rawCampaignNames = fileData.data
      .map(row => row[campaignColumn])
      .filter(name => name && name.toString().trim() !== '');

    // 전처리 함수
    const preprocessCampaignNames = (names) => {
      const processed = [];
      
      names.forEach(name => {
        // "_" 단위로 분할
        const parts = name.toString().split('_');
        
        parts.forEach(part => {
          // 공백 제거
          let cleaned = part.trim();
          
          // "["와 "]"로 둘러싸인 부분 제거
          cleaned = cleaned.replace(/\[.*?\]/g, '');
          
          // 숫자로만 이루어진 것 제거
          if (/^\d+$/.test(cleaned)) {
            return;
          }
          
          // 1월~12월 제거
          cleaned = cleaned.replace(/[1-9]월|10월|11월|12월/g, '');
          
          // 특수문자만 포함된 것 제거
          if (/^[^a-zA-Z가-힣0-9]+$/.test(cleaned)) {
            return;
          }
          
          // "디맨드젠" 제거
          if (cleaned.includes('디맨드젠')) {
            return;
          }
          
          // "테스트" 포함된 것 제거
          if (cleaned.includes('테스트')) {
            return;
          }
          
          // "남성/여성", "남성", "여성"만 있는 것 제거
          if (cleaned === '남성/여성' || cleaned === '남성' || cleaned === '여성') {
            return;
          }
          
          // 1. "키워드"가 포함되어 있으면 키워드라는 말을 지우고 strip()
          if (cleaned.includes('키워드')) {
            cleaned = cleaned.replace(/키워드/g, '').trim();
          }
          
          // 2. 마케팅 용어 제거
          const marketingTerms = ['CEQ', 'tCPA', 'CTA', 'CPC', 'CPM', 'ROAS', 'CTR', 'CVR'];
          let hasMarketingTerm = false;
          marketingTerms.forEach(term => {
            if (cleaned === term) {
              hasMarketingTerm = true;
            } else if (cleaned.includes(term)) {
              cleaned = cleaned.replace(new RegExp(term, 'g'), '');
            }
          });
          
          // 마케팅 용어로만 이루어진 경우 제거
          if (hasMarketingTerm) {
            return;
          }
          
          // 3. "영상", "배너"만 포함하고 있으면 삭제
          if (cleaned === '영상' || cleaned === '배너') {
            return;
          }
          
          // 4. "지역", "타게팅" 제거
          cleaned = cleaned.replace(/지역/g, '').replace(/타게팅/g, '').trim();
          
          // 새로운 전처리 단계들 추가
          
          // 1. "동영상", "사진", "랜딩변경"이라는 글자 없애기
          cleaned = cleaned.replace(/동영상|사진|랜딩변경/g, '').trim();
          
          // 2. 숫자 또는 공백 또는 괄호로만 이루어진 element 삭제
          if (/^[\d\s\(\)]+$/.test(cleaned)) {
            return;
          }
          
          // 3. ">"가 2개 이상 등장하는 경우에는 첫 번째 ">" 앞의 글자들만 남기기
          const gtCount = (cleaned.match(/>/g) || []).length;
          if (gtCount >= 2) {
            const firstGtIndex = cleaned.indexOf('>');
            if (firstGtIndex !== -1) {
              cleaned = cleaned.substring(0, firstGtIndex).trim();
            }
          }
          
          // 빈 문자열이 아니면 추가
          if (cleaned.trim() !== '') {
            processed.push(cleaned.trim());
          }
        });
      });
      
      // 유니크 처리
      return [...new Set(processed)];
    };

    const processedCampaignNames = preprocessCampaignNames(rawCampaignNames);

    if (processedCampaignNames.length === 0) {
      return {
        success: false,
        error: '전처리 후 유효한 캠페인명을 찾을 수 없습니다'
      };
    }

    console.log(`🔍 Raw campaign names:`, rawCampaignNames);
    console.log(`🔍 Processed campaign names:`, processedCampaignNames);
    console.log(`🔍 Analyzing ${processedCampaignNames.length} processed terms to identify single brand/product:`, processedCampaignNames);

    const isKorean = language === 'ko';
    const prompt = isKorean ? 
      `당신은 현재 정보에 접근할 수 있는 마케팅 데이터 분석가입니다. 처리된 캠페인 용어 목록에서 단일 브랜드와 제품을 식별하는 것이 당신의 임무입니다.

중요: 이 파일에는 하나의 브랜드와 하나의 제품에 대한 캠페인만 포함되어 있습니다. 아래 용어들은 마케팅 전문용어와 일반적인 용어를 제거하여 전처리되었습니다.

분석 규칙:
- 당신의 지식을 사용하여 실제 존재하는 회사와 브랜드를 검색하세요
- 모든 용어에서 패턴을 찾아 단일 브랜드를 식별하세요
- 광고되고 있는 단일 제품/서비스를 식별하세요
- 웹 검색 지식을 사용하여 회사가 존재하는지 확인하세요
- 한국/아시아 회사의 경우 가능하면 영어 브랜드명을 제공하세요
- 특정 브랜드를 식별할 수 없는 경우, 남은 용어를 기반으로 업계/카테고리를 추론하세요

타겟 오디언스 분석 시 고려사항:
- "최저가도전", "할인", "특가", "프로모션" 등의 가격 관련 키워드가 있다면 가격 민감한 소비자층을 고려하세요
- "부산", "서울", "미국", "대한민국" 등의 지역명이 있다면 해당 지역의 소비자 특성을 반영하세요
- 지역명과 함께 나타나는 키워드들을 종합하여 지역별 소비 패턴을 분석하세요

검색 요구사항:
- 언급된 회사의 존재를 적극적으로 검색하고 확인하세요
- 현재 회사와 브랜드에 대한 지식을 사용하세요
- 한국 브랜드의 경우 영어 동등어를 검색하세요
- 철저하게 검색하세요 - 이 용어들은 실제 회사를 나타낼 가능성이 높습니다

예시:
- 용어: ["나이키", "Nike", "브랜드"] 
  → 검색: "Nike" (글로벌 스포츠웨어 브랜드) → 단일 브랜드: "Nike", 단일 제품: "스포츠웨어"

분석할 처리된 캠페인 용어:
${processedCampaignNames.map((name, index) => `${index + 1}. ${name}`).join('\n')}

다음 JSON 형식으로만 분석을 제공하세요 (다른 텍스트 없이):
{
  "brand": "식별된 단일 브랜드명 또는 '알 수 없는 브랜드'",
  "product": "식별된 구체적인 제품명 (예: '피부 진정 크림', '미백 에센스', '보습 로션' 등)",
  "industry": "업계 카테고리",
  "target_audience": {
    "demographics": "연령대와 성별 (예: '20-40대 여성', '30-50대 남성')",
    "characteristics": "아주 구체적인 소비자 특징 (가격 민감도, 지역 특성, 라이프스타일 등 포함)",
  },
  "confidence": 0.9,
  "description": "브랜드와 제품에 대한 간결하지만 상세한 설명 (2-3문장)",
  "analysis_reason": "타겟 오디언스 분석 근거 (브랜드 특성과 제품 특성을 고려한 상세한 설명, 가격 정책과 지역 특성 포함)",
  "total_campaigns": ${rawCampaignNames.length}
}` :
      `You are a marketing data analyst with access to current information. Your task is to identify a single brand and product from the processed campaign terms list.

Important: This file contains campaigns for only one brand and one product. The terms below have been preprocessed to remove marketing jargon and common terms.

Analysis Rules:
- Use your knowledge to search for and identify actual existing companies and brands
- Find patterns across all terms to identify a single brand
- Identify the single product/service being advertised
- Use web search knowledge to verify if companies exist
- For Korean/Asian companies, provide English brand names when possible
- If a specific brand cannot be identified, infer the industry/category based on remaining terms

Target Audience Analysis Considerations:
- If price-related keywords like "lowest price challenge", "discount", "special offer", "promotion" are present, consider price-sensitive consumers
- If location names like "Busan", "Seoul", "USA", "Korea" are present, reflect the consumer characteristics of that region
- Synthesize keywords that appear with location names to analyze regional consumption patterns

Search Requirements:
- Actively search for and verify the existence of mentioned companies
- Use current knowledge about companies and brands
- For Korean brands, search for English equivalents
- Search thoroughly - these terms are likely to represent actual companies

Example:
- Terms: ["Nike", "Nike", "Brand"] 
  → Search: "Nike" (global sportswear brand) → Single brand: "Nike", Single product: "Sportswear"

Processed campaign terms to analyze:
${processedCampaignNames.map((name, index) => `${index + 1}. ${name}`).join('\n')}

Provide analysis only in the following JSON format (no other text):
{
  "brand": "identified single brand name or 'Unknown Brand'",
  "product": "identified specific product name (e.g., 'Skin Soothing Cream', 'Whitening Essence', 'Moisturizing Lotion', etc.)",
  "industry": "industry category",
  "target_audience": {
    "demographics": "age group and gender (e.g., 'Women in their 20s-40s', 'Men in their 30s-50s')",
    "characteristics": "very specific consumer characteristics (including price sensitivity, regional characteristics, lifestyle, etc.)",
  },
  "confidence": 0.9,
  "description": "concise but detailed description of the brand and product (2-3 sentences)",
  "analysis_reason": "target audience analysis reasoning (detailed explanation considering brand and product characteristics, including pricing policy and regional characteristics)",
  "total_campaigns": ${rawCampaignNames.length}
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: isKorean ? 
            "당신은 글로벌 브랜드와 회사에 대한 광범위한 지식을 가진 마케팅 데이터 분석가입니다. 현재 정보에 접근할 수 있고 실제 회사를 검색할 수 있습니다. 당신의 임무는 제공된 용어에서 실제 브랜드와 제품을 적극적으로 검색하고 식별하는 것입니다. 이 용어들은 전처리되었으며 실제 회사명이나 제품을 나타낼 가능성이 높습니다. 회사가 존재하는지 확인하기 위해 검색 기능을 사용하세요, 특히 한국과 아시아 브랜드의 경우. 가능하면 항상 영어 브랜드명을 제공하세요. 철저하게 검색하세요 - 이들은 식별 가능해야 하는 실제 회사일 가능성이 높습니다." :
            "You are a marketing data analyst with extensive knowledge of global brands and companies. You have access to current information and can search for actual companies. Your task is to actively search for and identify actual brands and products from the provided terms. These terms have been preprocessed and are likely to represent actual company names or products. Use search functionality to verify if companies exist, especially for Korean and Asian brands. Always provide English brand names when possible. Search thoroughly - these are likely to be actual companies that should be identifiable."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 3000,
      temperature: 0.3, // Slightly higher temperature for better inference
    });

    const responseText = completion.choices[0].message.content;
    
    console.log('🤖 Raw LLM response:', responseText);
    
    // Clean and parse JSON response
    const cleanText = responseText.replace(/```json\n?|```\n?/g, '').trim();
    let analysisResult;
    
    try {
      analysisResult = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('❌ JSON parsing failed:', parseError);
      console.error('❌ Clean text:', cleanText);
      
      // Fallback: create basic analysis
      analysisResult = {
        brand: "알 수 없는 브랜드",
        product: "일반 캠페인",
        industry: "알 수 없음",
        target_audience: {
          demographics: "일반 소비자",
          characteristics: "해당 제품/서비스에 관심이 있는 고객",
          lifestyle: "일반적인 소비 패턴"
        },
        confidence: 0.5,
        description: "캠페인명에서 특정 브랜드와 제품을 식별할 수 없습니다.",
        analysis_reason: "브랜드 정보가 충분하지 않아 일반적인 타겟 오디언스로 분석되었습니다.",
        total_campaigns: rawCampaignNames.length
      };
    }

    // Validate and clean up the analysis
    if (!analysisResult.brand || !analysisResult.product) {
      console.error('❌ 잘못된 분석 구조');
      throw new Error('LLM에서 잘못된 분석 구조가 반환되었습니다');
    }

    console.log('✅ Campaign analysis completed:', {
      brand: analysisResult.brand,
      product: analysisResult.product,
      industry: analysisResult.industry,
      confidence: analysisResult.confidence,
      totalCampaigns: analysisResult.total_campaigns
    });

    return {
      success: true,
      ...analysisResult
    };

  } catch (error) {
    console.error('❌ Campaign analysis failed:', error);
    return {
      success: false,
      error: '캠페인 분석에 실패했습니다',
      details: error.message
    };
  }
};

module.exports = app;
