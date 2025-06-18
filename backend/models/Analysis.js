const mongoose = require('mongoose');

const AnalysisSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  rawData: { type: Array, default: [] },
  pivotData: { type: Array, default: [] },
  classifiedData: { type: Array, default: [] },
  insights: { type: String, default: '' },
  heatmapImage: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['processing', 'completed', 'error'],
    default: 'processing'
  },
  metadata: {
    rowCount: Number,
    columns: [String],
    fileType: String
  }
});

// Update the updatedAt field before saving
AnalysisSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Analysis', AnalysisSchema); 