import { useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { askAI } from '@/services/ai';
import { AIAnalysisResult, AIOptions } from '@/types';

/**
 * Hook gọi AI hỗ trợ Generic type <T>
 * Mặc định T = AIAnalysisResult ({ title, description, keyPoints }).
 * Khi gặp đề bài mới, có thể gọi useAI<MyCustomType>({ schemaPrompt: '...' })
 */
export function useAI<T = AIAnalysisResult>(defaultOptions?: AIOptions<T> | string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(
    async (prompt: string, overrideOptions?: AIOptions<T> | string) => {
      if (!prompt.trim()) return null;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLoading(true);
      setError(null);

      try {
        const mergedOptions: AIOptions<T> | string | undefined =
          typeof overrideOptions === 'object'
            ? overrideOptions
            : typeof overrideOptions === 'string'
            ? { systemPrompt: overrideOptions }
            : typeof defaultOptions === 'object'
            ? defaultOptions
            : typeof defaultOptions === 'string'
            ? { systemPrompt: defaultOptions }
            : undefined;

        const result = await askAI<T>(prompt, mergedOptions);
        setData(result);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return result;
      } catch (err: any) {
        setError(err.message || 'Lỗi xử lý AI');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [defaultOptions]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    loading,
    data,
    error,
    ask,
    reset,
  };
}
