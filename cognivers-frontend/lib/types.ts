/**
 * Common interface definitions used throughout the application
 */

// User related types
export enum UserRole {
  CLIENT = 'Client',
  TRAINER = 'Trainer',
  ADMINISTRATOR = 'Administrator'
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  dob?: string | null;
  supervisor?: string | null;
  sessions?: ClientSessionInfo[];
  [key: string]: any; // For additional properties
}

export interface UserCreateData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  dob?: string | null;
}

export interface UserUpdateData {
  first_name?: string;
  last_name?: string;
  role?: UserRole;
  dob?: string | null;
  supervisor?: string | null;
  current_password?: string;
  new_password?: string;
}

// Questionnaire related types
export interface Question {
  id: number;
  question_text: string;
  question_type: 'TEXT' | 'MULTIPLE_CHOICE' | 'SINGLE_CHOICE' | 'SCALE' | 'DATE';
  options?: string[];
  is_required: boolean;
  order: number;
}

export interface Questionnaire {
  id: number;
  title: string;
  description: string;
  created_by: number;
  created_at: string;
  questions: Question[];
}

export interface QuestionnaireCreateData {
  title: string;
  description: string;
  questions: Omit<Question, 'id'>[];
}

// Session related types
export interface Session {
  id: number;
  title: string;
  description: string;
  start_date: string; // YYYY-MM-DD format
  end_date: string; // YYYY-MM-DD format
  created_at: string;
  updated_at: string;
  created_by_id: number;
  trainer_id: number;
  trainer_name?: string;
  is_public: boolean;
  session_code?: string;
}

export interface SessionCreateData {
  title: string;
  description: string;
  start_date: string; // YYYY-MM-DD format
  end_date: string; // YYYY-MM-DD format
  trainer_id: number;
  is_public?: boolean;
}

export interface SessionUpdateData {
  title?: string;
  description?: string;
  start_date?: string; // YYYY-MM-DD format
  end_date?: string; // YYYY-MM-DD format
  trainer_id?: number;
  is_public?: boolean;
  session_code?: string;
}

export interface QuestionnaireInstance {
  id: number;
  title: string;
  questionnaire_id: number;
  session_id: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  questionnaire_title?: string;
}

export interface QuestionnaireInstanceCreateData {
  title: string;
  questionnaire_id: number;
  session_id: number;
  is_active: boolean;
}

export interface QuestionnaireInstanceUpdateData {
  title?: string;
  is_active?: boolean;
}

// Response related types
export interface QuestionResponse {
  question_id: number;
  response_text: string;
}

export interface QuestionnaireResponse {
  questionnaire_id: number;
  responses: QuestionResponse[];
}

// Pagination interfaces
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// Client Session Enrollment related types
export interface ClientSessionEnrollment {
  id: number;
  client_id: number;
  session_id: number;
  status: string;
  enrolled_at: string;
  client_name?: string;
  session_title?: string;
}

export interface ClientSessionEnrollmentCreateData {
  client_id: number;
  session_id: number;
  status?: string;
}

export interface ClientSessionInfo {
  session_id: number;
  session_name: string;
  status: SessionStatus;
  enrolled_at: string;
  trainer_id: number;
  trainer_name: string;
}

export enum SessionStatus {
  ACTIVE = "active",
  COMPLETED = "completed",
  CANCELLED = "cancelled"
}

// Processor related types
export interface Processor {
  id: number;
  name: string;
  description: string;
  prompt_template: string;
  post_processing_code?: string;
  interpreter: 'python' | 'javascript' | 'none';
  status: 'active' | 'inactive' | 'testing';
  created_at: string;
  updated_at: string;
  created_by_id: number;
  llm_model?: string;
  llm_temperature?: number;
  llm_max_tokens?: number;
  llm_stop_sequences?: string[];
  llm_system_prompt?: string;
}

export interface ProcessingResult {
  id: number;
  questionnaire_response_id: number;
  processor_id: number;
  processor_version: string;
  raw_output: string;
  processed_output?: Record<string, any>;
  status: 'completed' | 'failed' | 'processing';
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface QuestionnaireProcessorMapping {
  id: number;
  questionnaire_id: number;
  processor_id: number;
  is_active: boolean;
  created_at: string;
} 