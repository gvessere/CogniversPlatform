/**
 * Utility functions for error handling
 */

/**
 * Formats any type of error into a user-friendly string message
 * 
 * @param error - The error to format
 * @param fallbackMessage - Optional fallback message if error can't be formatted
 * @returns Formatted error message string
 */
export function formatErrorMessage(error: unknown, fallbackMessage = 'An unexpected error occurred'): string {
  // If error is already a string, return it
  if (typeof error === 'string') {
    return error;
  }
  
  // Handle Error objects
  if (error instanceof Error) {
    return error.message;
  }
  
  // Handle axios or response error objects
  if (typeof error === 'object' && error !== null) {
    // @ts-ignore - we're checking for common error response patterns
    if (error.message) {
      // @ts-ignore
      return error.message;
    }
    
    // @ts-ignore
    if (error.detail) {
      // @ts-ignore
      return typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail);
    }
    
    // @ts-ignore
    if (error.msg) {
      // @ts-ignore
      return error.msg;
    }
    
    // Handle response error objects
    // @ts-ignore
    if (error.response?.data) {
      // @ts-ignore
      const data = error.response.data;
      
      if (typeof data === 'string') {
        return data;
      }
      
      if (typeof data === 'object') {
        if (data.detail) {
          return typeof data.detail === 'string' 
            ? data.detail 
            : Array.isArray(data.detail) 
              ? data.detail.map((d: any) => d.msg || String(d)).join('; ')
              : JSON.stringify(data.detail);
        }
        
        if (data.message) {
          return data.message;
        }
        
        // Try to stringify the entire object as a last resort
        try {
          return JSON.stringify(data);
        } catch (e) {
          // If we can't stringify it, use the fallback
          return fallbackMessage;
        }
      }
    }
  }
  
  // As a last resort, try to stringify the error
  try {
    return JSON.stringify(error);
  } catch (e) {
    // If we can't stringify it, use the fallback
    return fallbackMessage;
  }
}

/**
 * Safe error handler for async operations
 * 
 * @param error - The error caught in a catch block
 * @param setError - State setter function for error state
 * @param fallbackMessage - Optional fallback message
 * @param logError - Whether to log the error to console
 */
export function handleAsyncError(
  error: unknown, 
  setError: (message: string) => void, 
  fallbackMessage = 'An unexpected error occurred',
  logError = true
): void {
  if (logError) {
    console.error('Error caught:', error);
  }
  
  setError(formatErrorMessage(error, fallbackMessage));
} 