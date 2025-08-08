const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    this.initializeService();
    
    this.toneInstructions = {
      formal: 'Use formal, professional language with proper structure and respectful tone. Avoid contractions and casual expressions.',
      casual: 'Use relaxed, conversational language that feels natural and approachable. Contractions are fine.',
      friendly: 'Use warm, welcoming language that creates connection. Be personable and engaging.',
      professional: 'Use clear, business-appropriate language that is polished but not overly formal.',
      creative: 'Use imaginative, engaging language with vivid descriptions and creative expressions.',
      concise: 'Use brief, direct language that gets to the point quickly while maintaining clarity.'
    };
    
    this.typeInstructions = {
      email: 'Structure as a proper email with clear subject line suggestions and appropriate formatting.',
      message: 'Format as a clear, direct message suitable for instant messaging or brief communication.',
      explanation: 'Provide clear, logical explanation with good flow and easy-to-understand language.',
      summary: 'Create a concise summary that captures the key points effectively.',
      proposal: 'Structure as a professional proposal with clear objectives and compelling arguments.',
      report: 'Format as a structured report with clear sections and professional presentation.',
      other: 'Improve clarity, structure, and overall effectiveness of the content.'
    };
  }

  initializeService() {
    try {
      if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️ GEMINI_API_KEY not found in environment variables');
        this.genAI = null;
        return;
      }

      // Validate API key format
      if (!process.env.GEMINI_API_KEY.startsWith('AIza')) {
        console.warn('⚠️ GEMINI_API_KEY format appears invalid (should start with "AIza")');
        this.genAI = null;
        return;
      }

      console.log('🔑 Initializing Gemini AI with API key');
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      
      try {
        this.model = this.genAI.getGenerativeModel({ 
          model: 'gemini-1.5-flash',
          generationConfig: {
            temperature: 0.7,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 2048,
          },
        });
        console.log('✅ Gemini model initialized successfully');
      } catch (modelError) {
        console.error('❌ Failed to initialize Gemini model:', modelError.message);
        this.genAI = null;
      }
    } catch (error) {
      console.error('❌ Failed to initialize Gemini service:', error.message);
      this.genAI = null;
    }
  }

  async testConnection() {
    if (!this.genAI || !this.model) {
      return { success: false, error: 'Service not initialized' };
    }

    try {
      console.log('🧪 Testing Gemini API connection...');
      const result = await this.model.generateContent('Hello, this is a test.');
      const response = await result.response;
      const text = response.text();
      console.log('✅ Gemini API connection successful');
      return { success: true, response: text };
    } catch (error) {
      console.error('❌ Gemini API connection test failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async rewritePrompt(originalPrompt, tone = 'professional', type = 'other') {
    const startTime = Date.now();
    
    try {
      // If Gemini API is not available, return mock response
      if (!this.genAI || !this.model) {
        console.log('⚠️ Using mock response - Gemini API not available');
        return this.getMockResponse(originalPrompt, tone, type, startTime);
      }

      // Test connection first
      const connectionTest = await this.testConnection();
      if (!connectionTest.success) {
        console.error('❌ Connection test failed, using mock response');
        return {
          success: false,
          error: 'Failed to connect to Gemini API',
          details: connectionTest.error,
          fallback: this.getMockResponse(originalPrompt, tone, type, startTime)
        };
      }

      const toneInstruction = this.toneInstructions[tone] || this.toneInstructions.professional;
      const typeInstruction = this.typeInstructions[type] || this.typeInstructions.other;
      
      const systemPrompt = `You are PromptMate, an AI assistant that specializes in rewriting and improving text.

Your task is to rewrite the given text according to these specifications:
- TONE: ${toneInstruction}
- TYPE: ${typeInstruction}

Rules:
1. Maintain the original meaning and intent
2. Improve clarity, structure, and flow
3. Fix any grammar or spelling issues
4. Make it more engaging and effective
5. Keep it concise but comprehensive
6. Don't add information that wasn't in the original

Please rewrite the following text:`;

      console.log('🤖 Sending request to Gemini API...');
      
      // Add timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000);
      });

      const generatePromise = this.model.generateContent(`${systemPrompt}\n\n"${originalPrompt}"`);
      
      const result = await Promise.race([generatePromise, timeoutPromise]);
      const response = await result.response;
      const rewrittenText = response.text();
      
      const processingTime = Date.now() - startTime;
      
      console.log('✅ Successfully received response from Gemini API');
      
      return {
        success: true,
        rewrittenPrompt: rewrittenText.trim(),
        metadata: {
          processingTime,
          model: 'gemini-1.5-flash',
          tone,
          type,
          originalLength: originalPrompt.length,
          rewrittenLength: rewrittenText.length,
          apiCost: this.calculateCost(originalPrompt, rewrittenText)
        }
      };
      
    } catch (error) {
      console.error('❌ Gemini API Error:', error);
      
      let errorMessage = 'Failed to rewrite prompt';
      if (error.message.includes('fetch failed')) {
        errorMessage = 'Network connection failed - check your internet connection';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out - please try again';
      } else if (error.message.includes('API key')) {
        errorMessage = 'API key is invalid or expired';
      }
      
      return {
        success: false,
        error: errorMessage,
        details: error.message,
        fallback: this.getMockResponse(originalPrompt, tone, type, startTime)
      };
    }
  }

  getMockResponse(originalPrompt, tone, type, startTime) {
    console.log('🎭 Generating mock response...');
    const processingTime = Date.now() - startTime;
    
    let mockRewritten = originalPrompt;
    
    // Basic improvements
    mockRewritten = mockRewritten
      .replace(/\bi\b/g, 'I')
      .replace(/\bu\b/g, 'you')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (!/[.!?]$/.test(mockRewritten)) {
      mockRewritten += '.';
    }
    
    // Tone modifications
    if (tone === 'formal') {
      mockRewritten = `I would like to formally request assistance with the following: ${mockRewritten}`;
    } else if (tone === 'friendly') {
      mockRewritten = `Hi there! ${mockRewritten} Hope this helps!`;
    } else if (tone === 'casual') {
      mockRewritten = `Hey, ${mockRewritten}`;
    }
    
    // Type modifications
    if (type === 'email') {
      mockRewritten = `Subject: Request for Assistance\n\nDear [Recipient],\n\n${mockRewritten}\n\nBest regards,\n[Your Name]`;
    }
    
    return {
      success: true,
      rewrittenPrompt: mockRewritten,
      metadata: {
        processingTime,
        model: 'mock-gemini',
        tone,
        type,
        originalLength: originalPrompt.length,
        rewrittenLength: mockRewritten.length,
        apiCost: 0,
        note: 'This is a mock response. Please configure a valid GEMINI_API_KEY for actual AI rewriting.'
      }
    };
  }

  calculateCost(originalText, rewrittenText) {
    const totalChars = originalText.length + rewrittenText.length;
    const estimatedCost = (totalChars / 1000) * 0.0005;
    return parseFloat(estimatedCost.toFixed(6));
  }

  async getModelInfo() {
    const connectionTest = this.genAI ? await this.testConnection() : { success: false };
    
    return {
      model: 'gemini-1.5-flash',
      available: !!this.genAI && connectionTest.success,
      connectionStatus: connectionTest.success ? 'connected' : 'disconnected',
      supportedTones: Object.keys(this.toneInstructions),
      supportedTypes: Object.keys(this.typeInstructions),
      lastError: connectionTest.success ? null : connectionTest.error
    };
  }
}

module.exports = new GeminiService();