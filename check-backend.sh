#!/bin/bash

echo "🔍 백엔드 서버 상태 체크..."

# 1. 포트 3001 확인
echo "1. 포트 3001 체크:"
lsof -i :3001 || echo "❌ 포트 3001에 실행 중인 프로세스 없음"

# 2. 헬스체크 API 테스트
echo -e "\n2. 헬스체크 API 테스트:"
curl -s http://localhost:3001/health || echo "❌ 헬스체크 API 연결 실패"

# 3. 컬럼 추출 API 테스트
echo -e "\n3. 컬럼 추출 API 테스트:"
curl -s -I http://localhost:3001/api/upload/extract-columns || echo "❌ 컬럼 추출 API 연결 실패"

echo -e "\n✅ 체크 완료"