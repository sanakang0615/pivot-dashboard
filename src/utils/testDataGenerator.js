const generateTestData = (numberOfRows = 100) => {
  const campaigns = [
    'Holiday Sale 2024', 'Black Friday Campaign', 'Winter Collection', 
    'New Year Promo', 'Valentine Campaign', 'Spring Sale', 'Summer Preview',
    'Easter Promo', 'Mother\'s Day', 'Summer Sale', 'Back to School',
    'Fall Collection', 'Halloween Special', 'Thanksgiving Deal'
  ];

  const adGroups = [
    'Electronics', 'Fashion', 'Home & Garden', 'Beauty', 'Sports',
    'Books', 'Toys', 'Automotive', 'Health', 'Travel',
    'Food & Beverage', 'Jewelry', 'Art & Crafts', 'Pet Supplies'
  ];

  const creativeTypes = [
    'Video Ad', 'Static Ad', 'Carousel Ad', 'Collection Ad', 'Story Ad',
    'Banner Ad', 'Native Ad', 'Retargeting Ad', 'Dynamic Ad', 'Shopping Ad'
  ];

  const creativeMessages = [
    'Best Deals', 'Limited Time', 'Free Shipping', 'Save 50%', 'New Arrivals',
    'Trending Now', 'Flash Sale', 'Members Only', 'Exclusive Offer', 'Last Chance'
  ];

  const data = [];
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-12-31');

  for (let i = 0; i < numberOfRows; i++) {
    // Random date between start and end
    const randomDate = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
    
    // Base metrics with realistic correlations
    const baseImpressions = Math.floor(Math.random() * 100000) + 10000;
    const ctrMultiplier = 0.5 + Math.random() * 8; // 0.5% to 8.5% CTR range
    const clicks = Math.floor(baseImpressions * (ctrMultiplier / 100));
    const cvrMultiplier = 0.5 + Math.random() * 6; // 0.5% to 6.5% CVR range
    const conversions = Math.floor(clicks * (cvrMultiplier / 100));
    
    // Spend correlates with impressions but has some variance
    const cpmBase = 2 + Math.random() * 8; // $2-10 CPM
    const spend = Math.floor((baseImpressions / 1000) * cpmBase);

    const row = {
      Campaign: campaigns[Math.floor(Math.random() * campaigns.length)],
      'Ad Group': adGroups[Math.floor(Math.random() * adGroups.length)],
      Creative: `${creativeTypes[Math.floor(Math.random() * creativeTypes.length)]} - ${creativeMessages[Math.floor(Math.random() * creativeMessages.length)]}`,
      Spend: spend,
      Impressions: baseImpressions,
      Clicks: clicks,
      Conversions: conversions,
      Date: randomDate.toISOString().split('T')[0]
    };

    data.push(row);
  }

  return data;
};

const convertToCSV = (data) => {
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => row[header]).join(','))
  ].join('\n');
  
  return csvContent;
};

const generateAndSaveTestData = (filename = 'test_campaign_data', rows = 100) => {
  const data = generateTestData(rows);
  const csv = convertToCSV(data);
  
  // In a Node.js environment, you would save to file:
  // const fs = require('fs');
  // fs.writeFileSync(`${filename}.csv`, csv);
  
  // For browser environment, create downloadable file:
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  return data;
};

// Export functions for use in components
window.generateTestData = generateTestData;
window.generateAndSaveTestData = generateAndSaveTestData;

module.exports = {
  generateTestData,
  convertToCSV,
  generateAndSaveTestData
};
