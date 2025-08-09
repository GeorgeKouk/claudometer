/**
 * Input sanitization and output validation utilities
 * Used to prevent prompt injection and validate AI analysis responses
 */

/**
 * Sanitizes user input to prevent prompt injection attacks
 * @param {string} text - Raw text input from Reddit posts/comments
 * @returns {string} Sanitized text safe for AI analysis
 */
export function sanitizeUserInput(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Remove potential prompt injection patterns
  return text
    .replace(/```[\s\S]*?```/g, '[code block]') // Remove code blocks
    .replace(/\[SYSTEM\]/gi, '[system]') // Neutralize system tags
    .replace(/\[ASSISTANT\]/gi, '[assistant]') // Neutralize assistant tags
    .replace(/\[USER\]/gi, '[user]') // Neutralize user tags
    .replace(/IGNORE.{0,20}ABOVE/gi, '[ignore instruction]') // Block ignore instructions
    .replace(/IGNORE.{0,20}PREVIOUS/gi, '[ignore instruction]') // Block ignore instructions
    .replace(/DISREGARD.{0,20}ABOVE/gi, '[ignore instruction]') // Block disregard instructions
    .replace(/DISREGARD.{0,20}PREVIOUS/gi, '[ignore instruction]') // Block disregard instructions
    .replace(/OVERRIDE.{0,20}INSTRUCTIONS/gi, '[override attempt]') // Block override attempts
    .replace(/ACT\s+AS/gi, '[role play attempt]') // Block role playing
    .replace(/PRETEND\s+TO\s+BE/gi, '[role play attempt]') // Block role playing
    .replace(/YOU\s+ARE\s+NOW/gi, '[role change attempt]') // Block role changes
    .replace(/SYSTEM\s*:/gi, '[system prompt]') // Block system prompts
    .replace(/ASSISTANT\s*:/gi, '[assistant prompt]') // Block assistant prompts
    .replace(/NEW\s+INSTRUCTIONS/gi, '[new instruction attempt]') // Block new instructions
    .replace(/FORGET\s+EVERYTHING/gi, '[forget instruction]') // Block forget instructions
    .replace(/REVEAL\s+YOUR/gi, '[reveal attempt]') // Block reveal attempts
    .replace(/SHOW\s+ME\s+YOUR/gi, '[show attempt]') // Block show attempts
    .replace(/WHAT\s+IS\s+YOUR\s+PROMPT/gi, '[prompt extraction]') // Block prompt extraction
    .replace(/PRINT\s+YOUR\s+INSTRUCTIONS/gi, '[instruction extraction]') // Block instruction extraction
    .replace(/\$\{[^}]*\}/g, '[variable]') // Remove template variables
    .replace(/<script[\s\S]*?<\/script>/gi, '[script]') // Remove script tags
    .replace(/<[^>]*>/g, '[html]') // Remove HTML tags
    .replace(/javascript:/gi, '[javascript]') // Remove javascript protocols
    .replace(/data:(?!image\/)[^;]*;base64/gi, '[data-uri]') // Block non-image data URIs
    .trim()
    .substring(0, 1000); // Hard limit on input length
}

/**
 * Validates and sanitizes OpenAI analysis output
 * @param {string} content - Raw JSON response from OpenAI
 * @returns {Object} Validated analysis object with sentiment, topic, and keywords
 */
export function validateOutput(content) {
  try {
    const parsed = JSON.parse(content);
    
    // Validate required fields and types
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Output must be a JSON object');
    }
    
    // Validate sentiment is a number between 0 and 1
    if (typeof parsed.sentiment !== 'number' || parsed.sentiment < 0 || parsed.sentiment > 1) {
      parsed.sentiment = 0.5; // Default to neutral
    }
    
    // Validate topic is a string and not suspicious
    if (typeof parsed.topic !== 'string' || parsed.topic.length > 50) {
      parsed.topic = 'Unknown'; // Default topic
    }
    
    // Sanitize topic field
    parsed.topic = parsed.topic.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
    
    // Validate keywords is an array of 0-5 strings
    if (!Array.isArray(parsed.keywords)) {
      parsed.keywords = [];
    } else {
      // Sanitize and limit keywords (allow 0-5, including technical terms with special chars)
      parsed.keywords = parsed.keywords
        .filter(kw => typeof kw === 'string' && kw.length <= 30 && kw.length > 0)
        .map(kw => kw.replace(/[^a-zA-Z0-9\s\-_.]/g, '').trim())
        .filter(kw => kw.length > 0)
        .slice(0, 5); // Allow up to 5 keywords
      
      // No fallback to 'general' - empty arrays are valid
    }
    
    return parsed;
  } catch (error) {
    console.error('Output validation failed:', error);
    // Return safe default values
    return {
      sentiment: 0.5,
      topic: 'Unknown',
      keywords: []
    };
  }
}