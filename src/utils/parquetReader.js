import { readParquet } from 'parquet-wasm';

export const readParquetFile = async (filePath) => {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to fetch parquet file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const parquetData = readParquet(arrayBuffer);
    
    return {
      success: true,
      data: parquetData,
      columns: parquetData.schema.map(col => col.name),
      rowCount: parquetData.rowGroups[0]?.numRows || 0
    };
  } catch (error) {
    console.error('Error reading parquet file:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const extractColumnsFromParquet = async (arrayBuffer) => {
  try {
    const parquetData = readParquet(arrayBuffer);
    return parquetData.schema.map(col => col.name);
  } catch (error) {
    console.error('Error extracting columns from parquet:', error);
    // Fallback to mock data if parquet parsing fails
    return getMockColumns();
  }
};

// Mock columns for fallback
const getMockColumns = () => {
  return [
    'campaign_id', 'campaign_name', 'campaign_status', 'budget', 
    'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm'
  ];
};

// Get dataset info based on dataset ID
export const getDatasetInfo = (datasetId) => {
  const datasetConfigs = {
    'campaign_data': {
      id: 'campaign_data',
      name: 'Campaign Data',
      description: 'Campaign level data (Publisher: Meta)',
      file: '/db/campaign_data.parquet',
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
      file: '/db/adpack_data.parquet',
      icon: '📈',
      expectedColumns: [
        'adpack_id', 'campaign_id', 'ad_name', 'ad_status', 
        'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'conversions'
      ]
    }
  };

  return datasetConfigs[datasetId] || null;
}; 