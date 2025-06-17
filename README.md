# Marketing Data Analyzer with AI Insights

이 프로젝트는 마케팅 성과 데이터를 분석하고 AI 기반 인사이트를 제공하는 웹 애플리케이션입니다.

## 🆕 새로운 기능 (2024년 6월 업데이트)

### 🔗 지능형 컬럼 매핑
- **자동 컬럼 매핑**: Gemini AI가 업로드된 파일의 컬럼명을 자동으로 분석하여 표준 마케팅 컬럼에 매핑
- **다양한 형태 지원**: 한국어, 영어, 페이스북 광고 매니저, 구글 광고 등 다양한 형태의 컬럼명 지원
- **매핑 확인 모달**: 사용자가 매핑 결과를 확인하고 수정할 수 있는 직관적인 인터페이스
- **신뢰도 점수**: 각 매핑에 대한 AI의 확신도를 표시하여 정확성 향상

### 📊 개선된 분석 플로우
1. **파일 업로드**: CSV, Excel 파일 업로드 및 컬럼 추출
2. **컬럼 매핑**: AI 기반 자동 매핑 및 사용자 확인
3. **분석 실행**: 피벗 테이블 생성, 히트맵 시각화, AI 리포트 생성

### 🎯 표준 컬럼 구조
- **Date**: 날짜/시간 정보
- **Campaign**: 캠페인명
- **Ad Set**: 광고세트/광고그룹
- **Ad**: 광고명/크리에이티브
- **Cost**: 비용/지출
- **Impression**: 노출수
- **Click**: 클릭수
- **Purchase**: 구매/전환수
- **Revenue**: 매출/전환가치

## 🔧 기술 스택

### Frontend
- **React 18** - 사용자 인터페이스
- **React Router** - 라우팅
- **Clerk** - 사용자 인증
- **Custom CSS** - 스타일링 (Tailwind-like utilities)

### Backend  
- **Node.js** + **Express** - 서버
- **MongoDB** - 데이터베이스
- **Multer** - 파일 업로드
- **PapaParse** - CSV 파싱
- **XLSX** - Excel 파일 처리
- **Gemini AI** - 컬럼 매핑 및 인사이트 생성

## 🚀 설치 및 실행

### 1. 저장소 클론
```bash
git clone <repository-url>
cd pivot-dashboard
```

### 2. 의존성 설치
```bash
npm run install:all
```

### 3. 환경변수 설정

#### 백엔드 (.env)
```bash
# 백엔드 포트
PORT=3001
NODE_ENV=development

# MongoDB Atlas 연결
MONGODB_URI=your_mongodb_connection_string

# Clerk 인증
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# AI 서비스
GEMINI_API_KEY=your_gemini_api_key

# 파일 업로드 설정
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=csv,xlsx,xls
```

#### 프론트엔드 (.env)
```bash
REACT_APP_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
REACT_APP_API_URL=http://localhost:3001
```

### 4. 서버 실행
```bash
# 개발 모드 (백엔드 + 프론트엔드 동시 실행)
npm run dev

# 또는 개별 실행
npm run backend:dev  # 백엔드만
npm start           # 프론트엔드만
```

## 📁 샘플 데이터

`sample-data/` 폴더에 다양한 형태의 테스트 데이터가 준비되어 있습니다:

- `marketing_test_data.csv` - 영어 표준 컬럼명
- `marketing_korean_columns.csv` - 한국어 컬럼명  
- `facebook_ads_format.csv` - 페이스북 광고 매니저 형태
- `google_ads_format.csv` - 구글 광고 형태

## 🧪 테스트 방법

1. 애플리케이션 실행 후 `/analysis` 페이지로 이동
2. 샘플 데이터 중 하나를 업로드
3. 컬럼 매핑 결과 확인 및 수정
4. 분석 실행 후 결과 확인

## 🎯 주요 기능

### 컬럼 매핑
- Gemini AI가 다양한 언어와 형태의 컬럼명을 자동 인식
- 확신도 기반 매핑 결과 제공
- 사용자 친화적인 매핑 확인 및 수정 인터페이스

### 데이터 분석
- Campaign, Ad Set, Ad 레벨별 피벗 테이블 자동 생성
- CTR, CVR, CPA 등 주요 마케팅 지표 계산
- 성과 기반 정렬 및 시각화

### AI 인사이트
- 크리에이티브 성과 분석 (CTR vs CVR)
- 핵심 인사이트 및 개선 방안 제시
- 예산 재배분 및 최적화 제안

## 🔧 개발자 가이드

### API 엔드포인트

#### 파일 업로드 및 컬럼 추출
```
POST /api/upload/extract-columns
```

#### 컬럼 매핑 제안
```
POST /api/mapping/suggest
Body: { "columns": ["컬럼1", "컬럼2", ...] }
```

#### 분석 실행
```
POST /api/analysis/execute
Body: { 
  "fileId": "file_id", 
  "columnMapping": { "원본컬럼": "표준컬럼" } 
}
```

### 컴포넌트 구조
```
src/
├── pages/
│   └── Analysis.js              # 메인 분석 페이지
├── components/
│   ├── ColumnMappingModal.js    # 컬럼 매핑 모달
│   └── Common/
│       └── FileUpload.js        # 파일 업로드 컴포넌트
└── ...
```

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다.

## 🆘 문제 해결

### 일반적인 문제들

**1. Gemini API 오류**
- API 키가 올바르게 설정되었는지 확인
- API 할당량 및 요청 제한 확인

**2. MongoDB 연결 오류**
- MongoDB Atlas 연결 문자열 확인
- 네트워크 접근 허용 설정 확인

**3. 파일 업로드 실패**
- 파일 크기 제한 (10MB) 확인
- 지원 파일 형식 (CSV, XLSX, XLS) 확인

**4. 컬럼 매핑 실패**
- 파일에 헤더 행이 있는지 확인
- 빈 컬럼이나 특수 문자 확인

## 📞 지원

문제나 질문이 있으시면 GitHub Issues를 통해 문의해주세요.
