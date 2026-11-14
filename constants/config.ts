/**
 * Cấu hình hệ thống Zero-Config (An toàn commit lên Git)
 * Khi bạn tạo project trên supabase.com, chỉ cần dán URL và Anon Key vào đây.
 */
export const SUPABASE_CONFIG = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://vlaqqwizwcbigyfvbmff.supabase.co',
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_foB0bAWjJw3v3bStAfVkJg_bV6TH7Mw',
};

export const APP_CONFIG = {
  appName: 'MedLensAI',
  defaultTheme: 'light', // Apple Light Grouped Mode
};
