#!/bin/bash

# Marketing Analyzer Startup Script

echo "Starting Marketing Analyzer..."
echo "This will start both frontend (React) and backend (Node.js) servers"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: Please run this script from the project root directory"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

if [ ! -d "backend/node_modules" ]; then
    echo "Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

# Check if .env files exist
if [ ! -f ".env" ]; then
    echo "Warning: Frontend .env file not found. Some features may not work."
fi

if [ ! -f "backend/.env" ]; then
    echo "Warning: Backend .env file not found. API features may not work."
fi

# Function to start backend
start_backend() {
    echo "Starting backend server..."
    cd backend
    npm start &
    BACKEND_PID=$!
    cd ..
    echo "Backend started (PID: $BACKEND_PID)"
}

# Function to start frontend
start_frontend() {
    echo "Starting frontend development server..."
    npm start &
    FRONTEND_PID=$!
    echo "Frontend started (PID: $FRONTEND_PID)"
}

# Start both servers
start_backend
sleep 2
start_frontend

echo ""
echo "Both servers are starting up!"
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop both servers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo "Backend stopped"
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        echo "Frontend stopped"
    fi
    echo "End"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait