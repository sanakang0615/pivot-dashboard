// Get dataset info based on dataset ID
export const getDatasetInfo = (datasetId) => {
  const datasetConfigs = {
    'campaign_data': {
      id: 'campaign_data',
      name: 'Campaign Data',
      description: 'Campaign level data (Publisher: Meta)',
      icon: '📊',
      expectedColumns: [
        'campaign_id', 'campaign_name', 'campaign_status', 'budget', 
        'spend', 'impressions', 'clicks', 'link_clicks', 'ctr', 'cpc', 'cpm'
      ]
    },
    'adpack_data': {
      id: 'adpack_data',
      name: 'AdPack Data',
      description: 'Ad pack level data (Campaign ID based mapping)',
      icon: '📈',
      expectedColumns: [
        'adpack_id', 'campaign_id', 'ad_name', 'ad_status', 
        'spend', 'impressions', 'clicks', 'link_clicks', 'ctr', 'cpc', 'cpm', 'orders'
      ]
    }
  };

  // 디버깅용 콘솔로그 추가
  const config = datasetConfigs[datasetId] || null;
  //console.log('[getDatasetInfo] datasetId:', datasetId, '| config:', config);
  // NOTE: 실제 데이터 파일 경로는 프론트가 아니라 백엔드에서 관리합니다.
  // 프론트의 이 config는 단순히 UI 표시용입니다.
  return config;
}; 