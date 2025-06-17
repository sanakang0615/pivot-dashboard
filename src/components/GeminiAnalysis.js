import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

const GeminiAnalysis = ({ data }) => {
  const [analysisType, setAnalysisType] = useState('default');
  const [timeFrame, setTimeFrame] = useState('weekly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  const handleAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/analyze/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data,
          analysisType,
          timeFrame: analysisType === 'timeBased' ? timeFrame : undefined
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get analysis');
      }

      const result = await response.json();
      setAnalysis(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderAnalysisSection = () => {
    if (!analysis) return null;

    return (
      <Box sx={{ mt: 3 }}>
        {/* Summary Section */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Summary
          </Typography>
          <Typography>{analysis.summary}</Typography>
        </Paper>

        {/* Campaign Analysis */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Campaign Analysis
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1">Top Performers</Typography>
              <DataGrid
                rows={analysis.campaignAnalysis.topPerformers}
                columns={[
                  { field: 'campaign', headerName: 'Campaign', flex: 1 },
                  { field: 'ctr', headerName: 'CTR', type: 'number' },
                  { field: 'cvr', headerName: 'CVR', type: 'number' },
                  { field: 'cpa', headerName: 'CPA', type: 'number' }
                ]}
                autoHeight
                pageSize={5}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1">Bottom Performers</Typography>
              <DataGrid
                rows={analysis.campaignAnalysis.bottomPerformers}
                columns={[
                  { field: 'campaign', headerName: 'Campaign', flex: 1 },
                  { field: 'ctr', headerName: 'CTR', type: 'number' },
                  { field: 'cvr', headerName: 'CVR', type: 'number' },
                  { field: 'cpa', headerName: 'CPA', type: 'number' }
                ]}
                autoHeight
                pageSize={5}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Budget Recommendations */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Budget Recommendations
          </Typography>
          <DataGrid
            rows={analysis.budgetRecommendations}
            columns={[
              { field: 'campaign', headerName: 'Campaign', flex: 1 },
              { field: 'recommendation', headerName: 'Recommendation', flex: 1 },
              { field: 'expectedImpact', headerName: 'Expected Impact', flex: 1 }
            ]}
            autoHeight
            pageSize={5}
          />
        </Paper>

        {/* Creative Insights */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Creative Insights
          </Typography>
          <DataGrid
            rows={analysis.creativeInsights}
            columns={[
              { field: 'creative', headerName: 'Creative', flex: 1 },
              { field: 'insight', headerName: 'Insight', flex: 1 },
              { field: 'recommendation', headerName: 'Recommendation', flex: 1 }
            ]}
            autoHeight
            pageSize={5}
          />
        </Paper>

        {/* Action Items */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Action Items
          </Typography>
          <DataGrid
            rows={analysis.actionItems}
            columns={[
              { field: 'action', headerName: 'Action', flex: 1 },
              { field: 'priority', headerName: 'Priority', flex: 1 },
              { field: 'expectedOutcome', headerName: 'Expected Outcome', flex: 1 }
            ]}
            autoHeight
            pageSize={5}
          />
        </Paper>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Gemini AI Analysis
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Analysis Type</InputLabel>
              <Select
                value={analysisType}
                onChange={(e) => setAnalysisType(e.target.value)}
                label="Analysis Type"
              >
                <MenuItem value="default">Default Analysis</MenuItem>
                <MenuItem value="weekly">Weekly Report</MenuItem>
                <MenuItem value="timeBased">Time-based Analysis</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {analysisType === 'timeBased' && (
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Time Frame</InputLabel>
                <Select
                  value={timeFrame}
                  onChange={(e) => setTimeFrame(e.target.value)}
                  label="Time Frame"
                >
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          )}

          <Grid item xs={12} md={4}>
            <Button
              variant="contained"
              onClick={handleAnalysis}
              disabled={loading}
              fullWidth
            >
              {loading ? <CircularProgress size={24} /> : 'Analyze Data'}
            </Button>
          </Grid>
        </Grid>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {renderAnalysisSection()}
    </Box>
  );
};

export default GeminiAnalysis; 