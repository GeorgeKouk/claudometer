/**
 * CORS (Cross-Origin Resource Sharing) configuration utilities
 * Handles environment-based CORS headers for development and production
 */

/**
 * Gets appropriate CORS headers based on environment
 * @param {Object} env - Cloudflare Workers environment object
 * @returns {Object} CORS headers object
 */
export function getCorsHeaders(env = null) {
  // If env is provided, use dynamic headers; otherwise fallback to production
  if (env) {
    return getDynamicCorsHeaders(env);
  }
  return {
    'Access-Control-Allow-Origin': 'https://claudometer.app',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

/**
 * Generates dynamic CORS headers based on development mode setting
 * @param {Object} env - Cloudflare Workers environment object
 * @returns {Object} Environment-appropriate CORS headers
 */
export function getDynamicCorsHeaders(env) {
  // In development mode, allow localhost origins for testing
  if (env.DEV_MODE_ENABLED === 'true') {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
  }
  
  // Production: only allow claudometer.app
  return {
    'Access-Control-Allow-Origin': 'https://claudometer.app',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}