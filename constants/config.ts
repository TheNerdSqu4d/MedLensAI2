/**
 * Cấu hình hệ thống Zero-Config (An toàn commit lên Git)
 * Khi bạn tạo project trên supabase.com, chỉ cần dán URL và Anon Key vào đây.
 */
export const SUPABASE_CONFIG = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://pvswmyrwmcqaslearnhd.supabase.co',
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_fV6UcFuhSYi0tdtCViPwug_P_QPuBIE',
};

export const APP_CONFIG = {
  appName: 'MedLensAI',
  defaultTheme: 'light', // Apple Light Grouped Mode
};
