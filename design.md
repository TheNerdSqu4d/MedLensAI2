# MEDLENS — SPECIFICATION & ARCHITECTURE DOCUMENT (design.md)
*Hệ thống trợ lý toa thuốc thông minh, lịch uống an toàn 1 chạm và kiểm tra tương tác thuốc hai lớp chuẩn y khoa.*

---

## 1. TỔNG QUAN DỰ ÁN (PROJECT OVERVIEW)

- **Tên sản phẩm:** **MedLens** (Trợ Lý Toa Thuốc & Lịch Uống An Toàn 1 Chạm)
- **Tagline:** *"Quét toa và vỉ thuốc trong 3 giây — Tự động xếp lịch uống an toàn chuẩn y khoa, bảo vệ trọn vẹn gia đình."*
- **Đối tượng người dùng mục tiêu (Target User):**
  - **Người trưởng thành 25–50 tuổi — Thế hệ trụ cột gia đình (The Sandwich Generation)**.
  - **Lý do lựa chọn tệp khách hàng:**
    1. Độ tuổi bận rộn với công việc, thường xuyên quên lịch uống thuốc của bản thân.
    2. Là trụ cột gia đình, "kẹp" giữa trách nhiệm nuôi dạy con nhỏ và phụng dưỡng cha mẹ cao tuổi mắc các bệnh mãn tính (tăng huyết áp, tiểu đường, dạ dày...).
    3. Thường xuyên là người trực tiếp đưa đón, đi mua thuốc cho cả gia đình, nắm rõ đơn thuốc và trực tiếp chi trả.
    4. Trẻ nhỏ thiếu tính tự giác; người cao tuổi gặp rào cản công nghệ lớn (không quen dùng smartphone, chụp ảnh mờ). Do đó, nhóm 25–50 tuổi là người vận hành chính (Primary Operator & Buyer) để bảo vệ sức khỏe cho cả gia đình (Beneficiaries).
- **Trọng tâm chấm điểm Hackathon:**
  - **Bài toán cốt lõi (35 điểm - Vấn đề thật):** Giải tỏa nỗi âu lo chăm sóc từ xa (*Remote Care Anxiety*) của thế hệ trụ cột gia đình; chấm dứt tình trạng đơn thuốc viết tay khó đọc, nhầm lẫn cữ uống và quên cữ điều trị.
  - **Cam kết kỹ thuật (40 điểm - Demo thật):**
    - Không chatbot rườm rà — nhận diện thông minh đa luồng bằng Camera / Thư viện ảnh hoặc bộ 3 Preset Mẫu Demo 1-chạm.
    - **Phân tách 3 Luồng AI riêng biệt:** Xử lý toàn diện trường hợp Quét thất bại (chữ xấu/mờ), Quét đơn thuốc (cho phép chỉnh sửa) và Quét vỉ/hộp thuốc lẻ (bóc tách xuất xứ & liều).
    - **Kill App Test 100%:** Tắt hẳn ứng dụng (vuốt tắt trên iOS/Android) rồi mở lại, toàn bộ tiến độ uống và danh sách thuốc hôm nay vẫn nguyên vẹn.
    - **Zero-Crash Resilient Architecture:** Tự động kích hoạt Mock Data Fallback ngay khi mất mạng hoặc AI Edge Function timeout.

---

## 2. NGÔN NGỮ THIẾT KẾ & HỆ THỐNG UI/UX (APPLE FLUID MINIMAL - UNSLOPPED)

Tuân thủ nghiêm ngặt theo **AGENTS.md** của dự án:
- **Visual Anchors (Chuẩn so sánh thực tế):**
  - Tab 1 Lịch: **Apple Health (Medications) & Apple Reminders**.
  - Tab 2 Quét: **iOS Camera Viewfinder & Apple Health Records**.
  - Tab 3 Tủ thuốc: **Apple Stocks / iOS Inset Grouped TableView**.
  - Màn hình Settings: **iOS Settings TableView**.
- **Chế độ hiển thị duy nhất:** **Apple Light Grouped Mode**
  - Nền toàn ứng dụng: `#F2F2F7` (System Grouped Background chuẩn iOS).
  - Thẻ nội dung (Cards): `#FFFFFF` với bo góc mềm `rounded-3xl` hoặc `rounded-2xl`, viền siêu mỏng `border border-slate-200/60` và shadow thanh lịch `shadow-2xs`.
  - Màu sắc chủ đạo: Apple Blue (`#2563EB`), Success Emerald (`#059669`), Warning Amber (`#D97706`), Neutral Slate (`#475569`, `#0F172A`).
- **Typography:** SF Pro phong cách Apple (Large Title 28–32pt Bold, Headline 17pt SemiBold, Subhead 13–15pt, Footnote 12pt).
- **Anti-Slop Prohibitions:**
  - Cấm greeting sáo rỗng (`Xin chào...`). Dùng Large Title rõ ràng + Pill Selector chọn hồ sơ.
  - Cấm nút tròn pastel spam. Dùng Pill Filter capsule chips (`rounded-full px-4 py-2`).
  - Cấm gạch đầu dòng (`-`) trong thẻ. Dùng Inset Rows hoặc Metric Cards.
  - Cấm checkbox vuông Web. Dùng iOS Circle Checkmark (`rounded-full border-2`).
- **Tương tác xúc giác (Haptic Feedback):**
  - Chạm tick cữ thuốc: `Haptics.notificationAsync(Success)`
  - Chuyển tab hoặc chạm thẻ: `Haptics.impactAsync(Light)`
  - Cảnh báo tương tác thuốc nguy hiểm: `Haptics.notificationAsync(Warning)`

---

## 3. KIẾN TRÚC ĐIỀU HƯỚNG & CÁC MÀN HÌNH CHÍNH (NAVIGATION & SCREENS)

Ứng dụng sử dụng cấu trúc **Bottom Tabs** gồm 3 tab cốt lõi:

```text
app/
├── (tabs)/
│   ├── _layout.tsx         # Bottom Tab Bar chuẩn Apple (Lucide Icons, haptic feedback)
│   ├── index.tsx           # TAB 1: Lịch Uống Thuốc (Chế độ Hôm nay / Tuần này, 1-touch dose slots)
│   ├── scan.tsx            # TAB 2: Quét Toa (Kính ngắm sạch, laser scan, 3 luồng kết quả)
│   └── cabinet.tsx         # TAB 3: Tủ Thuốc Gia Đình (Pill filters, thẻ thuốc Inset Card)
├── modal/
│   └── medicine-detail.tsx # Modal xem chi tiết thuốc (hoạt chất, liều dùng, lưu ý)
├── settings.tsx            # Hồ sơ gia đình, phạm vi thông báo, nút đăng xuất
└── _layout.tsx             # Root layout (QueryClientProvider, SafeAreaProvider, StatusBar)
```

### 3.1. Tab 1: Lịch Uống Thuốc (`app/(tabs)/index.tsx`)
- **Large Title Header:** "Lịch Uống Thuốc" + Pill Selector người thân: `{activeMember.name} ({activeMember.relation}) ▾` mở Action Sheet chọn hồ sơ gia đình (*Tâm, Bố Tuấn, Mẹ Lan, Bé Bắp*). Nút Avatar góc phải dẫn vào Settings.
- **Segmented Control iOS:** Nền kính `bg-slate-200/80 p-1 rounded-2xl` chuyển đổi mượt mà giữa **`Hôm nay`** và **`Tuần này`**.
- **Chế độ Hôm nay:**
  - Thẻ tiến độ tuân thủ: `"Đã uống X/Y cữ hôm nay"`, thanh bar tỉ lệ phần trăm, badge trạng thái.
  - Danh sách cữ thuốc (Sáng 08:00, Trưa 12:30, Tối 20:00): Thẻ Inset Grouped, nút tròn 1-touch toggle (tick một chạm hoàn thành cả cữ kèm rung Haptic Success).
  - Thuốc trong cữ: Tên biệt dược in đậm, hoạt chất, chỉ dẫn bữa ăn.
- **Chế độ Tuần này:**
  - Ma trận tuân thủ 7 ngày (T2 – CN) chia theo cữ Sáng, Trưa, Tối với chấm tròn trạng thái.
  - 2 Thẻ chỉ số (Metric Cards): `Tỷ lệ tuân thủ: 86%` (+12% so với tuần trước) và `Số cữ bỏ lỡ: 1 cữ` (Cữ trưa Thứ Tư).

### 3.2. Tab 2: Quét Thuốc & Phân Tích Vision AI (`app/(tabs)/scan.tsx`)
- **Screen 2a (Kính ngắm Camera sạch):** Khung ngắm chuẩn Camera iOS với 4 góc bracket bo tròn tinh tế, nút chụp tròn màu trắng, nút mở thư viện và nút tự nhập.
- **Screen 2b (Laser Scan):** Hiệu ứng laser chuyển động dọc + trạng thái bóc tách quang học. Nén ảnh giữ nguyên tỉ lệ qua `expo-image-manipulator` (dung lượng ~100KB, AI phản hồi < 2s).
- **Kiến trúc 3 Luồng Kết Quả:**
  - **Luồng 1 — Quét Thất Bại:** Empty State y tế chuyên nghiệp với icon `AlertCircle`, giải thích ảnh mờ/thiếu sáng, 2 nút phân cấp: `Chụp lại` và `Tự nhập thuốc`.
  - **Luồng 2 — Quét Đơn Thuốc:** Thẻ hồ sơ đơn thuốc (Bác sĩ, Chẩn đoán), danh sách thuốc bóc tách kèm **iOS Circle Checkmark** tròn để chọn lọc thuốc, 2 CTA: `Thêm vào Lịch` (chọn người uống) và `Lưu vào Tủ`.
  - **Luồng 3 — Quét Một Loại Thuốc:** Product Specimen Card sang trọng hiển thị Tên, Hoạt chất, Liều dùng, Xuất xứ & HSD, 2 CTA: `Thêm vào Lịch` và `Lưu vào Tủ`.

### 3.3. Tab 3: Tủ Thuốc Gia Đình (`app/(tabs)/cabinet.tsx`)
- **Header:** Tiêu đề "Tủ Thuốc" + tổng số loại thuốc trong tủ gia đình + Avatar.
- **Bộ lọc danh mục dạng Pill Filter con nhộng:** Cuộn ngang (`Tất cả`, `Huyết áp`, `Dạ dày`, `Tiểu đường`, `Kháng sinh`, `Giảm đau`), active đổi sang Dark Pill `bg-zinc-900 text-white`.
- **Thẻ thuốc (Medicine Item Card):** Thẻ Inset Card với thumbnail squircle bên trái, tên thuốc, hoạt chất, số lượng viên còn lại (`Còn 28 viên`), hạn sử dụng.

### 3.4. Màn Hình Hồ Sơ & Cài Đặt (`app/settings.tsx`)
- **Header:** Nút `< Quay lại`, Avatar người dùng lớn, icon Cài đặt.
- **Nhóm GIA ĐÌNH:** Inset Grouped TableView danh sách thành viên (Avatar viết tắt chữ cái, vai trò) và nút `+ Thêm người thân`.
- **Nhóm CÀI ĐẶT THÔNG BÁO:** 2 tùy chọn radio chuẩn iOS (`Tất cả mọi người` / `Chỉ mình tôi`) với dấu checkmark xanh Apple.
- **Nút hành động cuối:** Nút `Đăng xuất` màu cam/đỏ nổi bật ở dưới cùng.

---

## 4. CẤU TRÚC DỮ LIỆU & SCHEMA (DATA SCHEMA)

### 4.1. TypeScript Definitions (`types/medlens.ts`)

```typescript
export type TimeSlot = 'morning' | 'noon' | 'evening';
export type MealTiming = 'before_meal' | 'after_meal' | 'with_meal';
export type ConflictSeverity = 'low' | 'moderate' | 'high' | 'critical';
export type ScanFlowType = 'prescription' | 'single_medicine' | 'unrecognized';

export interface Medicine {
  id: string;
  name: string;             // VD: Amlodipine 5mg
  activeIngredient: string; // Hoạt chất: Amlodipine besylate
  dosage: string;           // 1 viên
  mealTiming: MealTiming;   // after_meal
  instructions: string;     // Chỉ dẫn sử dụng
  purpose: string;          // Hạ huyết áp, ổn định nhịp tim
  category: string;         // Blood Pressure, Stomach, v.v.
  remainingCount: number;   // Số viên còn lại trong tủ (VD: 28)
  expiryDate: string;       // Hạn sử dụng YYYY-MM-DD
}

export interface SingleMedicineDetail extends Medicine {
  origin?: string;            // Xuất xứ / Hãng sản xuất (VD: GlaxoSmithKline - Anh Quốc)
  recommendedDosage?: string; // Liều dùng khuyến cáo
  indications?: string;       // Công dụng điều trị chính
  timeSlots?: TimeSlot[];     // Cữ đề xuất
}

export interface DoseSlot {
  slot: TimeSlot;           // morning | noon | evening
  timeLabel: string;        // "08:00", "12:30", "20:00"
  medicines: Medicine[];
  isTaken: boolean;         // Trạng thái đã uống
  takenAt?: string;         // Giờ bấm tick (VD: 08:15)
}

export interface PrescriptionAnalysisResult {
  scanType?: ScanFlowType;
  doctorName?: string;
  diagnosis?: string;
  medicines: (Medicine & { timeSlots: TimeSlot[] })[];
  warnings: InteractionWarning[];
  singleMedicine?: SingleMedicineDetail;
  errorMessage?: string;
}
```

---

## 5. QUẢN LÝ TRẠNG THÁI & OFFLINE PERSISTENCE (ZUSTAND STORE)

Để **100% vượt qua Kill App Test** mà không gặp lỗi giới hạn 2KB của `expo-secure-store`, ứng dụng dùng `zustand/middleware` kết hợp với `@react-native-async-storage/async-storage`:

```typescript
// store/useMedStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DoseSlot, Medicine, PrescriptionAnalysisResult, TimeSlot } from '@/types/medlens';
import { MOCK_SCHEDULE, MOCK_CABINET } from '@/mocks/mockData';

interface MedState {
  schedule: DoseSlot[];
  cabinet: Medicine[];
  selectedMedicine: Medicine | null;
  
  // Actions
  toggleDoseSlot: (slot: TimeSlot) => void;
  importPrescription: (data: PrescriptionAnalysisResult) => void;
  addSingleMedicine: (medicine: Medicine, timeSlots?: TimeSlot[], addToCabinet?: boolean, addToSchedule?: boolean) => void;
  addMedicines: (medicines: (Medicine & { timeSlots: TimeSlot[] })[], addToCabinet: boolean, addToSchedule: boolean) => void;
  updateMedicine: (medicine: Medicine) => void;
  updateMedicineCount?: (medicineId: string, count: number) => void;
  resetToDemo: () => void;
  setSelectedMedicine: (medicine: Medicine | null) => void;
}

export const useMedStore = create<MedState>()(
  persist(
    (set, get) => ({
      schedule: MOCK_SCHEDULE,
      cabinet: MOCK_CABINET,

      toggleDoseTaken: (slotId) => {
        set((state) => ({
          schedule: state.schedule.map((slot) => {
            if (slot.id !== slotId) return slot;
            const willBeTaken = !slot.isTaken;
            return {
              ...slot,
              isTaken: willBeTaken,
              takenAt: willBeTaken
                ? new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                : undefined,
            };
          }),
        }));
      },

      // Smart Merge: Gộp thông minh thuốc mới vào cữ tương ứng mà không làm mất trạng thái đã uống
      importPrescription: (data) => {
        const { schedule, cabinet } = get();
        const newSchedule = schedule.map((slot) => {
          const matchingSlotPlan = data.slots.find((s) => s.slot === slot.slot);
          if (!matchingSlotPlan) return slot;

          const newMedsForThisSlot = data.medicines.filter((m) =>
            matchingSlotPlan.medicineIds.includes(m.id)
          );

          // Lọc trùng thuốc theo ID hoặc tên
          const existingMedNames = new Set(slot.medicines.map((m) => m.name.toLowerCase()));
          const uniqueNewMeds = newMedsForThisSlot.filter(
            (m) => !existingMedNames.has(m.name.toLowerCase())
          );

          return {
            ...slot,
            medicines: [...slot.medicines, ...uniqueNewMeds],
          };
        });

        // Gộp vào Tủ Thuốc
        const existingCabinetNames = new Set(cabinet.map((m) => m.name.toLowerCase()));
        const uniqueCabinetMeds = data.medicines.filter(
          (m) => !existingCabinetNames.has(m.name.toLowerCase())
        );

        set({
          schedule: newSchedule,
          cabinet: [...cabinet, ...uniqueCabinetMeds],
        });
      },

      updateMedicineCount: (medicineId, count) => {
        set((state) => ({
          cabinet: state.cabinet.map((m) => (m.id === medicineId ? { ...m, remainingCount: count } : m)),
        }));
      },

      resetToDemo: () => {
        set({
          schedule: MOCK_SCHEDULE,
          cabinet: MOCK_CABINET,
        });
      },
    }),
    {
      name: 'medlens-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

---

## 6. KIẾN TRÚC VISION AI & SUPABASE EDGE FUNCTION

### 6.1. Luồng phân tích (Flow Analysis)
1. **Client:** Người dùng chụp ảnh hoặc chọn ảnh đơn thuốc/vỉ thuốc -> Chuyển thành Base64.
2. **Cabinet Context:** Đính kèm danh sách hoạt chất thuốc hiện có trong Tủ Thuốc (`currentCabinetDrugs`).
3. **Supabase Edge Function (`chat-ai`):**
   - Tiếp nhận image Base64 + danh sách thuốc trong tủ.
   - Gửi yêu cầu Multimodal Vision sang **Gemini 1.5 Flash**.
   - Gemini xử lý OCR chữ viết tay, trích xuất cấu trúc thuốc và kiểm tra tương tác thuốc 2 lớp.
4. **Fallback Mode:** Nếu không có mạng hoặc chưa cấu hình API Key, tự động kích hoạt `MOCK_ANALYSIS_RESULT` có sẵn trong máy trong vòng 1.2 giây (mô phỏng trải nghiệm thật mà không hề báo lỗi).

### 6.2. JSON Schema chuẩn bắt buộc trả về từ AI

```json
{
  "patientName": "Nguyễn Văn An (65 tuổi)",
  "diagnosis": "Tăng huyết áp vô căn / Trào ngược dạ dày thực quản",
  "medicines": [
    {
      "id": "med-amlodipine-5",
      "name": "Amlodipine 5mg",
      "activeIngredient": "Amlodipine besylate",
      "dosage": "1 viên",
      "mealTiming": "after_meal",
      "purpose": "Hạ huyết áp",
      "category": "Huyết áp",
      "remainingCount": 30,
      "expiryDate": "12/2026"
    }
  ],
  "slots": [
    { "slot": "morning", "time": "08:00", "medicineIds": ["med-amlodipine-5"] }
  ],
  "warnings": [
    {
      "hasConflict": true,
      "severity": "high",
      "type": "cabinet_conflict",
      "medicinesInvolved": ["Aspirin 81mg", "Gaviscon Dual Action"],
      "message": "Cảnh báo kỵ thuốc: Gaviscon (dạ dày) trong đơn mới làm giảm hấp thu Aspirin đang có trong tủ thuốc của bạn. Uống cách nhau tối thiểu 2 giờ."
    }
  ]
}
```

---

## 7. KẾ HOẠCH TRIỂN KHAI TỪNG BƯỚC (EXECUTION PLAN)

| Bước | Hạng mục công việc | Output cụ thể |
| :--- | :--- | :--- |
| **Bước 1** | **Cài đặt thư viện cốt lõi** | `npx expo install @react-native-async-storage/async-storage expo-image-picker` |
| **Bước 2** | **Định nghĩa Type & Mock chuẩn y khoa** | `types/medlens.ts` & `mocks/mockData.ts` (đầy đủ thuốc huyết áp, dạ dày, tiểu đường, kỵ thuốc chuẩn) |
| **Bước 3** | **Zustand Persist Store** | `store/useMedStore.ts` với AsyncStorage & Smart Merge, vượt qua Kill App Test |
| **Bước 4** | **Nâng cấp Service AI** | `services/ai.ts` & Edge Function nhận Base64 hình ảnh + Fallback an toàn |
| **Bước 5** | **Xây dựng Tab 1: Hôm Nay** | `app/(tabs)/index.tsx` (Adherence Card, 3 Cữ thuốc Sáng/Trưa/Tối, 1-chạm tick) |
| **Bước 6** | **Xây dựng Tab 2: Quét Toa** | `app/(tabs)/scan.tsx` (Chụp ảnh/Thư viện, Skeleton AI, Cảnh báo 2 lớp, Demo Presets) |
| **Bước 7** | **Xây dựng Tab 3: Tủ Thuốc** | `app/(tabs)/cabinet.tsx` (Lọc theo bệnh, xem số lượng viên, HSD) |
| **Bước 8** | **Modal Chi Tiết & Reset Demo** | `components/features/MedicineDetailModal.tsx` & Nút Reset Demo trên Header |
| **Bước 9** | **Kiểm thử Kill App & Demo Chạy Thật** | Test tắt app, bật lại, kiểm tra trạng thái lưu trữ và giao diện mượt mà |

---

*Tài liệu này là căn cứ kỹ thuật chính xác nhất để hiện thực hóa sản phẩm MedLens đạt điểm tối đa cả 2 tiêu chí Bài toán (35đ) và Kỹ thuật (40đ).*
