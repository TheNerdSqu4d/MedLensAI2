// Supabase Edge Function: chat-ai
// Deploy command: npx supabase functions deploy chat-ai --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const rawKey = Deno.env.get('AI_API_KEY');
    const apiKey = rawKey ? rawKey.trim() : '';
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'Thiếu AI_API_KEY trong Supabase Cloud Secrets. Vui lòng cấu hình trên Dashboard.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Payload JSON không hợp lệ.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prompt, systemPrompt, schemaPrompt, imageBase64, cabinetMedicines } = body;

    // Validate that at least one interaction mode is requested
    if (!imageBase64 && !prompt) {
      return new Response(
        JSON.stringify({ error: 'Tham số prompt hoặc imageBase64 không được để trống.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // MODE 1: MULTIMODAL PRESCRIPTION SCANNING & DUAL-LAYER CONFLICT DETECTION
    // =========================================================================
    if (imageBase64) {
      // Clean base64 header if present
      let mimeType = 'image/jpeg';
      if (typeof imageBase64 === 'string') {
        const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
        }
      }
      const cleanBase64 = typeof imageBase64 === 'string'
        ? imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim()
        : '';

      const cabinetListText = Array.isArray(cabinetMedicines) && cabinetMedicines.length > 0
        ? cabinetMedicines.map((m: any, idx: number) =>
            `${idx + 1}. ${m.name || 'Thuốc'} (Hoạt chất: ${m.activeIngredient || 'N/A'}, Liều: ${m.dosage || 'N/A'}, Nhóm: ${m.category || 'N/A'}, Hướng dẫn: ${m.instructions || 'N/A'})`
          ).join('\n')
        : 'Tủ thuốc gia đình hiện tại không có thuốc nào (trống).';

      const prescriptionPrompt = `
Bạn là Hệ thống Chuyên gia Y tế & Dược lý Lâm sàng MedLens AI.
Nhiệm vụ của bạn là phân tích hình ảnh và thực hiện Đánh giá Tương tác Thuốc 2 Tầng (Dual-Layer Drug Interaction Safety Engine).

--- THÔNG TIN TỦ THUỐC GIA ĐÌNH BỆNH NHÂN HIỆN CÓ ---
${cabinetListText}
----------------------------------------------------

YÊU CẦU BÓC TÁCH & PHÂN TÍCH Y KHOA:
0. PHÂN LOẠI HÌNH ẢNH & ĐỘ RÕ NÉT (BẮT BUỘC KIỂM TRA ĐẦU TIÊN):
   - NGUYÊN TẮC AN TOÀN TUYỆT ĐỐI: Nếu ảnh KHÔNG đọc rõ chữ, chữ bị nhòe/mờ/chói lóa/thiếu góc, hoặc KHÔNG liên quan đến y tế:
     TUYỆT ĐỐI KHÔNG ĐƯỢC ĐOÁN MÒ HOẶC TỰ SUY DIỄN THÔNG TIN THUỐC.
     BẮT BUỘC TRẢ VỀ:
     "scanType": "unrecognized",
     "isValidPrescription": false,
     "medicines": [],
     "doctorName": null,
     "diagnosis": null,
     "errorMessage": "Không nhận diện được đơn thuốc / bao bì thuốc do hình ảnh không đọc rõ chữ. Vui lòng chụp lại rõ nét hơn hoặc tự nhập thuốc bằng tay.",
     "warnings": []
     -> KẾT THÚC XỬ LÝ NGAY.
   - Nếu ảnh là ĐƠN THUỐC Y TẾ / TOA THUỐC BỆNH VIỆN / PHIẾU KHÁM BỆNH đọc rõ chữ (có danh sách thuốc, bác sĩ kê đơn hoặc chẩn đoán):
     "scanType": "prescription", "isValidPrescription": true.
   - Nếu ảnh là LỌ THUỐC, CHAI THUỐC, VỎ HỘP THUỐC, VỈ THUỐC HOẶC BAO BÌ DƯỢC PHẨM ĐƠN LẺ đọc rõ chữ:
     "scanType": "single_medicine", "isValidPrescription": true.

1. NẾU LÀ ĐƠN THUỐC (scanType = "prescription"):
   - doctorName: Tên bác sĩ kê đơn kèm chức danh/khoa nếu thấy rõ. NẾU KHÔNG CÓ TÊN BÁC SĨ (hoặc không ghi rõ tên), BẮT BUỘC TRẢ VỀ: "Không có" hoặc null. TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ BỊA "Bác sĩ khám bệnh" hay "Bác sĩ phụ trách".
   - isHandwritten: boolean. BẮT BUỘC KIỂM TRA: Đơn thuốc này là VIẾT TAY (handwritten) hay in từ máy vi tính (printed)? Nếu là chữ viết tay (đặc biệt nếu nét chữ viết tay nguệch ngoạc, khó đọc, hoặc dễ sai lệch tên thuốc), BẮT BUỘC ĐẶT: true. Nếu là văn bản đánh máy in rõ nét, đặt: false.
   - handwritingWarning: Nếu isHandwritten là true, điền cảnh báo: "Đơn thuốc viết tay: Chữ viết bác sĩ có thể khó đọc hoặc nguệch ngoạc, tên thuốc và liều lượng có thể sai lệch hoặc không thể quét chính xác 100%. Vui lòng kiểm tra kỹ hoặc bấm 'Chi tiết / Sửa' để chủ động sửa lại tên thuốc nếu cần." Nếu không phải viết tay, để null.
   - diagnosis: Chẩn đoán lâm sàng ghi trên đơn. Nếu không ghi, tóm tắt bệnh lý theo nhóm thuốc.
   - patientName: Tên bệnh nhân ghi trên đơn (nếu có), nếu không thấy để null.
   - patientAge: Tuổi bệnh nhân (số nguyên), nếu không thấy để null.
   - prescriptionDate: Ngày kê đơn (YYYY-MM-DD), nếu không thấy để null.
   - medicines: Danh sách toàn bộ các thuốc kê trong đơn.

2. NẾU LÀ LỌ THUỐC / BAO BÌ THUỐC ĐƠN LẺ (scanType = "single_medicine"):
   - TUYỆT ĐỐI ĐẶT: "doctorName": null, "diagnosis": null, "patientName": null, "patientAge": null, "prescriptionDate": null. KHÔNG ĐƯỢC BỊA BÁC SĨ HAY CHẨN ĐOÁN.
   - singleMedicine: Trích xuất chi tiết sản phẩm:
     + id: Mã định danh duy nhất (dạng med-{ten-thuoc}).
     + name: Tên biệt dược đầy đủ kèm hàm lượng (ví dụ: "Panadol Extra Đỏ 500mg/65mg", "Berberin 50mg").
     + activeIngredient: Hoạt chất chính xác (ví dụ: "Paracetamol 500mg + Caffeine 65mg").
     + dosage: Liều dùng khuyến cáo cho 1 lần (ví dụ: "1 - 2 viên").
     + origin: Nhà sản xuất / Xuất xứ nếu thấy (ví dụ: "GlaxoSmithKline (GSK)", "Dược Hậu Giang", "Sanofi").
     + recommendedDosage: Hướng dẫn liều dùng khuyến cáo (ví dụ: "Người lớn: 1-2 viên/lần, cách 4-6 giờ").
     + indications: Công dụng điều trị chính (ví dụ: "Giảm đau nhanh, hạ sốt").
     + instructions: Hướng dẫn sử dụng (ví dụ: "Uống sau ăn với nhiều nước").
     + mealTiming: "before_meal" | "after_meal" | "with_meal".
     + remainingCount: Số lượng viên/gói ước tính trên nhãn (ví dụ: 20, 100).
     + expiryDate: Hạn dùng YYYY-MM-DD nếu thấy dập nổi trên vỏ/lọ; nếu không thấy để null (TUYỆT ĐỐI KHÔNG TỰ BỊA HẠN DÙNG).
     + category: Phân loại nhóm thuốc ("Giảm đau", "Huyết áp", "Dạ dày", "Tiểu đường", "Kháng sinh", "Khác").
     + timeSlots: Mảng các cữ thích hợp trong ngày, ví dụ: ["morning", "noon"].
   - medicines: Mảng rỗng [] hoặc chứa 1 phần tử thuốc này.

3. ĐÁNH GIÁ AN TOÀN TƯƠNG TÁC THUỐC (DUAL-LAYER SAFETY ANALYSIS):
   - Nếu là "prescription": Kiểm tra Lớp 1 (nội bộ giữa các thuốc trong đơn) và Lớp 2 (chéo với Tủ thuốc gia đình).
   - Nếu là "single_medicine": Kiểm tra đối soát hoạt chất của thuốc này với TỦ THUỐC GIA ĐÌNH ở trên (ví dụ: thuốc này có kỵ hoặc trùng lặp với thuốc nào bệnh nhân đang uống ở nhà không).
   Mỗi cảnh báo trong mảng "warnings":
   - id: Chuỗi duy nhất.
   - source: "internal_prescription" | "cabinet_conflict".
   - medicineA: Tên thuốc thứ nhất.
   - medicineB: Tên thuốc thứ hai.
   - severity: "low" | "moderate" | "high" | "critical".
   - description: Cơ chế và nguy cơ y khoa bằng tiếng Việt.
   - clinicalRecommendation: Hướng dẫn xử trí (ví dụ: uống cách nhau 2 giờ).

4. ĐỊNH DẠNG ĐẦU RA BẮT BUỘC (DUY NHẤT 1 JSON OBJECT THUẦN):
   {
     "scanType": "prescription" | "single_medicine" | "unrecognized",
     "isValidPrescription": true,
     "isHandwritten": false,
     "handwritingWarning": null,
     "doctorName": "BS.CKII Trần Văn Minh (hoặc 'Không có' nếu không có tên)",
     "diagnosis": "string hoặc null",
     "patientName": "string hoặc null",
     "patientAge": 40,
     "prescriptionDate": "YYYY-MM-DD hoặc null",
     "medicines": [...],
     "singleMedicine": { ... },
     "warnings": [...]
   }
   }
`;

      let aiResultText = '';

      if (apiKey.startsWith('sk-')) {
        // OpenAI Vision (gpt-4o-mini)
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'Bạn là chuyên gia phân tích đơn thuốc MedLens AI. Trả về đúng cấu trúc JSON PrescriptionAnalysisResult.',
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: prescriptionPrompt },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${mimeType};base64,${cleanBase64}`,
                    },
                  },
                ],
              },
            ],
            response_format: { type: 'json_object' },
          }),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message || 'Lỗi gọi OpenAI Vision API');
        aiResultText = json.choices[0].message.content;
      } else {
        // Google Gemini Multimodal: Dùng gemini-1.5-flash (với fallback gemini-2.0-flash / gemini-1.5-flash-latest)
        let geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      inlineData: {
                        mimeType,
                        data: cleanBase64,
                      },
                    },
                    {
                      text: prescriptionPrompt,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 3500,
                responseMimeType: 'application/json',
              },
            }),
          }
        );

        let json = await geminiRes.json();

        // Nếu model 1.5-flash gặp lỗi, tự động thử fallback sang gemini-2.0-flash
        if (!geminiRes.ok) {
          console.warn('Gemini 1.5-flash failed, trying gemini-2.0-flash:', json.error?.message);
          const fallbackRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        inlineData: {
                          mimeType,
                          data: cleanBase64,
                        },
                      },
                      {
                        text: prescriptionPrompt,
                      },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: 0.2,
                  maxOutputTokens: 3500,
                  responseMimeType: 'application/json',
                },
              }),
            }
          );
          json = await fallbackRes.json();
          if (!fallbackRes.ok) throw new Error(json.error?.message || 'Lỗi gọi Google Gemini Vision API');
        }

        aiResultText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      // Làm sạch chuỗi JSON nếu có markdown code block
      const cleanJson = aiResultText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      let parsedData: any;
      try {
        parsedData = JSON.parse(cleanJson);
      } catch {
        throw new Error('Dữ liệu từ AI không phải JSON hợp lệ: ' + cleanJson.slice(0, 100));
      }

      // Chuẩn hóa đảm bảo tuân thủ hợp đồng PrescriptionAnalysisResult
      if (!Array.isArray(parsedData.medicines)) {
        parsedData.medicines = [];
      }
      if (!Array.isArray(parsedData.warnings)) {
        parsedData.warnings = [];
      }

      parsedData.isValidPrescription = typeof parsedData.isValidPrescription === 'boolean'
        ? parsedData.isValidPrescription
        : parsedData.medicines.length > 0;

      parsedData.scanType = ['prescription', 'single_medicine', 'unrecognized'].includes(parsedData.scanType)
        ? parsedData.scanType
        : parsedData.singleMedicine
        ? 'single_medicine'
        : 'prescription';

      if (parsedData.scanType === 'single_medicine') {
        parsedData.doctorName = null;
        parsedData.diagnosis = null;
        parsedData.patientName = null;
        parsedData.patientAge = null;
        parsedData.prescriptionDate = null;

        if (!parsedData.singleMedicine && parsedData.medicines.length > 0) {
          const first = parsedData.medicines[0];
          parsedData.singleMedicine = {
            id: first.id || `med-single-${Date.now()}`,
            name: first.name || 'Thuốc không rõ tên',
            activeIngredient: first.activeIngredient || '',
            dosage: first.dosage || '1 viên',
            mealTiming: first.mealTiming || 'after_meal',
            instructions: first.instructions || 'Uống theo chỉ định',
            purpose: first.purpose || '',
            remainingCount: typeof first.remainingCount === 'number' ? first.remainingCount : 20,
            expiryDate: first.expiryDate || null,
            category: first.category || 'Khác',
            origin: first.origin || 'Nhà sản xuất chính hãng',
            recommendedDosage: first.recommendedDosage || first.dosage || '1 viên',
            indications: first.indications || first.purpose || '',
            timeSlots: Array.isArray(first.timeSlots) && first.timeSlots.length > 0 ? first.timeSlots : ['morning', 'noon'],
          };
        }
      } else {
        parsedData.patientName = parsedData.patientName || null;
        parsedData.patientAge = typeof parsedData.patientAge === 'number' ? parsedData.patientAge : null;
        parsedData.prescriptionDate = parsedData.prescriptionDate || null;
        parsedData.isHandwritten = Boolean(parsedData.isHandwritten);
        parsedData.handwritingWarning = parsedData.isHandwritten
          ? (parsedData.handwritingWarning ||
             'Đơn thuốc viết bằng tay chữ có thể nguệch ngoạc khó đọc, tên thuốc hoặc liều lượng có thể sai lệch và không thể quét chính xác 100%. Vui lòng kiểm tra kỹ hoặc bấm "Chi tiết / Sửa" để chủ động sửa lại tên thuốc.')
          : null;

        if (
          !parsedData.doctorName ||
          typeof parsedData.doctorName !== 'string' ||
          !parsedData.doctorName.trim() ||
          parsedData.doctorName.toLowerCase().includes('bác sĩ khám bệnh') ||
          parsedData.doctorName.toLowerCase().includes('bác sĩ phụ trách') ||
          parsedData.doctorName.toLowerCase().includes('không rõ')
        ) {
          parsedData.doctorName = 'Không có';
        }
      }

      parsedData.medicines = parsedData.medicines.map((med: any, index: number) => ({
        id: med.id || `med-${index + 1}-${Date.now()}`,
        name: med.name || 'Thuốc không rõ tên',
        activeIngredient: med.activeIngredient || '',
        dosage: med.dosage || '1 viên',
        mealTiming: ['before_meal', 'after_meal', 'with_meal'].includes(med.mealTiming)
          ? med.mealTiming
          : 'after_meal',
        instructions: med.instructions || 'Uống theo chỉ dẫn bác sĩ',
        purpose: med.purpose || '',
        remainingCount: typeof med.remainingCount === 'number' ? med.remainingCount : 20,
        expiryDate: (typeof med.expiryDate === 'string' && med.expiryDate.trim()) ? med.expiryDate.trim() : null,
        category: med.category || 'Khác',
        timeSlots: Array.isArray(med.timeSlots) && med.timeSlots.length > 0 ? med.timeSlots : ['morning'],
      }));

      parsedData.warnings = parsedData.warnings.map((warn: any, index: number) => ({
        id: warn.id || `warn-${index + 1}-${Date.now()}`,
        source: warn.source === 'cabinet_conflict' ? 'cabinet_conflict' : 'internal_prescription',
        medicineA: warn.medicineA || '',
        medicineB: warn.medicineB || '',
        severity: ['low', 'moderate', 'high', 'critical'].includes(warn.severity)
          ? warn.severity
          : 'moderate',
        description: warn.description || '',
        clinicalRecommendation: warn.clinicalRecommendation || '',
      }));

      return new Response(JSON.stringify(parsedData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================================
    // MODE 2: TEXT-BASED PROMPT CHAT (PROMPT MODE)
    // =========================================================================
    const finalSystemPrompt =
      systemPrompt ||
      'Bạn là trợ lý AI chuyên nghiệp trong một ứng dụng di động y tế MedLens AI. Phản hồi bằng tiếng Việt thân thiện, súc tích và trả về đúng định dạng JSON.';

    const defaultSchema =
      'Trả về kết quả dưới dạng JSON object có các trường: title (string), description (string), keyPoints (danh sách string các điểm nổi bật).';
    const activeSchema = schemaPrompt || defaultSchema;

    let aiResultText = '';

    if (apiKey.startsWith('sk-')) {
      // 1. OpenAI API
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `${finalSystemPrompt} Yêu cầu cấu trúc: ${activeSchema}`,
            },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Lỗi gọi OpenAI API');
      aiResultText = json.choices[0].message.content;
    } else {
      // 2. Google Gemini API (gemini-1.5-flash / gemini-2.0-flash)
      let geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${finalSystemPrompt}\nYêu cầu người dùng: "${prompt}"\nTrả về kết quả bằng định dạng JSON thuần túy theo yêu cầu: ${activeSchema}. Không thêm markdown code block như \`\`\`json.`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2000,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      let json = await geminiRes.json();
      if (!geminiRes.ok) {
        // Fallback sang gemini-2.0-flash
        const fallbackRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `${finalSystemPrompt}\nYêu cầu người dùng: "${prompt}"\nTrả về kết quả bằng định dạng JSON thuần túy theo yêu cầu: ${activeSchema}.`,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2000,
                responseMimeType: 'application/json',
              },
            }),
          }
        );
        json = await fallbackRes.json();
        if (!fallbackRes.ok) throw new Error(json.error?.message || 'Lỗi gọi Google Gemini API');
      }

      aiResultText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    const cleanJson = aiResultText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    let parsedData: any;
    try {
      parsedData = JSON.parse(cleanJson);
    } catch {
      parsedData = {
        title: 'Phân tích từ AI',
        description: cleanJson,
        keyPoints: [],
        raw: cleanJson,
      };
    }

    return new Response(JSON.stringify(parsedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Lỗi xử lý AI trên máy chủ' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
