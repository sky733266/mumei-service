const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// 强制清空 OpenAI API Key（国内无法直连，重启服务后生效）
// 正式使用时请通过 .env 或环境变量配置兼容国内的大模型接口
if (process.env.OPENAI_API_KEY) {
  console.warn('[AI] 检测到 OPENAI_API_KEY，国内直连 OpenAI 会超时，AI工具暂用模拟模式');
  // 临时禁用，换用硅基流动等国内兼容接口时可改为：
  // AI_CONFIG.openai.baseURL = 'https://api.siliconflow.cn/v1';
  process.env.OPENAI_API_KEY = '';
}

// AI服务配置
const AI_CONFIG = {
  // OpenAI配置
  openai: {
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    models: {
      'gpt-4': { price: 0.03, inputPrice: 0.03, outputPrice: 0.06 },
      'gpt-4-turbo': { price: 0.01, inputPrice: 0.01, outputPrice: 0.03 },
      'gpt-3.5-turbo': { price: 0.0005, inputPrice: 0.0005, outputPrice: 0.0015 }
    }
  },
  // Claude配置
  claude: {
    baseURL: process.env.CLAUDE_BASE_URL || 'https://api.anthropic.com/v1',
    apiKey: process.env.CLAUDE_API_KEY,
    models: {
      'claude-3-opus': { price: 0.015, inputPrice: 0.015, outputPrice: 0.075 },
      'claude-3-sonnet': { price: 0.003, inputPrice: 0.003, outputPrice: 0.015 },
      'claude-3-haiku': { price: 0.00025, inputPrice: 0.00025, outputPrice: 0.00125 }
    }
  },
  // 图像生成配置
  image: {
    // Stability AI
    stability: {
      apiKey: process.env.STABILITY_API_KEY,
      baseURL: 'https://api.stability.ai/v2beta',
      price: 0.04 // 每张图
    },
    // OpenAI DALL-E
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      models: {
        'dall-e-3': { price: 0.04, size: '1024x1024' },
        'dall-e-2': { price: 0.02, size: '1024x1024' }
      }
    }
  },
  // 语音合成配置
  tts: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      models: {
        'tts-1': { price: 0.015 }, // 每1K字符
        'tts-1-hd': { price: 0.03 }
      }
    },
    // 阿里云语音
    aliyun: {
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
      appKey: process.env.ALIYUN_APP_KEY,
      price: 0.002 // 每1K字符
    }
  },
  // 语音识别配置
  stt: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      price: 0.006 // 每分钟
    },
    aliyun: {
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
      appKey: process.env.ALIYUN_APP_KEY,
      price: 0.0012 // 每秒
    }
  },
  // 翻译配置
  translation: {
    // DeepL
    deepl: {
      apiKey: process.env.DEEPL_API_KEY,
      price: 0.000025 // 每字符
    },
    // 阿里云翻译
    aliyun: {
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
      price: 0.00005 // 每字符
    }
  }
};

// AI文本生成服务
class TextGenerationService {
  // 通用文本生成
  static async generate({ prompt, model = 'gpt-3.5-turbo', maxTokens = 1000, temperature = 0.7, systemPrompt = '' }) {
    const startTime = Date.now();
    
    try {
      // 检查是否有API密钥
      if (!AI_CONFIG.openai.apiKey) {
        // 模拟响应
        return {
          text: `[模拟响应] 这是基于提示 "${prompt.substring(0, 50)}..." 生成的文本。实际使用时请配置OpenAI API密钥。`,
          model,
          usage: {
            promptTokens: prompt.length / 4,
            completionTokens: 100,
            totalTokens: prompt.length / 4 + 100
          },
          cost: 0,
          duration: Date.now() - startTime,
          mock: true
        };
      }

      const messages = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await axios.post(
        `${AI_CONFIG.openai.baseURL}/chat/completions`,
        {
          model,
          messages,
          max_tokens: maxTokens,
          temperature
        },
        {
          headers: {
            'Authorization': `Bearer ${AI_CONFIG.openai.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      const result = response.data;
      const usage = result.usage;
      const modelConfig = AI_CONFIG.openai.models[model] || AI_CONFIG.openai.models['gpt-3.5-turbo'];
      
      // 计算成本
      const cost = (usage.prompt_tokens * modelConfig.inputPrice + usage.completion_tokens * modelConfig.outputPrice) / 1000;

      return {
        text: result.choices[0].message.content,
        model: result.model,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens
        },
        cost,
        duration: Date.now() - startTime,
        mock: false
      };
    } catch (error) {
      console.error('文本生成失败:', error.message);
      throw new Error(`文本生成失败: ${error.message}`);
    }
  }

  // 代码生成/补全
  static async generateCode({ prompt, language = 'javascript', model = 'gpt-3.5-turbo' }) {
    const systemPrompt = `You are a helpful coding assistant. Generate ${language} code based on the user's request. Only return the code, no explanations.`;
    return this.generate({ prompt, model, systemPrompt, temperature: 0.2 });
  }

  // 代码审查
  static async reviewCode({ code, language = 'javascript', model = 'gpt-3.5-turbo' }) {
    const prompt = `Please review the following ${language} code and provide feedback on:
1. Potential bugs or issues
2. Code quality and best practices
3. Performance considerations
4. Security concerns

Code:\n${code}`;
    
    return this.generate({ prompt, model, temperature: 0.3 });
  }

  // 文本摘要
  static async summarize({ text, maxLength = 200, model = 'gpt-3.5-turbo' }) {
    const prompt = `Please summarize the following text in ${maxLength} characters or less:\n\n${text}`;
    return this.generate({ prompt, model, maxTokens: Math.ceil(maxLength / 2) });
  }

  // 文本分类
  static async classify({ text, categories, model = 'gpt-3.5-turbo' }) {
    const prompt = `Classify the following text into one of these categories: ${categories.join(', ')}.\n\nText: ${text}\n\nCategory:`;
    const result = await this.generate({ prompt, model, maxTokens: 50, temperature: 0.1 });
    return {
      ...result,
      category: result.text.trim()
    };
  }

  // 情感分析
  static async sentiment({ text, model = 'gpt-3.5-turbo' }) {
    const prompt = `Analyze the sentiment of the following text. Respond with only: POSITIVE, NEGATIVE, or NEUTRAL.\n\nText: ${text}`;
    const result = await this.generate({ prompt, model, maxTokens: 20, temperature: 0.1 });
    return {
      ...result,
      sentiment: result.text.trim().toUpperCase()
    };
  }
}

// AI图像生成服务
class ImageGenerationService {
  static async generate({ prompt, model = 'dall-e-3', size = '1024x1024', n = 1, style = 'vivid' }) {
    const startTime = Date.now();
    
    try {
      if (!AI_CONFIG.openai.apiKey) {
        // 模拟响应
        return {
          images: Array(n).fill(null).map(() => ({
            url: `https://via.placeholder.com/${size}/6366f1/ffffff?text=AI+Generated+Image`,
            revisedPrompt: prompt
          })),
          model,
          cost: 0,
          duration: Date.now() - startTime,
          mock: true
        };
      }

      const response = await axios.post(
        `${AI_CONFIG.openai.baseURL}/images/generations`,
        {
          model,
          prompt,
          size,
          n,
          style
        },
        {
          headers: {
            'Authorization': `Bearer ${AI_CONFIG.openai.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000
        }
      );

      const result = response.data;
      const modelConfig = AI_CONFIG.image.openai.models[model];
      const cost = modelConfig.price * n;

      return {
        images: result.data.map(img => ({
          url: img.url,
          revisedPrompt: img.revised_prompt || prompt
        })),
        model,
        cost,
        duration: Date.now() - startTime,
        mock: false
      };
    } catch (error) {
      console.error('图像生成失败:', error.message);
      throw new Error(`图像生成失败: ${error.message}`);
    }
  }

  // 图像编辑（生成变体）
  static async edit({ image, prompt, mask, size = '1024x1024', n = 1 }) {
    const startTime = Date.now();
    
    try {
      if (!AI_CONFIG.openai.apiKey) {
        return {
          images: Array(n).fill(null).map(() => ({
            url: `https://via.placeholder.com/${size}/8b5cf6/ffffff?text=Edited+Image`
          })),
          cost: 0,
          duration: Date.now() - startTime,
          mock: true
        };
      }

      const formData = new FormData();
      formData.append('image', image);
      formData.append('prompt', prompt);
      if (mask) formData.append('mask', mask);
      formData.append('size', size);
      formData.append('n', n.toString());

      const response = await axios.post(
        `${AI_CONFIG.openai.baseURL}/images/edits`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${AI_CONFIG.openai.apiKey}`
          },
          timeout: 120000
        }
      );

      return {
        images: response.data.data.map(img => ({ url: img.url })),
        cost: 0.04 * n,
        duration: Date.now() - startTime,
        mock: false
      };
    } catch (error) {
      console.error('图像编辑失败:', error.message);
      throw new Error(`图像编辑失败: ${error.message}`);
    }
  }
}

// 语音合成服务
class TTSService {
  static async synthesize({ text, model = 'tts-1', voice = 'alloy', speed = 1.0 }) {
    const startTime = Date.now();
    
    try {
      if (!AI_CONFIG.openai.apiKey) {
        return {
          audioUrl: `data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=`,
          duration: 0,
          characters: text.length,
          cost: 0,
          mock: true
        };
      }

      const response = await axios.post(
        `${AI_CONFIG.openai.baseURL}/audio/speech`,
        {
          model,
          input: text,
          voice,
          speed
        },
        {
          headers: {
            'Authorization': `Bearer ${AI_CONFIG.openai.apiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer',
          timeout: 60000
        }
      );

      // 转换为Base64
      const audioBase64 = Buffer.from(response.data).toString('base64');
      const modelConfig = AI_CONFIG.tts.openai.models[model];
      const cost = (text.length / 1000) * modelConfig.price;

      return {
        audioUrl: `data:audio/mp3;base64,${audioBase64}`,
        duration: text.length * 0.1, // 估算
        characters: text.length,
        cost,
        mock: false
      };
    } catch (error) {
      console.error('语音合成失败:', error.message);
      throw new Error(`语音合成失败: ${error.message}`);
    }
  }
}

// 语音识别服务
class STTService {
  static async transcribe({ audio, model = 'whisper-1', language = 'zh', prompt = '' }) {
    const startTime = Date.now();
    
    try {
      if (!AI_CONFIG.openai.apiKey) {
        return {
          text: `[模拟转录] 这是音频转录的模拟结果。实际使用时请配置OpenAI API密钥。`,
          language,
          duration: 60,
          cost: 0,
          mock: true
        };
      }

      const formData = new FormData();
      formData.append('file', audio);
      formData.append('model', model);
      if (language) formData.append('language', language);
      if (prompt) formData.append('prompt', prompt);

      const response = await axios.post(
        `${AI_CONFIG.openai.baseURL}/audio/transcriptions`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${AI_CONFIG.openai.apiKey}`
          },
          timeout: 120000
        }
      );

      const result = response.data;
      // 估算音频时长（假设平均每分钟1000字符）
      const estimatedDuration = result.text.length / 1000;
      const cost = estimatedDuration * AI_CONFIG.stt.openai.price;

      return {
        text: result.text,
        language: result.language || language,
        duration: estimatedDuration,
        cost,
        mock: false
      };
    } catch (error) {
      console.error('语音识别失败:', error.message);
      throw new Error(`语音识别失败: ${error.message}`);
    }
  }

  // 翻译转录
  static async translate({ audio, model = 'whisper-1' }) {
    const startTime = Date.now();
    
    try {
      if (!AI_CONFIG.openai.apiKey) {
        return {
          text: `[模拟翻译] This is a simulated translation result.`,
          language: 'en',
          duration: 60,
          cost: 0,
          mock: true
        };
      }

      const formData = new FormData();
      formData.append('file', audio);
      formData.append('model', model);

      const response = await axios.post(
        `${AI_CONFIG.openai.baseURL}/audio/translations`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${AI_CONFIG.openai.apiKey}`
          },
          timeout: 120000
        }
      );

      const result = response.data;
      const estimatedDuration = result.text.length / 1000;
      const cost = estimatedDuration * AI_CONFIG.stt.openai.price;

      return {
        text: result.text,
        language: result.language || 'en',
        duration: estimatedDuration,
        cost,
        mock: false
      };
    } catch (error) {
      console.error('语音翻译失败:', error.message);
      throw new Error(`语音翻译失败: ${error.message}`);
    }
  }
}

// 翻译服务
class TranslationService {
  static async translate({ text, sourceLang = 'auto', targetLang = 'en', model = 'gpt-3.5-turbo' }) {
    const startTime = Date.now();
    
    try {
      if (!AI_CONFIG.openai.apiKey) {
        // 简单的模拟翻译
        const mockTranslations = {
          'en': `[Translated to English] ${text.substring(0, 100)}...`,
          'zh': `[翻译成中文] ${text.substring(0, 100)}...`,
          'ja': `[日本語に翻訳] ${text.substring(0, 100)}...`,
          'ko': `[한국어로 번역] ${text.substring(0, 100)}...`,
          'fr': `[Traduit en français] ${text.substring(0, 100)}...`,
          'es': `[Traducido al español] ${text.substring(0, 100)}...`
        };
        
        return {
          text: mockTranslations[targetLang] || mockTranslations['en'],
          sourceLanguage: sourceLang === 'auto' ? 'zh' : sourceLang,
          targetLanguage: targetLang,
          characters: text.length,
          cost: 0,
          duration: Date.now() - startTime,
          mock: true
        };
      }

      const langNames = {
        'zh': 'Chinese',
        'en': 'English',
        'ja': 'Japanese',
        'ko': 'Korean',
        'fr': 'French',
        'es': 'Spanish',
        'de': 'German',
        'ru': 'Russian',
        'it': 'Italian',
        'pt': 'Portuguese'
      };

      const prompt = sourceLang === 'auto' 
        ? `Translate the following text to ${langNames[targetLang] || targetLang}:\n\n${text}`
        : `Translate the following text from ${langNames[sourceLang] || sourceLang} to ${langNames[targetLang] || targetLang}:\n\n${text}`;

      const response = await axios.post(
        `${AI_CONFIG.openai.baseURL}/chat/completions`,
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3
        },
        {
          headers: {
            'Authorization': `Bearer ${AI_CONFIG.openai.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      const result = response.data;
      const modelConfig = AI_CONFIG.openai.models[model] || AI_CONFIG.openai.models['gpt-3.5-turbo'];
      const cost = (result.usage.total_tokens * modelConfig.price) / 1000;

      return {
        text: result.choices[0].message.content,
        sourceLanguage: sourceLang === 'auto' ? 'auto-detected' : sourceLang,
        targetLanguage: targetLang,
        characters: text.length,
        cost,
        duration: Date.now() - startTime,
        mock: false
      };
    } catch (error) {
      console.error('翻译失败:', error.message);
      throw new Error(`翻译失败: ${error.message}`);
    }
  }

  // 批量翻译
  static async translateBatch({ texts, sourceLang = 'auto', targetLang = 'en' }) {
    const results = [];
    let totalCost = 0;
    
    for (const text of texts) {
      const result = await this.translate({ text, sourceLang, targetLang });
      results.push(result);
      totalCost += result.cost;
    }

    return {
      translations: results,
      totalCost,
      count: texts.length
    };
  }
}

module.exports = {
  TextGenerationService,
  ImageGenerationService,
  TTSService,
  STTService,
  TranslationService,
  AI_CONFIG
};
