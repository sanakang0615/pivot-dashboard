const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Marketing analysis prompt template
const MARKETING_ANALYSIS_PROMPT = `You are a performance marketing data analysis assistant. The input CSV may have columns similar to 'Date, Campaign, Ad Set, Ad, Cost, Impression, Click, Purchase, Revenue', but column names may not match exactly.
줘
Your tasks:

1. **Pivot Table Generation**
   - For each of: Campaign, Ad Set, and Ad, create a pivot table summarizing the following metrics: Impression (volume), CTR, Purchase (conversion count), CVR, Cost, Click, CPA, Revenue.
   - Sort each table in descending order by Impression, CTR, and Purchase (conversion count).
   - Output each pivot table as a separate **CSV code block** (\`\`\`csv ... \`\`\`), so it can be rendered as a table in the UI.
   - Each CSV must have columns for the grouping key (e.g., Campaign), and all metrics above.

2. **Heatmap Visualization**
   - For the main pivot table(s), generate a heatmap visualization (e.g., for CTR, CVR, CPA, etc.) so that performance can be visually compared at a glance.
   - Return the heatmap as a PNG image, using a Markdown image tag: ![heatmap](data:image/png;base64,...) or a supported image URL.

3. **Report & Good/Bad Analysis**
   - Based on the data, classify each Ad (creative) as Good or Bad. For example, if an Ad has high Impression and CTR but low CVR, it may be hooking but not converting (e.g., landing page misalignment).
   - For each Ad, analyze what factors contributed to its performance (e.g., creative, copy, CTA, etc.).
   - Provide a summary table (in Markdown) listing Good/Bad classification and key reasons.
   - Provide a concise, actionable report in natural language, summarizing insights and recommendations for each group (Campaign, Ad Set, Ad), including what was good, what needs improvement, and why.

4. **Output Format**
   - Each pivot table: **CSV code block** (\`\`\`csv ... \`\`\`)
   - Each heatmap: **Markdown image tag**
   - Good/Bad summary: **Markdown table**
   - Insights & recommendations: **Markdown text**
   - Make sure all outputs are clearly separated and labeled (e.g., 'Campaign Pivot Table', 'Ad Set Pivot Table', 'Ad Pivot Table', 'Heatmap', 'Good/Bad Table', 'Insights & Recommendations').
   - Treat missing/NaN/empty values as 0.

Analyze the following data:
`;

// Process data with Gemini API
const processDataWithGemini = async (data) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    // Convert data to CSV string
    const csvData = convertToCSV(data);
    
    // Combine prompt with data
    const fullPrompt = `${MARKETING_ANALYSIS_PROMPT}\n\nData:\n${csvData}`;
    
    // Generate analysis
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const analysis = JSON.parse(response.text());
    
    return analysis;
  } catch (error) {
    console.error('Error processing data with Gemini:', error);
    throw new Error('Failed to process data with Gemini API');
  }
};

// Helper function to convert data to CSV
const convertToCSV = (data) => {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      }).join(',')
    )
  ];
  
  return csvRows.join('\n');
};

// Generate weekly report with Gemini
const generateWeeklyReportWithGemini = async (data) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const weeklyReportPrompt = `Generate a weekly performance marketing report based on the following data. 
    Focus on key metrics, trends, and actionable insights. Format the response as a JSON object with sections for:
    - Executive Summary
    - Key Metrics Overview
    - Campaign Performance
    - Creative Performance
    - Budget Analysis
    - Recommendations
    
    Data:\n${convertToCSV(data)}`;
    
    const result = await model.generateContent(weeklyReportPrompt);
    const response = await result.response;
    const report = JSON.parse(response.text());
    
    return report;
  } catch (error) {
    console.error('Error generating weekly report with Gemini:', error);
    throw new Error('Failed to generate weekly report with Gemini API');
  }
};

// Generate time-based analysis with Gemini
const generateTimeBasedAnalysisWithGemini = async (data, timeFrame) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const timeAnalysisPrompt = `Analyze the following marketing data with focus on time-based trends.
    Time frame: ${timeFrame}
    
    Provide analysis for:
    - Performance trends over time
    - Seasonal patterns
    - Day of week patterns
    - Time-based recommendations
    
    Format the response as a JSON object.
    
    Data:\n${convertToCSV(data)}`;
    
    const result = await model.generateContent(timeAnalysisPrompt);
    const response = await result.response;
    const analysis = JSON.parse(response.text());
    
    return analysis;
  } catch (error) {
    console.error('Error generating time-based analysis with Gemini:', error);
    throw new Error('Failed to generate time-based analysis with Gemini API');
  }
};

module.exports = {
  processDataWithGemini,
  generateWeeklyReportWithGemini,
  generateTimeBasedAnalysisWithGemini
}; 