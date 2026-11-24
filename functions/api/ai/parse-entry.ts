import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

interface PagesContext {
  request: Request;
  env: {
    GEMINI_API_KEY?: string;
  };
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  try {
    const apiKey = context.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บน Cloudflare Pages' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const body = (await context.request.json()) as {
      text?: string;
      imageBase64?: string;
      mimeType?: string;
      bankAccounts?: Array<{ id: string; name: string; accountNo: string }>;
      docPrefixes?: { expensePrefix: string; receiptBookMain: string };
      categoriesPrompt?: string;
    };

    const { text, imageBase64, mimeType, bankAccounts, docPrefixes, categoriesPrompt } =
      body;

    if (!text && !imageBase64) {
      return new Response(
        JSON.stringify({ error: 'กรุณาระบุข้อความรายละเอียดหรือแนบภาพใบเสร็จ/สลิป' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const bankContext = (bankAccounts || [])
      .map(
        (b, i) =>
          `${i + 1}. id="${b.id}" ชื่อ="${b.name}" เลขบัญชี="${b.accountNo}"`
      )
      .join('\n');

    const systemInstruction = `คุณคือผู้เชี่ยวชาญด้านบัญชีและการเงินภาครัฐสำหรับโรงพยาบาลส่งเสริมสุขภาพตำบล (รพ.สต.) มาตรฐานโปรแกรม PCU Money และระเบียบกระทรวงสาธารณสุข/อบจ.
หน้าที่ของคุณคือวิเคราะห์ข้อความหรือภาพใบเสร็จรับเงิน/ใบแจ้งหนี้/สลิปโอนเงิน แล้วแปลงเป็นรายการบันทึกบัญชีรายรับ-รายจ่ายที่ถูกต้องตามหมวดหมู่ของ รพ.สต.

บัญชีธนาคารที่มีในระบบ:
${bankContext || 'id="bank-1" เงินบำรุง สอ.บ้านรี'}

คำนำหน้าเลขที่เอกสารมาตรฐาน:
- รายจ่าย: ${docPrefixes?.expensePrefix || 'สบ1133.6.2/'}
- ใบเสร็จรับเงิน: ${docPrefixes?.receiptBookMain || 'สบ./ดพ.041'}

ผังหมวดหมู่รายรับ (13 หมวด) และรายจ่าย (14 หมวด) ที่ต้องเลือกใช้ให้ตรงรหัส:
${categoriesPrompt || ''}

ข้อกำหนดการตอบ:
- เลือก type เป็น "income" (รายรับ), "expense" (รายจ่าย), หรือ "transfer" (ฝาก-ถอนระหว่างเงินสดกับธนาคาร)
- ระบุ categoryCode และ subCategoryCode ให้ตรงกับรหัสในผังหมวดหมู่ด้านบน (ถ้าไม่มีหมวดย่อยให้ใช้รหัสหมวดหลักใน subCategoryCode หรือค่าว่างตามผัง)
- รูปแบบวันที่เป็น ค.ศ. YYYY-MM-DD (หากในสลิปเป็น พ.ศ. เช่น 69 หรือ 2569 ให้แปลงเป็น ค.ศ. 2026; พ.ศ. 70 หรือ 2570 เป็น ค.ศ. 2027)
- paymentMethod เป็น "cash" (เงินสด), "bank" (โอน/e-Pay/เงินเข้าบัญชี), หรือ "cheque" (จ่าย/รับเช็ค)
- ตอบ reasoning เป็นภาษาไทยอธิบายเหตุผลการลงบัญชีอย่างกระชับ ชัดเจน`;

    const parts: Array<
      { text: string } | { inlineData: { mimeType: string; data: string } }
    > = [];
    if (imageBase64 && mimeType) {
      parts.push({
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      });
    }
    parts.push({
      text: text
        ? `วิเคราะห์ข้อมูลต่อไปนี้เพื่อลงบัญชี รพ.สต.:\n${text}`
        : 'อ่านข้อมูลจากภาพใบเสร็จ/สลิปนี้และจัดหมวดหมู่ลงบัญชี รพ.สต. ให้ครบถ้วน',
    });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, description: 'income, expense, or transfer' },
            date: { type: Type.STRING, description: 'YYYY-MM-DD' },
            docNo: { type: Type.STRING },
            categoryCode: { type: Type.STRING },
            subCategoryCode: { type: Type.STRING },
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            paymentMethod: {
              type: Type.STRING,
              description: 'cash, bank, or cheque',
            },
            bankAccountId: { type: Type.STRING },
            chequeNo: { type: Type.STRING },
            projectCode: { type: Type.STRING },
            confidence: {
              type: Type.STRING,
              description: 'high, medium, or low',
            },
            reasoning: { type: Type.STRING },
          },
          required: [
            'type',
            'date',
            'categoryCode',
            'description',
            'amount',
            'paymentMethod',
            'bankAccountId',
            'reasoning',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'ไม่สามารถวิเคราะห์รายการด้วย AI ได้';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
