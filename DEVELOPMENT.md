# 🚀 Marketing Analyzer - Development Guide

## Quick Start Commands

### 🏃‍♂️ One-Command Setup & Start
```bash
# Clone and navigate to project
cd /Users/sanakang/Desktop/marketing-analyzer

# Make startup script executable (macOS/Linux)
chmod +x start.sh

# Start both frontend and backend
./start.sh
```

### 🛠️ Alternative Setup Methods

**Method 1: Using NPM Scripts (Recommended)**
```bash
# Install all dependencies
npm run setup

# Start development servers
npm run dev
```

**Method 2: Manual Setup**
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
npm run backend:install

# Start backend (Terminal 1)
npm run backend:dev

# Start frontend (Terminal 2) 
npm start
```

## 📋 Environment Setup

### Required Environment Variables

**Frontend `.env`:**
```env
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_test_cm9idXN0LW9zcHJleS00NS5jbGVyay5hY2NvdW50cy5kZXYk
REACT_APP_API_URL=http://localhost:3001
```

**Backend `backend/.env`:**
```env
PORT=3001
NODE_ENV=development
GEMINI_API_KEY=AIzaSyBI_y467V1tCmvkucb2n8gP9ZU9UtM-sDk
MONGODB_URI=mongodb+srv://radioheadsana:1vL9f9syY4ekQJWz@ad-oasis.movattz.mongodb.net/marketing-analyzer?retryWrites=true&w=majority&appName=ad-oasis
CLERK_PUBLISHABLE_KEY=pk_test_cm9idXN0LW9zcHJleS00NS5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_SECRET_KEY=sk_test_fo6422ennQs6nfKrerGIjkMtaaFUNGVnioXgGMVDnc
FRONTEND_URL=http://localhost:3000
```

## 🧪 Testing with Sample Data

### 📁 Using Provided Sample Data
```bash
# Sample file is available at:
sample-data/campaign_data_sample.csv
```

### 🎲 Generate Custom Test Data
Open browser console on the application and run:
```javascript
// Generate 100 rows of test data
generateAndSaveTestData('my_test_data', 100);

// Generate 500 rows for larger dataset testing
generateAndSaveTestData('large_test_data', 500);
```

## 🔍 Development Features

### 🌐 Available URLs
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

### 📊 API Endpoints
```bash
# Test file upload
curl -X POST -F "file=@sample-data/campaign_data_sample.csv" \
  http://localhost:3001/api/upload

# Test AI insights
curl -X POST -H "Content-Type: application/json" \
  -d '{"data":[{"campaign":"test","spend":100}],"analysisType":"general"}' \
  http://localhost:3001/api/insights

# Health check
curl http://localhost:3001/health
```

## 🛠️ Development Workflow

### 1. 🔄 Hot Reloading
- Frontend: Auto-reloads on file changes
- Backend: Uses nodemon for auto-restart

### 2. 📝 Making Changes
```bash
# Frontend changes: src/ directory
# Backend changes: backend/ directory
# Shared utilities: src/utils/
```

### 3. 🧹 Cleaning & Resetting
```bash
# Clean all node_modules
npm run clean

# Reset everything (clean + reinstall)
npm run reset
```

## 🔧 Troubleshooting

### Common Issues & Solutions

**1. 🚫 Port Already in Use**
```bash
# Kill processes on ports 3000 & 3001
sudo lsof -ti:3000 | xargs kill -9
sudo lsof -ti:3001 | xargs kill -9
```

**2. 📦 Dependency Issues**
```bash
# Clear npm cache
npm cache clean --force

# Reset project
npm run reset
```

**3. 🔑 API Key Issues**
- Verify `GEMINI_API_KEY` in `backend/.env`
- Check API quota and billing status
- Test API key with a simple curl command

**4. 🗄️ Database Connection Issues**
- Check MongoDB connection string
- Verify network connectivity
- Check MongoDB Atlas whitelist

### 🕵️ Debug Mode

**Enable Verbose Logging:**
```bash
# Backend debug mode
cd backend
DEBUG=* npm run dev

# Frontend debug mode
REACT_APP_DEBUG=true npm start
```

**Check Logs:**
```bash
# Backend logs
npm run backend:logs

# Browser console for frontend errors
```

## 🧪 Testing Features

### 📊 Data Processing Test
1. Upload `sample-data/campaign_data_sample.csv`
2. Verify data appears in dashboard
3. Check all tabs (Overview, Advanced, AI Insights)
4. Test export functionality

### 🤖 AI Features Test
1. Upload data
2. Navigate to AI Insights tab
3. Try different analysis types:
   - General Analysis
   - Performance Review
   - Optimization Tips
   - Creative Analysis

### 📱 Responsive Design Test
1. Test on different screen sizes
2. Check mobile navigation
3. Verify chart responsiveness

## 🚀 Performance Optimization

### Frontend Optimization
```bash
# Build for production
npm run build

# Analyze bundle size
npm run build -- --analyze
```

### Backend Optimization
- Monitor API response times
- Check memory usage with large files
- Test with concurrent uploads

## 📚 Code Structure

```
marketing-analyzer/
├── src/
│   ├── components/           # React components
│   │   ├── Landing/         # Homepage & marketing
│   │   ├── Dashboard/       # Main dashboard
│   │   ├── Analysis/        # Analysis pages
│   │   └── Common/          # Shared components
│   ├── utils/               # Frontend utilities
│   └── App.js              # Main app component
├── backend/
│   ├── server.js           # Express server
│   └── utils/              # Backend utilities
├── sample-data/            # Test data files
└── public/                 # Static assets
```

## 🎯 Development Best Practices

### 1. 📝 Code Style
- Use consistent naming conventions
- Add comments for complex logic
- Follow React best practices

### 2. 🔒 Security
- Never commit API keys
- Validate all user inputs
- Use environment variables

### 3. 📊 Performance
- Optimize large data processing
- Use React.memo for expensive components
- Implement proper error boundaries

### 4. 🧪 Testing
- Test with various file formats
- Test error scenarios
- Verify mobile compatibility

## 🔄 Deployment Preparation

### Environment Variables for Production
```env
# Frontend
REACT_APP_API_URL=https://your-api-domain.com
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_live_...

# Backend
NODE_ENV=production
GEMINI_API_KEY=your_production_key
MONGODB_URI=your_production_db_uri
```

### Build Commands
```bash
# Frontend build
npm run build

# Backend is ready for production as-is
```

## 🆘 Getting Help

### 📞 Support Checklist
1. ✅ Check this development guide
2. ✅ Review error messages in console
3. ✅ Verify environment variables
4. ✅ Test with sample data
5. ✅ Check API endpoints manually

### 🐛 Reporting Issues
When reporting issues, include:
- Error messages from browser console
- Network tab responses
- Steps to reproduce
- Sample data used

---

**Happy coding! 🚀**

*This guide covers everything you need to develop and debug the Marketing Analyzer application.*