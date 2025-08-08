const Prompt = require('../models/Prompt');
const geminiService = require('../services/geminiService');

class PromptController {
  
  // POST /api/rewrite - Rewrite a prompt using Gemini AI
  async rewritePrompt(req, res, next) {
    try {
      const { prompt, tone = 'professional', type = 'other', userId } = req.body;
      
      // Validation
      if (!prompt || prompt.trim().length === 0) {
        return res.status(400).json({
          error: 'Prompt is required',
          message: 'Please provide a prompt to rewrite'
        });
      }
      
      if (prompt.length > 5000) {
        return res.status(400).json({
          error: 'Prompt too long',
          message: 'Prompt must be less than 5000 characters'
        });
      }
      
      console.log(`🔄 Rewriting prompt for user: ${userId || 'anonymous'}`);
      
      // Call Gemini service
      const result = await geminiService.rewritePrompt(prompt.trim(), tone, type);
      
      if (!result.success) {
        return res.status(500).json({
          error: 'AI service error',
          message: result.error,
          details: result.details,
          ...(result.fallback && { fallback: result.fallback })
        });
      }
      
      const response = {
        success: true,
        data: {
          originalPrompt: prompt.trim(),
          rewrittenPrompt: result.rewrittenPrompt,
          tone,
          type,
          metadata: result.metadata
        }
      };
      
      // Auto-save to history if userId is provided
      if (userId) {
        try {
          const historyItem = new Prompt({
            userId,
            originalPrompt: prompt.trim(),
            rewrittenPrompt: result.rewrittenPrompt,
            tone,
            type,
            metadata: result.metadata
          });
          
          const savedItem = await historyItem.save();
          response.data.historyId = savedItem._id;
          response.data.savedToHistory = true;
        } catch (saveError) {
          console.warn('Failed to auto-save to history:', saveError.message);
          response.data.savedToHistory = false;
        }
      }
      
      res.status(200).json(response);
      
    } catch (error) {
      console.error('Error in rewritePrompt:', error);
      next(error);
    }
  }
  
  // POST /api/history - Save prompt to history
  async saveToHistory(req, res, next) {
    try {
      const { userId, originalPrompt, rewrittenPrompt, tone, type, metadata } = req.body;
      
      // Validation
      if (!userId || !originalPrompt || !rewrittenPrompt) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'userId, originalPrompt, and rewrittenPrompt are required'
        });
      }
      
      const historyItem = new Prompt({
        userId,
        originalPrompt,
        rewrittenPrompt,
        tone: tone || 'professional',
        type: type || 'other',
        metadata: metadata || {}
      });
      
      const savedItem = await historyItem.save();
      
      res.status(201).json({
        success: true,
        data: savedItem,
        message: 'Prompt saved to history successfully'
      });
      
    } catch (error) {
      console.error('Error in saveToHistory:', error);
      next(error);
    }
  }
  
  // GET /api/history/:userId - Get user's prompt history
  async getHistory(req, res, next) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20, type, tone, search, sortBy = 'timestamp', sortOrder = 'desc' } = req.query;
      
      // Build query
      const query = { userId };
      
      if (type) query.type = type;
      if (tone) query.tone = tone;
      if (search) {
        query.$or = [
          { originalPrompt: { $regex: search, $options: 'i' } },
          { rewrittenPrompt: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
      
      // Execute query
      const [prompts, total] = await Promise.all([
        Prompt.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Prompt.countDocuments(query)
      ]);
      
      res.status(200).json({
        success: true,
        data: {
          prompts,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalItems: total,
            itemsPerPage: parseInt(limit),
            hasNext: skip + prompts.length < total,
            hasPrev: parseInt(page) > 1
          }
        }
      });
      
    } catch (error) {
      console.error('Error in getHistory:', error);
      next(error);
    }
  }
  
  // DELETE /api/history/:id - Delete a history item
  async deleteHistoryItem(req, res, next) {
    try {
      const { id } = req.params;
      const { userId } = req.query; // Optional: for additional security
      
      const query = { _id: id };
      if (userId) query.userId = userId;
      
      const deletedItem = await Prompt.findOneAndDelete(query);
      
      if (!deletedItem) {
        return res.status(404).json({
          error: 'History item not found',
          message: 'The requested history item does not exist or you do not have permission to delete it'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'History item deleted successfully',
        data: { deletedId: id }
      });
      
    } catch (error) {
      console.error('Error in deleteHistoryItem:', error);
      next(error);
    }
  }
  
  // POST /api/history/favorite/:id - Toggle favorite status
  async toggleFavorite(req, res, next) {
    try {
      const { id } = req.params;
      const { userId } = req.body; // Optional: for additional security
      
      const query = { _id: id };
      if (userId) query.userId = userId;
      
      const prompt = await Prompt.findOne(query);
      
      if (!prompt) {
        return res.status(404).json({
          error: 'History item not found',
          message: 'The requested history item does not exist or you do not have permission to modify it'
        });
      }
      
      prompt.isFavorite = !prompt.isFavorite;
      await prompt.save();
      
      res.status(200).json({
        success: true,
        data: {
          id: prompt._id,
          isFavorite: prompt.isFavorite
        },
        message: `Prompt ${prompt.isFavorite ? 'added to' : 'removed from'} favorites`
      });
      
    } catch (error) {
      console.error('Error in toggleFavorite:', error);
      next(error);
    }
  }
  
  // GET /api/favorites/:userId - Get user's favorite prompts
  async getFavorites(req, res, next) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20, sortBy = 'timestamp', sortOrder = 'desc' } = req.query;
      
      const query = { userId, isFavorite: true };
      
      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
      
      // Execute query
      const [prompts, total] = await Promise.all([
        Prompt.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Prompt.countDocuments(query)
      ]);
      
      res.status(200).json({
        success: true,
        data: {
          favorites: prompts,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalItems: total,
            itemsPerPage: parseInt(limit),
            hasNext: skip + prompts.length < total,
            hasPrev: parseInt(page) > 1
          }
        }
      });
      
    } catch (error) {
      console.error('Error in getFavorites:', error);
      next(error);
    }
  }
  
  // GET /api/stats/:userId - Get user statistics
  async getUserStats(req, res, next) {
    try {
      const { userId } = req.params;
      
      const stats = await Prompt.getUserStats(userId);
      const recentActivity = await Prompt.find({ userId })
        .sort({ timestamp: -1 })
        .limit(5)
        .select('type tone timestamp')
        .lean();
      
      res.status(200).json({
        success: true,
        data: {
          stats: stats[0] || {
            totalPrompts: 0,
            favoritePrompts: 0,
            averageProcessingTime: 0,
            totalApiCost: 0
          },
          recentActivity
        }
      });
      
    } catch (error) {
      console.error('Error in getUserStats:', error);
      next(error);
    }
  }
  
  // GET /api/info - Get API and model information
  async getInfo(req, res, next) {
    try {
      const modelInfo = await geminiService.getModelInfo();
      const totalPrompts = await Prompt.countDocuments();
      const popularData = await Prompt.getPopularTonesAndTypes();
      
      res.status(200).json({
        success: true,
        data: {
          api: {
            version: '1.0.0',
            status: 'active',
            totalPromptsProcessed: totalPrompts
          },
          ai: modelInfo,
          popular: popularData
        }
      });
      
    } catch (error) {
      console.error('Error in getInfo:', error);
      next(error);
    }
  }
}

module.exports = new PromptController();