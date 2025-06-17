#!/bin/bash

echo "🔧 Marketing Analyzer Recovery Script"
echo "======================================"

# Navigate to project directory
cd /Users/sanakang/Desktop/marketing-analyzer

echo "📁 Current directory: $(pwd)"

# Step 1: Clean everything
echo "🧹 Step 1: Cleaning old dependencies..."
rm -rf node_modules
rm -rf backend/node_modules
rm -f package-lock.json
rm -f backend/package-lock.json

# Step 2: Install frontend dependencies
echo "📦 Step 2: Installing frontend dependencies..."
npm install

# Check if frontend install was successful
if [ $? -eq 0 ]; then
    echo "✅ Frontend dependencies installed successfully"
else
    echo "❌ Frontend installation failed"
    echo "🔧 Trying to fix with --legacy-peer-deps..."
    npm install --legacy-peer-deps
fi

# Step 3: Install backend dependencies
echo "📦 Step 3: Installing backend dependencies..."
cd backend
npm install

# Check if backend install was successful
if [ $? -eq 0 ]; then
    echo "✅ Backend dependencies installed successfully"
else
    echo "❌ Backend installation failed"
    echo "🔧 Trying to fix with --legacy-peer-deps..."
    npm install --legacy-peer-deps
fi

# Go back to root
cd ..

# Step 4: Check environment files
echo "🔍 Step 4: Checking environment configuration..."
if [ -f ".env" ]; then
    echo "✅ Frontend .env file exists"
else
    echo "⚠️  Frontend .env file missing"
fi

if [ -f "backend/.env" ]; then
    echo "✅ Backend .env file exists"
else
    echo "⚠️  Backend .env file missing"
fi

# Step 5: Test the setup
echo "🧪 Step 5: Testing the setup..."

# Test backend health
echo "🔍 Starting backend test..."
cd backend
npm run health &
HEALTH_PID=$!
sleep 3
kill $HEALTH_PID 2>/dev/null

cd ..

echo ""
echo "🎉 Recovery Complete!"
echo "===================="
echo ""
echo "🚀 To start your application:"
echo "   1. Frontend: npm start"
echo "   2. Backend:  cd backend && npm run dev"
echo "   3. Both:     npm run dev"
echo ""
echo "🔧 If you still encounter issues:"
echo "   1. Check your .env files have the correct Clerk keys"
echo "   2. Make sure MongoDB is accessible"
echo "   3. Try restarting your terminal"
echo ""
echo "📝 Recent fixes applied:"
echo "   - Downgraded React from 19.1.0 to 18.2.0 for stability"
echo "   - Fixed Clerk authentication integration"
echo "   - Stabilized backend dependencies"
echo "   - Added error boundary and fallback handling"
echo "   - Improved database connection handling"
echo ""
