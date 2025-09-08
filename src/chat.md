
# Chat 관련 파일 정리

## Frontend

### 1. 핵심 컴포넌트

#### src/components/Analysis/AnalysisPage.js
Chat with AI 버튼이 위치한 메인 분석 페이지
- 기능: 채팅 사이드바 토글
- 키보드 단축키: Cmd/Ctrl + I

```javascript
<button onClick={() => setChatSidebarOpen(true)}>
  <MessageCircle size={16} />
  Chat with AI
</button>
```

#### src/components/Chat/ChatSidebar.js
메인 채팅 사이드바 컴포넌트
- Chat with AI 버튼 클릭 시 열리는 채팅 인터페이스

#### src/components/Chat/ChatMessage.js
개별 채팅 메시지 렌더링 컴포넌트


#### src/components/Chat/ContextSelector.js
데이터 컨텍스트 선택 컴포넌트 (@ 버튼으로 호출되는 컨텍스트 선택기)

### 2. 스타일링

#### src/styles/chat.css
채팅 전용 CSS 파일

## Backend 파일들

### 1. 데이터 모델

#### backend/models/Chat.js
MongoDB 채팅 스키마 정의
- 사용자별/분석별 채팅 히스토리 저장
- 메시지 타입: user, ai, error
- 컨텍스트 데이터 포함

스키마 구조:
```javascript
{
  userId: String,
  analysisId: String,
  messages: [{
    id: String,
    type: String, // 'user', 'ai', 'error'
    content: String,
    contexts: [Object],
    timestamp: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### 2. API 엔드포인트 (backend/server.js)

#### POST /api/chat/send
메시지 전송 및 AI 응답 생성
- OpenAI API 호출
- 컨텍스트 데이터 포함
- 채팅 히스토리 고려

#### GET /api/chat/:analysisId
특정 분석의 채팅 히스토리 로드
- 사용자별 접근 제어
- 메시지 목록 반환

#### POST /api/chat/:analysisId
채팅 히스토리 저장
- 실시간 메시지 저장
- MongoDB 업데이트

#### DELETE /api/chat/:analysisId
채팅 히스토리 삭제
- 분석별 채팅 데이터 제거

#### GET /api/chat/recent
사용자의 최근 채팅 목록 (미래 기능)
- 대시보드용 최근 채팅 표시

## 연결 파일들

### 설정 및 유틸리티

#### src/utils/config.js
API 엔드포인트 설정

#### src/contexts/LanguageContext.js
다국어 지원 컨텍스트
- 채팅 인터페이스 언어 설정

## 동작 플로우

1. AnalysisPage에서 "Chat with AI" 버튼 클릭
2. ChatSidebar가 열리며 채팅 히스토리 로드
3. 사용자가 메시지 입력 (선택적으로 @ 버튼으로 컨텍스트 추가)
4. POST /api/chat/send로 메시지 전송
5. OpenAI API 응답 후 ChatMessage로 표시
6. POST /api/chat/:analysisId로 채팅 히스토리 저장