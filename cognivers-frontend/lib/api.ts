import axios, { AxiosRequestConfig, AxiosResponse, AxiosError, AxiosInstance } from 'axios';
import { getToken } from './auth';
import { API_BASE_URL } from './config';
import { 
  User, 
  UserCreateData, 
  UserUpdateData, 
  Questionnaire, 
  QuestionnaireCreateData,
  Session,
  SessionCreateData,
  SessionUpdateData,
  QuestionnaireInstance,
  QuestionnaireInstanceCreateData,
  QuestionnaireInstanceUpdateData,
  ClientSessionEnrollment,
  ClientSessionEnrollmentCreateData
} from './types';

/**
 * API Call Pattern Documentation
 * 
 * This file implements a standardized pattern for making API calls in the application.
 * The pattern consists of three layers:
 * 
 * 1. Core API Functions:
 *    - callBackendApi: For server-side code to call the backend API directly
 *    - callFrontendApi: For client-side code to call the Next.js API routes
 * 
 * 2. Generic Helper Functions:
 *    - getData, postData, putData, patchData, deleteData: Simplified wrappers around callFrontendApi
 *    - These functions handle common CRUD operations with proper error handling
 * 
 * 3. Resource-Specific Functions:
 *    - getSessions, createSession, etc.: Domain-specific wrappers with proper typing
 *    - These functions provide a clean interface for components to interact with specific resources
 * 
 * Usage Guidelines:
 * - Components should use resource-specific functions when available (e.g., getSessions)
 * - For custom operations, components can use callFrontendApi directly
 * - Never use axios instances directly in components
 * - All API calls should include proper error handling
 * 
 * Benefits:
 * - Consistency: All API calls follow the same pattern
 * - Error Handling: Centralized error handling ensures consistent error responses
 * - Type Safety: Strong typing throughout the API call chain
 * - Maintainability: Changes to the underlying API call mechanism only need to be made in one place
 */

/**
 * Configuration options for creating an API client
 */
interface ApiClientOptions {
  baseURL: string;
  timeout?: number;
  addAuthHeader?: boolean;
  defaultHeaders?: Record<string, string>;
}

/**
 * Create an axios instance with standardized configuration and interceptors
 */
function createApiClient(options: ApiClientOptions): AxiosInstance {
  const {
    baseURL,
    timeout = 5000,
    addAuthHeader = false,
    defaultHeaders = { 'Content-Type': 'application/json' }
  } = options;
  
  // Create the axios instance
  const client = axios.create({
    baseURL,
    timeout,
    headers: defaultHeaders
  });
  
  // Add request interceptor
  client.interceptors.request.use(
    (config) => {
      // Log request details
      const logDetails = baseURL 
        ? `${baseURL}${config.url}` 
        : config.url;
      
      console.log(`API Request: ${logDetails}`, { 
        baseURL: config.baseURL,
        headers: config.headers
      });
      
      // Remove Content-Type header for GET requests
      if (config.method && config.method.toUpperCase() === 'GET') {
        config.headers.delete('Content-Type');
      }
      
      // Add auth header if needed
      if (addAuthHeader) {
        const token = getToken();
        if (token) {
          config.headers.set('Authorization', `Bearer ${token}`);
        }
      }
      
      return config;
    },
    (error) => Promise.reject(error)
  );
  
  // Add response interceptor
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      // Handle specific error status codes
      if (error.response) {
        const { status, data, config } = error.response;
        console.error(`API Error (${status}):`, {
          url: config.url,
          baseURL: config.baseURL,
          method: config.method,
          data: data,
          headers: config.headers
        });

        if (status === 401) {
          // Unauthorized - could redirect to login
          console.error('API Error: Authentication required');
        } else if (status === 403) {
          // Forbidden
          console.error('API Error: Not authorized to access this resource');
        } else if (status === 404) {
          // Not found
          console.error('API Error: Resource not found');
        } else if (status >= 500) {
          // Server errors
          console.error('API Error: Server error occurred');
        }
      } else if (error.request) {
        // Request made but no response received
        console.error('API Error: No response received from server', {
          request: error.request,
          config: error.config
        });
      } else {
        // Something else happened while setting up the request
        console.error('API Error:', error.message, error);
      }

      return Promise.reject(error);
    }
  );
  
  return client;
}

// Create API clients using the factory function
const _backendApiClient = createApiClient({
  baseURL: API_BASE_URL,
  addAuthHeader: true
});

const _frontendApiClient = createApiClient({
  baseURL: '',
  addAuthHeader: false
});

/**
 * Creates a standard config object with auth headers
 * @param token Optional token to use instead of getting from cookies
 * @param additionalConfig Additional axios config to merge
 * @returns AxiosRequestConfig with auth headers
 */
export function createAuthConfig(token?: string | null, additionalConfig: AxiosRequestConfig = {}): AxiosRequestConfig {
  // Use provided token or get from cookies
  const authToken = token || getToken();
  
  const config: AxiosRequestConfig = {
    ...additionalConfig
  };
  
  // Initialize headers if not present
  if (!config.headers) {
    config.headers = {};
  }
  
  // Set Content-Type by default, but remove it for GET requests
  const method = additionalConfig.method?.toUpperCase() || 'GET';
  if (method === 'GET') {
    // For GET requests, ensure Content-Type is not set
    delete config.headers['Content-Type'];
  } else {
    // For non-GET requests, ensure Content-Type is set
    config.headers['Content-Type'] = 'application/json';
  }
  
  // Add Authorization header if token exists
  if (authToken) {
    config.headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  return config;
}

/**
 * Creates fetch request options with auth headers
 * @param token Optional token to use instead of getting from cookies
 * @param options Additional fetch options to merge
 * @returns RequestInit with auth headers
 */
export function createFetchOptions(token?: string | null, options: RequestInit = {}): RequestInit {
  // Use provided token or get from cookies
  const authToken = token || getToken();
  
  // Initialize headers as a Record<string, string>
  const existingHeaders = options.headers || {};
  const headers: Record<string, string> = {};
  
  // Copy existing headers if they are in object form
  if (existingHeaders && typeof existingHeaders === 'object' && !Array.isArray(existingHeaders)) {
    Object.entries(existingHeaders).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers[key] = value;
      }
    });
  }
  
  // Set Content-Type by default, but remove it for GET requests
  const method = options.method?.toUpperCase() || 'GET';
  if (method === 'GET') {
    // For GET requests, ensure Content-Type is not set
    delete headers['Content-Type'];
  } else {
    // For non-GET requests, ensure Content-Type is set
    headers['Content-Type'] = 'application/json';
  }
  
  // Add Authorization header if token exists
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const config: RequestInit = {
    ...options,
    headers
  };
  
  return config;
}

/**
 * Enhanced error type with additional context
 */
export interface ApiError extends Error {
  status?: number;
  data?: any;
  isApiError: true;
  endpoint?: string;
  method?: string;
  response?: AxiosResponse;
}

/**
 * Create a standardized API error with additional context
 */
function createApiError(error: any, endpoint: string, method: string): ApiError {
  let apiError: ApiError;
  
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    const { status, data, headers } = error.response;
    const message = data?.detail || data?.message || `Error ${status}: API request failed`;
    
    // Special handling for 404 errors with a detail field - these are often expected conditions
    if (status === 404 && data?.detail) {
      console.log(`Expected 404 condition: ${data.detail}`);
    } else {
      // Log detailed response for other errors
      console.error(`Detailed API error response for ${endpoint}:`, {
        status,
        data,
        headers: headers || {},
        method,
        endpoint
      });
    }
    
    apiError = new Error(message) as ApiError;
    apiError.status = status;
    apiError.data = data;
    apiError.response = error.response; // Preserve the original response object
  } else if (error.request) {
    // The request was made but no response was received
    apiError = new Error('No response received from server. Please check your connection.') as ApiError;
  } else {
    // Something happened in setting up the request that triggered an Error
    apiError = new Error(`Request error: ${error.message}`) as ApiError;
  }
  
  // Set required properties for ApiError interface
  apiError.isApiError = true;
  apiError.endpoint = endpoint;
  apiError.method = method;
  
  return apiError;
}

/**
 * Configuration for retry logic
 */
interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay between retries in milliseconds (will be multiplied by 2^attempt for exponential backoff) */
  retryDelay: number;
  /** Status codes that should trigger a retry attempt */
  retryableStatusCodes: number[];
  /** 
   * Status codes that should NEVER be retried, regardless of whether they're in retryableStatusCodes.
   * These take precedence over retryableStatusCodes.
   * Common non-retryable codes:
   * - 400: Bad Request (client error, retrying with same data won't help)
   * - 401: Unauthorized (authentication issue, retrying won't help without new credentials)
   * - 403: Forbidden (authorization issue, retrying won't help without proper permissions)
   * - 404: Not Found (resource doesn't exist, retrying won't make it appear)
   * - 409: Conflict (resource state conflict, retrying same request won't resolve the conflict)
   * - 422: Unprocessable Entity (validation error, retrying same data won't pass validation)
   */
  nonRetryableStatusCodes: number[];
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  retryableStatusCodes: [408, 429, 502, 503, 504], // Timeout, Too Many Requests, and server errors
  nonRetryableStatusCodes: [400, 401, 403, 404, 422, 500] // Bad request, Unauthorized, Forbidden, Not Found, Unprocessable Entity
};

/**
 * Global retry configuration that can be customized application-wide
 */
export const GLOBAL_RETRY_CONFIG: RetryConfig = {
  ...DEFAULT_RETRY_CONFIG
};

/**
 * Resource-specific retry configurations
 */
export const RESOURCE_RETRY_CONFIGS: Record<string, Partial<RetryConfig>> = {
  // Example: More retries for critical operations
  sessions: {
    maxRetries: 5,
    retryDelay: 800,
    // Add specific non-retryable status codes for sessions
    nonRetryableStatusCodes: [400, 401, 403, 404, 409, 422] // Added 409 (Conflict)
  },
  // Example: Faster retries for user-facing operations
  questionnaires: {
    retryDelay: 500,
    // Add specific non-retryable status codes for questionnaires
    nonRetryableStatusCodes: [400, 401, 403, 404, 422]
  },
  // Example: Authentication-related operations
  auth: {
    maxRetries: 2,
    retryDelay: 500,
    // For auth, we don't want to retry on 401 (Unauthorized) or 403 (Forbidden)
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    nonRetryableStatusCodes: [400, 401, 403, 404, 422]
  },
  // Address-related operations
  address: {
    maxRetries: 1,
    retryDelay: 300,
    // For address endpoints, 404 is often an expected condition (no address found)
    // so we don't want to retry and log it as an error
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    nonRetryableStatusCodes: [400, 401, 403, 404, 422]
  }
};

/**
 * Get the appropriate retry configuration by merging defaults with overrides
 * @param resource Optional resource name to use resource-specific defaults
 * @param overrides Optional custom overrides for this specific call
 * @returns Merged retry configuration
 */
function getRetryConfig(resource?: string, overrides?: Partial<RetryConfig>): RetryConfig {
  // Start with the global config
  const config = { ...GLOBAL_RETRY_CONFIG };
  
  // Apply resource-specific overrides if available
  if (resource && RESOURCE_RETRY_CONFIGS[resource]) {
    Object.assign(config, RESOURCE_RETRY_CONFIGS[resource]);
  }
  
  // Apply call-specific overrides if available
  if (overrides) {
    // Special handling for arrays to ensure they are replaced, not merged
    if (overrides.retryableStatusCodes) {
      config.retryableStatusCodes = [...overrides.retryableStatusCodes];
    }
    
    if (overrides.nonRetryableStatusCodes) {
      config.nonRetryableStatusCodes = [...overrides.nonRetryableStatusCodes];
    }
    
    // Apply other overrides
    Object.assign(config, {
      ...overrides,
      // Exclude arrays that we've already handled
      retryableStatusCodes: config.retryableStatusCodes,
      nonRetryableStatusCodes: config.nonRetryableStatusCodes
    });
  }
  
  return config;
}

/**
 * Determines if an error should be retried based on its status code
 */
function isRetryableError(error: any, retryableStatusCodes: number[], nonRetryableStatusCodes: number[]): boolean {
  // If we have a response with a status code
  if (error.response && error.response.status) {
    const status = error.response.status;
    
    // Never retry if the status code is in the non-retryable list
    if (nonRetryableStatusCodes.includes(status)) {
      return false;
    }
    
    // Only retry if the status code is in the retryable list
    return retryableStatusCodes.includes(status);
  }
  
  // Network errors (no response) are always retryable
  if (error.request && !error.response) {
    return true;
  }
  
  return false;
}

/**
 * Options for the callApi function
 */
interface CallApiOptions {
  token?: string | null;
  retryConfig?: Partial<RetryConfig>;
  resource?: string;
  isPublicPage?: boolean;
}

/**
 * Core API call function that handles both frontend and backend API calls
 * @param client The axios instance to use
 * @param endpoint The API endpoint path
 * @param method HTTP method
 * @param data Optional request body data
 * @param options Additional options including token and retry config
 * @returns Promise with the response data
 * @throws ApiError with enhanced error information
 */
async function callApi<T = any, D = any>(
  client: AxiosInstance,
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  data?: D,
  options: CallApiOptions = {}
): Promise<T> {
  const { token, retryConfig, resource, isPublicPage } = options;
  
  // Get the appropriate retry configuration
  const config = getRetryConfig(resource, retryConfig);
  
  // Create request config based on whether we need auth or not
  const requestConfig = token !== undefined
    ? createAuthConfig(token, { method, ...(data && { data }) })
    : { method, url: endpoint, ...(data && { data }) };
  
  let lastError: any;
  
  // Try the request up to maxRetries + 1 times
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await client(endpoint, requestConfig);
      return response.data;
    } catch (error: any) {
      lastError = error;
      
      // Check if this is an expected 404 error with a detail field
      if (method === 'GET' && 
          error.response?.status === 404 && 
          error.response?.data?.detail) {
        console.log(`Expected 404 condition for ${endpoint}: ${error.response.data.detail}`);
        
        // For expected 404 errors, return a special result that components can check
        return {
          __isExpected404Error: true,
          status: 404,
          detail: error.response.data.detail,
          error: error
        } as unknown as T;
      }
      
      // Special handling for 401 errors on public pages
      if (method === 'GET' && 
          error.response?.status === 401 && 
          isPublicPage) {
        console.log(`Expected 401 condition for ${endpoint} on public page`);
        
        // For expected 401 errors on public pages, return a special result
        return {
          __isExpected401Error: true,
          status: 401,
          detail: 'Not authenticated on public page',
          error: error
        } as unknown as T;
      }
      
      // Enhanced error logging
      console.error(`Error in API call to ${endpoint} (attempt ${attempt + 1}/${config.maxRetries + 1}):`, error);
      
      // Log detailed response information for debugging
      if (error.response) {
        const { status, data, headers } = error.response;
        console.error(`Response details for ${endpoint}:`, {
          status,
          data,
          headers: headers || {},
          url: endpoint,
          method
        });
      }
      
      // Check if we should retry
      const shouldRetry = 
        attempt < config.maxRetries && 
        isRetryableError(error, config.retryableStatusCodes, config.nonRetryableStatusCodes);
      
      if (shouldRetry) {
        // Wait before retrying
        const delay = config.retryDelay * Math.pow(2, attempt); // Exponential backoff
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      } else if (attempt < config.maxRetries) {
        // We're not retrying, but we haven't exhausted retries yet, so explain why
        if (error.response && error.response.status) {
          const status = error.response.status;
          if (config.nonRetryableStatusCodes.includes(status)) {
            console.log(`Not retrying: Status code ${status} is in the non-retryable list.`);
          } else if (!config.retryableStatusCodes.includes(status)) {
            console.log(`Not retrying: Status code ${status} is not in the retryable list.`);
          }
        } else if (!error.request || error.response) {
          console.log(`Not retrying: Error is not a network error or doesn't have a response.`);
        }
      }
      
      // If we shouldn't retry, or we've exhausted retries, throw enhanced error
      const apiError = createApiError(error, endpoint, method);
      throw apiError;
    }
  }
  
  // This should never be reached due to the throw in the catch block,
  // but TypeScript requires a return statement
  const apiError = createApiError(lastError, endpoint, method);
  throw apiError;
}

/**
 * Helper function to make API calls directly to the backend API with retry logic
 * This is intended for server-side code to call the backend API
 * @param endpoint The backend API endpoint path (without the base URL)
 * @param method HTTP method
 * @param data Optional request body data
 * @param token Optional auth token
 * @param options Optional configuration including retry settings and resource name
 * @returns Promise with the response data
 * @throws ApiError with enhanced error information
 */
export async function callBackendApi<T = any, D = any>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  data?: D,
  token?: string | null,
  options?: { retryConfig?: Partial<RetryConfig>; resource?: string }
): Promise<T> {
  const { retryConfig, resource } = options || {};
  return callApi<T, D>(
    _backendApiClient, 
    endpoint, 
      method,
    data, 
    { token, retryConfig, resource }
  );
}

/**
 * Helper function to make API calls to frontend API routes with retry logic
 * This is intended for client-side code to call the frontend API routes
 * @param endpoint The frontend API route path
 * @param method HTTP method
 * @param data Optional request body data
 * @param options Optional configuration including retry settings and resource name
 * @returns Promise with the response data
 * @throws ApiError with enhanced error information
 */
export async function callFrontendApi<T = any, D = any>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  data?: D,
  options?: { retryConfig?: Partial<RetryConfig>; resource?: string; isPublicPage?: boolean }
): Promise<T> {
  const { retryConfig, resource, isPublicPage } = options || {};
  return callApi<T, D>(
    _frontendApiClient, 
    endpoint, 
    method, 
    data, 
    { retryConfig, resource, isPublicPage }
  );
}

// Helper function to determine which client to use based on URL - now private
function _getClient(url: string) {
  return url.startsWith('/api/') ? _frontendApiClient : _backendApiClient;
}

// Generic GET function with type parameter
export async function getData<T>(
  url: string,
  options?: { retryConfig?: Partial<RetryConfig>; resource?: string }
): Promise<T> {
  try {
    // Automatically set resource to 'address' for address endpoints
    if (url.includes('/address/') && (!options || !options.resource)) {
      options = { ...options, resource: 'address' };
    }
    
    return await callFrontendApi<T>(url, 'GET', undefined, options);
  } catch (error: any) {
    // For other errors, log and rethrow
    console.error(`Error fetching data from ${url}:`, error);
    throw error;
  }
}

// Generic POST function with type parameters
export async function postData<T, D = any>(
  url: string,
  data: D,
  options?: { retryConfig?: Partial<RetryConfig>; resource?: string }
): Promise<T> {
  try {
    return await callFrontendApi<T>(url, 'POST', data, options);
  } catch (error) {
    console.error(`Error posting data to ${url}:`, error);
    throw error;
  }
}

// Generic PUT function with type parameters
export async function putData<T, D = any>(
  url: string,
  data: D,
  options?: { retryConfig?: Partial<RetryConfig>; resource?: string }
): Promise<T> {
  try {
    return await callFrontendApi<T>(url, 'PUT', data, options);
  } catch (error) {
    console.error(`Error updating data at ${url}:`, error);
    throw error;
  }
}

// Generic PATCH function with type parameters
export async function patchData<T, D = any>(
  url: string,
  data: D,
  options?: { retryConfig?: Partial<RetryConfig>; resource?: string }
): Promise<T> {
  try {
    return await callFrontendApi<T>(url, 'PATCH', data, options);
  } catch (error) {
    console.error(`Error patching data at ${url}:`, error);
    throw error;
  }
}

// Generic DELETE function with type parameters
export async function deleteData<T>(
  url: string,
  options?: { retryConfig?: Partial<RetryConfig>; resource?: string }
): Promise<T> {
  try {
    return await callFrontendApi<T>(url, 'DELETE', undefined, options);
  } catch (error) {
    console.error(`Error deleting data at ${url}:`, error);
    throw error;
  }
}

/**
 * Handle API errors in a consistent way
 * @param error Error object, potentially an ApiError
 * @throws Error with appropriate message
 */
function handleApiError(error: any): never {
  // If it's already an ApiError, we can use its properties directly
  if (error.isApiError) {
    const apiError = error as ApiError;
    
    if (apiError.status === 401) {
      throw new Error('Unauthorized: Please log in again');
    } else if (apiError.status === 403) {
      throw new Error('Forbidden: You do not have permission to perform this action');
    } else if (apiError.status === 404) {
      throw new Error('Not found: The requested resource does not exist');
    } else if (apiError.status) {
      // Use the message that was already created in createApiError
      throw new Error(apiError.message);
    } else {
      // Network or other error
      throw new Error(apiError.message || 'An unknown error occurred');
    }
  } else if (error.response) {
    // Fallback for AxiosError handling (should not happen with our architecture)
    const status = error.response.status;
    const data = error.response.data as any;
    
    if (status === 401) {
      throw new Error('Unauthorized: Please log in again');
    } else if (status === 403) {
      throw new Error('Forbidden: You do not have permission to perform this action');
    } else if (status === 404) {
      throw new Error('Not found: The requested resource does not exist');
    } else {
      // Try to get a detailed error message from the response
      const message = data?.detail || data?.message || 'An error occurred';
      throw new Error(`Error ${status}: ${message}`);
    }
  } else if (error.request) {
    // The request was made but no response was received
    throw new Error('No response received from server. Please check your connection.');
  } else {
    // Something happened in setting up the request that triggered an Error
    throw new Error(`Error: ${error.message || 'An unknown error occurred'}`);
  }
}

// ==================== Session API Functions ====================

/**
 * Get all sessions
 * @returns Promise with sessions array
 */
export const getSessions = async (): Promise<Session[]> => {
  try {
    return await callFrontendApi<Session[]>('/api/sessions', 'GET', undefined, { resource: 'sessions' });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    handleApiError(error);
    throw error;
  }
};

/**
 * Get a session by ID
 * @param id Session ID
 * @returns Promise with session data
 */
export const getSession = async (id: number): Promise<Session> => {
  try {
    return await callFrontendApi<Session>(`/api/sessions/${id}`, 'GET', undefined, { resource: 'sessions' });
  } catch (error) {
    console.error(`Error fetching session ${id}:`, error);
    handleApiError(error);
    throw error;
  }
};

/**
 * Create a new session
 * @param sessionData Session data to create
 * @returns Promise with created session
 */
export const createSession = async (sessionData: Partial<Session>): Promise<Session> => {
  try {
    return await callFrontendApi<Session>('/api/sessions', 'POST', sessionData, { resource: 'sessions' });
  } catch (error) {
    console.error('Error creating session:', error);
    handleApiError(error);
    throw error;
  }
};

/**
 * Update a session
 * @param id Session ID
 * @param sessionData Session data to update
 * @returns Promise with updated session
 */
export const updateSession = async (id: number, sessionData: Partial<Session>): Promise<Session> => {
  try {
    return await callFrontendApi<Session>(`/api/sessions/${id}`, 'PUT', sessionData, { resource: 'sessions' });
  } catch (error) {
    console.error(`Error updating session ${id}:`, error);
    handleApiError(error);
    throw error;
  }
};

/**
 * Delete a session
 * @param id Session ID
 * @returns Promise with success message
 */
export const deleteSession = async (id: number): Promise<void> => {
  try {
    await callFrontendApi<void>(`/api/sessions/${id}`, 'DELETE', undefined, { resource: 'sessions' });
  } catch (error) {
    console.error(`Error deleting session ${id}:`, error);
    handleApiError(error);
    throw error;
  }
};

// ==================== Questionnaire Instance API Functions ====================

/**
 * Get questionnaire instances for a session
 * @param sessionId Session ID
 * @returns Promise with questionnaire instances array
 */
export const getQuestionnaireInstances = async (sessionId: number): Promise<QuestionnaireInstance[]> => {
  try {
    return await callFrontendApi<QuestionnaireInstance[]>(
      `/api/sessions/${sessionId}/questionnaires`, 
      'GET', 
      undefined, 
      { resource: 'questionnaires' }
    );
  } catch (error) {
    console.error(`Error fetching questionnaire instances for session ${sessionId}:`, error);
    handleApiError(error);
    throw error;
  }
};

/**
 * Create a new questionnaire instance
 * @param instanceData Questionnaire instance data to create
 * @returns Promise with created questionnaire instance
 */
export const createQuestionnaireInstance = async (
  sessionId: number, 
  instanceData: Partial<QuestionnaireInstance>
): Promise<QuestionnaireInstance> => {
  try {
    return await callFrontendApi<QuestionnaireInstance>(
      `/api/sessions/${sessionId}/questionnaires`, 
      'POST', 
      instanceData, 
      { resource: 'questionnaires' }
    );
  } catch (error) {
    console.error(`Error creating questionnaire instance for session ${sessionId}:`, error);
    handleApiError(error);
    throw error;
  }
};

/**
 * Update a questionnaire instance
 * @param id Questionnaire instance ID
 * @param instanceData Questionnaire instance data to update
 * @returns Promise with updated questionnaire instance
 */
export const updateQuestionnaireInstance = async (
  instanceId: number, 
  instanceData: Partial<QuestionnaireInstance>
): Promise<QuestionnaireInstance> => {
  try {
    return await callFrontendApi<QuestionnaireInstance>(
      `/api/sessions/questionnaires/${instanceId}`, 
      'PUT', 
      instanceData, 
      { resource: 'questionnaires' }
    );
  } catch (error) {
    console.error(`Error updating questionnaire instance ${instanceId}:`, error);
    handleApiError(error);
    throw error;
  }
};

/**
 * Delete a questionnaire instance
 * @param id Questionnaire instance ID
 * @returns Promise with success message
 */
export const deleteQuestionnaireInstance = async (instanceId: number): Promise<void> => {
  try {
    await callFrontendApi<void>(
      `/api/sessions/questionnaires/${instanceId}`, 
      'DELETE', 
      undefined, 
      { resource: 'questionnaires' }
    );
  } catch (error) {
    console.error(`Error deleting questionnaire instance ${instanceId}:`, error);
    handleApiError(error);
    throw error;
  }
};

/**
 * Activate a questionnaire instance
 * @param id Questionnaire instance ID
 * @returns Promise with updated questionnaire instance
 */
export const activateQuestionnaireInstance = async (instanceId: number): Promise<QuestionnaireInstance> => {
  try {
    return await callFrontendApi<QuestionnaireInstance>(
      `/api/sessions/questionnaires/actions/activate?sessionId=${instanceId}`, 
      'POST', 
      undefined, 
      { resource: 'questionnaires' }
    );
  } catch (error) {
    console.error(`Error activating questionnaire instance ${instanceId}:`, error);
    handleApiError(error);
    throw error;
  }
};

/**
 * Deactivate a questionnaire instance
 * @param id Questionnaire instance ID
 * @returns Promise with updated questionnaire instance
 */
export const deactivateQuestionnaireInstance = async (instanceId: number): Promise<QuestionnaireInstance> => {
  try {
    return await callFrontendApi<QuestionnaireInstance>(
      `/api/sessions/questionnaires/actions/deactivate?sessionId=${instanceId}`, 
      'POST', 
      undefined, 
      { resource: 'questionnaires' }
    );
  } catch (error) {
    console.error(`Error deactivating questionnaire instance ${instanceId}:`, error);
    handleApiError(error);
    throw error;
  }
};

/**
 * Check if a questionnaire is attached to any sessions
 * @param questionnaireId Questionnaire ID
 * @returns Promise with attachment status
 */
export const isQuestionnaireAttachedToSessions = async (questionnaireId: number): Promise<boolean> => {
  try {
    const response = await callFrontendApi<{ is_attached: boolean }>(
      `/api/sessions/questionnaire/${questionnaireId}/check`, 
      'GET', 
      undefined, 
      { resource: 'questionnaires' }
    );
    return response.is_attached;
  } catch (error) {
    console.error(`Error checking if questionnaire ${questionnaireId} is attached to sessions:`, error);
    handleApiError(error);
    throw error;
  }
};

// ==================== User API Functions ====================

/**
 * Get all trainers (users with TRAINER or ADMINISTRATOR role)
 * @returns Promise with trainers array
 */
export const getTrainers = async (): Promise<User[]> => {
  try {
    // Use the role query parameter to filter users by role
    return await callFrontendApi<User[]>('/api/users/trainers', 'GET', undefined, { resource: 'users' });
  } catch (error) {
    console.error('Error fetching trainers:', error);
    handleApiError(error);
    throw error;
  }
};

/**
 * Get a questionnaire by ID
 * @param id Questionnaire ID
 * @returns Promise with questionnaire data
 */
export const getQuestionnaire = async (id: number): Promise<any> => {
  try {
    return await callFrontendApi(
      `/api/questionnaires/${id}`,
      'GET',
      null,
      { resource: 'questionnaires' }
    );
  } catch (error) {
    console.error(`Error fetching questionnaire ${id}:`, error);
    handleApiError(error);
    throw error;
  }
};

/**
 * Update a questionnaire
 * @param id Questionnaire ID
 * @param questionnaireData Questionnaire data to update
 * @returns Promise with update result
 */
export const updateQuestionnaire = async (
  id: number,
  questionnaireData: any
): Promise<any> => {
  try {
    return await callFrontendApi(
      `/api/questionnaires/${id}/update`,
      'PATCH',
      questionnaireData,
      { resource: 'questionnaires' }
    );
  } catch (error) {
    console.error(`Error updating questionnaire ${id}:`, error);
    handleApiError(error);
    throw error;
  }
};

// Client Session Enrollment API functions
export async function enrollClientInSession(
  sessionId: number,
  data: ClientSessionEnrollmentCreateData
): Promise<ClientSessionEnrollment> {
  return postData(`/sessions/${sessionId}/enrollments`, data);
}

export async function getSessionEnrollments(sessionId: number): Promise<ClientSessionEnrollment[]> {
  return getData(`/sessions/${sessionId}/enrollments`);
}

export async function getClientEnrollments(clientId: number): Promise<ClientSessionEnrollment[]> {
  try {
    return await callFrontendApi<ClientSessionEnrollment[]>(
      `/api/sessions/client/${clientId}/enrollments`, 
      'GET', 
      undefined, 
      { resource: 'sessions' }
    );
  } catch (error) {
    console.error(`Error getting client enrollments for client ${clientId}:`, error);
    handleApiError(error);
    throw error;
  }
}

/**
 * Generate a new session code
 * @param sessionId Session ID
 * @returns Promise with updated session
 */
export const generateSessionCode = async (sessionId: number): Promise<Session> => {
  try {
    return await callFrontendApi<Session>(
      `/api/sessions/${sessionId}/generate-code`, 
      'POST', 
      undefined, 
      { resource: 'sessions' }
    );
  } catch (error) {
    console.error(`Error generating session code for session ${sessionId}:`, error);
    handleApiError(error);
    throw error;
  }
};

/**
 * Enroll in a session using a session code
 * @param code Session code
 * @returns Promise with enrollment data
 */
export const enroll = async (code: string): Promise<ClientSessionEnrollment> => {
  try {
    return await callFrontendApi<ClientSessionEnrollment>(
      `/api/sessions/enroll`, 
      'POST', 
      { session_code: code }, 
      { resource: 'sessions' }
    );
  } catch (error) {
    console.error(`Error enrolling in session with code ${code}:`, error);
    handleApiError(error);
    throw error;
  }
};

/**
 * Get available sessions for a client (visible sessions)
 * @returns Promise with sessions array
 */
export const getAvailableSessions = async (): Promise<Session[]> => {
  try {
    return await callFrontendApi<Session[]>(
      '/api/sessions', 
      'GET', 
      undefined, 
      { resource: 'sessions' }
    );
  } catch (error) {
    console.error('Error getting available sessions:', error);
    handleApiError(error);
    throw error;
  }
};

// No longer exporting any axios instances
export default {}; 