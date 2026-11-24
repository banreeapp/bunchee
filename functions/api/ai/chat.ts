import { GoogleGenAI, ThinkingLevel } from '@google/genai';

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
      message: string;
      contextSummary?: string;
      history?: Array<{ role: 'user' | 'model'; text: string }>;
    };

    const { message, contextSummary, history } = body;

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'กรุณาระบุคำถาม' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const systemInstruction = `คุณคือ AI ผู้เชี่ยวชาญด้านบัญชีการเงินของโรงพยาบาลส่งเสริมสุขภาพตำบล (รพ.สต.) เชี่ยวชาญระบบ PCU Money, ระเบียบเงินบำรุง สธ./อบจ., บัญชีเงินสด แบบ 401, ทะเบียนคุมเงินนอกงบประมาณ แบบ 404, รายงานเงินคงเหลือประจำวัน แบบ 407, ภาษีหัก ณ ที่จ่าย และการจัดทำงบเดือนส่ง สสอ./อบจ.

ข้อมูลบริบทบัญชีปัจจุบันของผู้ใช้:
${contextSummary || 'ไม่มีข้อมูลบริบท'}

จงตอบคำถามเป็นภาษาไทยที่สุภาพ เป็นระบบ อ้างอิงหมวดหมู่และแบบฟอร์มจริง (เช่น แบบ 401, 404, 407) อย่างถูกต้องแม่นยำ`;

    const formattedHistory = (history || []).slice(-8).map((item) => ({
      role: item.role,
      parts: [{ text: item.text }],
    }));

    const chat = ai.chats.create({
      model: 'gemini-4-hydrogen',
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
      history: formattedHistory,
    });

    const response = await chat.sendMessage({ message });
    return new Response(JSON.stringify({ reply: response.text || '' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'ไม่สามารถติดต่อ AI ผู้เชี่ยวชาญได้';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
