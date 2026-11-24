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
      unitName?: string;
      fiscalYear?: number;
      selectedMonthLabel?: string;
      transactions?: unknown[];
      summaryStats?: unknown;
    };

    const { unitName, fiscalYear, selectedMonthLabel, transactions, summaryStats } =
      body;

    const systemInstruction = `คุณคือผู้ตรวจสอบบัญชีภาครัฐและที่ปรึกษาการเงิน รพ.สต. (ผู้เชี่ยวชาญ PCU Money, แบบ 401, แบบ 404, แบบ 407 และงบเดือนเงินบำรุง)
วิเคราะห์รายการรับ-จ่ายและยอดกระทบยอดที่ได้รับ แล้วตรวจหา:
1. เลขที่ใบเสร็จรับเงินหรือเอกสารรายจ่ายที่ซ้ำกัน หรือมีแนวโน้มขาดช่วง
2. ความสมดุลของเงินรับฝากภาษี หัก ณ ที่จ่าย / ประกันสังคม กับยอดนำส่งสรรพากร
3. ความถูกต้องของการจัดหมวดหมู่รายรับ 13 หมวด และรายจ่าย 14 หมวด (เช่น ค่าน้ำ-ค่าไฟ-เน็ตต้องอยู่หมวดสาธารณูปโภค, ค่าจ้างเหมาบริการ vs ค่าจ้างชั่วคราว)
4. ความเสี่ยงเงินสดในมือคงเหลือสูงเกินเกณฑ์หรือติดลบ และยอดคงเหลือรวมเทียบยอดยกมา

ตอบเป็น JSON ภาษาไทยที่ชัดเจน ตรงประเด็น นำไปปฏิบัติตรวจสอบแก้ไขได้ทันที`;

    const prompt = `หน่วยงาน: ${unitName} ปีงบประมาณ ${fiscalYear}
เดือนที่ตรวจสอบ: ${selectedMonthLabel}
สรุปยอดสำคัญ: ${JSON.stringify(summaryStats, null, 2)}
รายการบัญชี (${Array.isArray(transactions) ? transactions.length : 0} รายการ):
${JSON.stringify(transactions, null, 2)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallStatus: {
              type: Type.STRING,
              description: 'normal, attention, or warning',
            },
            summary: { type: Type.STRING },
            reconciliationNote: { type: Type.STRING },
            findings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  severity: {
                    type: Type.STRING,
                    description: 'ok, warning, or critical',
                  },
                  title: { type: Type.STRING },
                  detail: { type: Type.STRING },
                  suggestion: { type: Type.STRING },
                },
                required: ['severity', 'title', 'detail', 'suggestion'],
              },
            },
          },
          required: ['overallStatus', 'summary', 'reconciliationNote', 'findings'],
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
      err instanceof Error ? err.message : 'ไม่สามารถตรวจสอบบัญชีด้วย AI ได้';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
