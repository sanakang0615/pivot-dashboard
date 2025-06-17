# 🎯 Marketing Analyzer - Complete Setup & Usage Guide

## 🚀 Quick Start (5 Minutes)

### Step 1: Navigate to Project
```bash
cd /Users/sanakang/Desktop/marketing-analyzer
```

### Step 2: Install Dependencies
```bash
# Install all dependencies (frontend + backend)
npm run setup
```

### Step 3: Start Application
```bash
# Option A: Use the startup script
chmod +x start.sh
./start.sh

# Option B: Use npm script
npm run dev
```

### Step 4: Access Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

---

## 📊 Using the Application

### 1. Sign Up / Login
- Visit http://localhost:3000
- Click "Get Started" or "Sign In"
- Create account or use existing credentials

### 2. Upload Your Data
- Click "New Analysis" on dashboard
- Upload CSV or XLSX file with campaign data
- Supported columns: Campaign, Ad Group, Creative, Spend, Impressions, Clicks, Conversions, Date

### 3. Analyze Your Data
Navigate through three analysis tabs:

**📈 Overview Tab:**
- Key performance metrics
- Performance classification
- Budget optimization recommendations
- Pivot tables by campaign/ad group/creative

**📊 Advanced Analytics Tab:**
- Time series analysis with forecasting
- Performance correlation matrices
- Efficiency analysis
- Data export options

**🤖 AI Insights Tab:**
- AI-powered analysis using Google Gemini
- Performance pattern recognition
- Actionable recommendations
- Multiple analysis types (General, Performance, Optimization, Creative)

---

## 🧪 Testing with Sample Data

### Use Provided Sample
```bash
# Sample file location:
sample-data/campaign_data_sample.csv
```

### Generate Custom Test Data
1. Open browser console (F12)
2. Run: `generateAndSaveTestData('test_data', 100)`
3. Upload the downloaded file

---

## 🛠️ Configuration

### Environment Variables

**Frontend `.env`** (already configured):
```env
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_test_cm9idXN0LW9zcHJleS00NS5jbGVyay5hY2NvdW50cy5kZXYk
REACT_APP_API_URL=http://localhost:3001
```

**Backend `backend/.env`** (already configured):
```env
PORT=3001
NODE_ENV=development
GEMINI_API_KEY=AIzaSyBI_y467V1tCmvkucb2n8gP9ZU9UtM-sDk
# ... other settings
```

---

## 🔧 API Testing

### Test Backend Health
```bash
curl http://localhost:3001/health
```
Expected response: `{"status":"healthy","timestamp":"...","environment":"development"}`

### Test File Upload
```bash
curl -X POST -F "file=@sample-data/campaign_data_sample.csv" \
  http://localhost:3001/api/upload
```

### Test AI Insights
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"data":[{"campaign":"test","spend":100,"impressions":1000,"clicks":50,"conversions":5}],"analysisType":"general"}' \
  http://localhost:3001/api/insights
```

---

## 🎯 Key Features Walkthrough

### 1. 📊 Performance Classification
The system automatically categorizes your campaigns:

- **🏆 Top Performer**: High CTR + High CVR
- **⚡ Hooking Not Converting**: High CTR + Low CVR  
- **🎯 Low Engagement Good Quality**: Low CTR + High CVR
- **📉 Underperformer**: Low CTR + Low CVR
- **💸 Budget Waster**: High spend + Poor efficiency

### 2. 🤖 AI Analysis Types

**General Analysis**: Overall performance overview
**Performance Review**: Detailed metrics analysis  
**Optimization Tips**: Specific improvement recommendations
**Creative Analysis**: Creative effectiveness insights

### 3. 📈 Advanced Analytics

**Time Series**: Daily/weekly performance trends
**Correlation Matrix**: CTR vs CVR performance mapping
**Efficiency Analysis**: Spend vs conversion efficiency
**Forecasting**: 7-day performance predictions

---

## 💡 Pro Tips

### 📋 Data Preparation
1. **Column Names**: Flexible - the system auto-detects variations
2. **Date Format**: Use YYYY-MM-DD for best results  
3. **File Size**: Up to 10MB supported
4. **Data Quality**: Remove completely empty rows

### 🎯 Analysis Best Practices
1. **Start with Overview**: Get the big picture first
2. **Use Classification**: Focus on top performers and budget wasters
3. **Check AI Insights**: Get specific recommendations
4. **Export Data**: Save your analysis for reporting

### 🔄 Workflow Optimization
1. **Regular Uploads**: Upload data weekly for trend analysis
2. **Compare Periods**: Use date ranges to compare performance
3. **Action Items**: Follow AI recommendations for optimization
4. **Budget Reallocation**: Use efficiency metrics for budget decisions

---

## 🚨 Troubleshooting

### Common Issues

**❌ "Connection failed"**
```bash
# Check if backend is running
curl http://localhost:3001/health

# Restart backend if needed
cd backend && npm start
```

**❌ "File upload failed"**
- Check file format (CSV/XLSX only)
- Ensure file size < 10MB
- Verify column headers exist

**❌ "AI insights not loading"**
- Verify `GEMINI_API_KEY` in `backend/.env`
- Check internet connection
- Try smaller dataset (< 100 rows)

**❌ "Port already in use"**
```bash
# Kill processes on ports 3000 & 3001
sudo lsof -ti:3000 | xargs kill -9
sudo lsof -ti:3001 | xargs kill -9
```

### Development Mode
```bash
# Enable debug logging
DEBUG=* npm run dev

# Reset everything
npm run reset
```

---

## 📱 Browser Compatibility

**Recommended**: Chrome, Firefox, Safari, Edge (latest versions)
**Mobile**: Responsive design works on mobile devices
**Requirements**: JavaScript enabled, Local Storage available

---

## 🔒 Data Privacy

- **Local Storage**: Analysis data stored locally in your browser
- **No Data Retention**: Files not permanently stored on servers
- **Secure Processing**: Data processed in memory only
- **API Security**: Gemini API calls use secure HTTPS

---

## 🎉 Success Indicators

### ✅ Application is Working When:
1. Homepage loads at http://localhost:3000
2. You can sign up/login successfully
3. File upload completes without errors
4. Data appears in analysis dashboard
5. AI insights generate recommendations
6. Charts and tables display correctly

### 📈 Ready for Production Use When:
1. ✅ All features tested with your data
2. ✅ Performance acceptable with your file sizes
3. ✅ AI insights providing valuable recommendations
4. ✅ Export functionality working
5. ✅ Team members can access and use

---

## 🆘 Support

### 📚 Documentation
- **Development Guide**: `DEVELOPMENT.md`
- **Main README**: `README.md`
- **Sample Data**: `sample-data/`

### 🐛 Debugging
1. Check browser console (F12)
2. Review network tab for API errors
3. Verify environment variables
4. Test with sample data first

### 🔄 Updates
The application includes:
- Hot reload for development
- Automatic error boundaries
- Performance monitoring
- Comprehensive logging

---

**🎯 You're all set! Start analyzing your marketing campaigns with AI-powered insights!**

*This professional tool will transform how you analyze and optimize your advertising performance.*