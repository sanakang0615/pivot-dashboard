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
        'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm'
      ]
    },
    'adpack_data': {
      id: 'adpack_data',
      name: 'AdPack Data',
      description: 'Ad pack level data (Campaign ID based mapping)',
      icon: '📈',
      expectedColumns: [
        'adpack_id', 'campaign_id', 'ad_name', 'ad_status', 
        'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'conversions'
      ]
    }
  };

  return datasetConfigs[datasetId] || null;
}; 