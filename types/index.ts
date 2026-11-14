export interface MockItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  tag?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface AIAnalysisResult {
  title: string;
  description: string;
  keyPoints?: string[];
  [key: string]: any;
}

export interface AIOptions<T = any> {
  systemPrompt?: string;
  schemaPrompt?: string;
  fallbackData?: T;
}

export interface AIResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
}

export * from './medlens';

