import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Link, Stack } from 'expo-router';
import { AlertCircle, ChevronLeft } from 'lucide-react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Không tìm thấy trang', headerShown: true }} />
      <View className="flex-1 items-center justify-center p-6 bg-[#F2F2F7]">
        <View className="size-16 items-center justify-center rounded-3xl bg-blue-50 mb-4">
          <AlertCircle size={32} color="#2563EB" />
        </View>
        <Text className="text-2xl font-bold tracking-tight text-zinc-900 text-center">
          Trang không tồn tại
        </Text>
        <Text className="text-sm text-zinc-500 text-center mt-2 mb-6 px-4">
          Đường dẫn bạn truy cập có thể đã bị thay đổi hoặc chưa được khởi tạo.
        </Text>

        <Link href="/" asChild>
          <Pressable className="flex-row items-center gap-1.5 rounded-2xl bg-blue-600 px-5 py-3 shadow-sm shadow-blue-500/20 active:opacity-90">
            <ChevronLeft size={18} color="#FFFFFF" />
            <Text className="text-sm font-semibold text-white">Quay về trang chủ</Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}
