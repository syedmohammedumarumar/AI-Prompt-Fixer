const express = require('express');
const router = express.Router();
const promptController = require('../controllers/promptControllers');

// Validation middleware
const validateRewriteRequest = (req, res, next) => {
  const { prompt, tone, type } = req.body;
  
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({
      error: 'Invalid prompt',
      message: 'Prompt must be a non-empty string'
    });
  }
  
  const validTones = ['formal', 'casual', 'friendly', 'professional', 'creative', 'concise'];
  if (tone && !validTones.includes(tone)) {
    return res.status(400).json({
      error: 'Invalid tone',
      message: `Tone must be one of: ${validTones.join(', ')}`
    });
  }
  
  const validTypes = ['email', 'message', 'explanation', 'summary', 'proposal', 'report', 'other'];
  if (type && !validTypes.includes(type)) {
    return res.status(400).json({
      error: 'Invalid type',
      message: `Type must be one of: ${validTypes.join(', ')}`
    });
  }
  
  next();
};

const validateUserId = (req, res, next) => {
  const userId = req.params.userId || req.body.userId;
  
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid userId',
      message: 'userId is required and must be a non-empty string'
    });
  }
  
  next();
};

// Main routes

// POST /api/rewrite - Rewrite a prompt
router.post('/rewrite', validateRewriteRequest, promptController.rewritePrompt);

// POST /api/history - Save to history
router.post('/history', promptController.saveToHistory);

// GET /api/history/:userId - Get user history
router.get('/history/:userId', validateUserId, promptController.getHistory);

// DELETE /api/history/:id - Delete history item
router.delete('/history/:id', promptController.deleteHistoryItem);

// POST /api/history/favorite/:id - Toggle favorite
router.post('/history/favorite/:id', promptController.toggleFavorite);

// GET /api/favorites/:userId - Get user favorites
router.get('/favorites/:userId', validateUserId, promptController.getFavorites);

// GET /api/stats/:userId - Get user statistics
router.get('/stats/:userId', validateUserId, promptController.getUserStats);

// GET /api/info - Get API information
router.get('/info', promptController.getInfo);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'PromptMate API is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;