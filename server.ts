import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const app = express();
app.use(express.json({ limit: '15mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// 1. AI Parse Receipt / Slip / Natural Language Description into PCU Money Entry
app.post('/api/ai/parse-entry', async (req, res) => {
  try {
    const { text, imageBase64, mimeType, bankAccounts, docPrefixes, categoriesPrompt } = req.body as {
      text?: string;
      imageBase64?: string;
      mimeType?: string;
      bankAccounts?: Array<{ id: string; name: string; accountNo: string }>;
      docPrefixes?: { expensePrefix: string; receiptBookMain: string };
      categoriesPrompt?: string;
    };

    if (!text && !imageBase64) {
      return res.status(400).json({ error: 'กรุณาระบุข้อความรายละเอียดหรือแนบภาพใบเสร็จ/สลิป' });
    }

    const bankContext = (bankAccounts || [])
      .map((b, i) => `${i + 1}. id="${b.id}" ชื่อ="${b.name}" เลขบัญชี="${b.accountNo}"`)
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

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
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
            paymentMethod: { type: Type.STRING, description: 'cash, bank, or cheque' },
            bankAccountId: { type: Type.STRING },
            chequeNo: { type: Type.STRING },
            projectCode: { type: Type.STRING },
            confidence: { type: Type.STRING, description: 'high, medium, or low' },
            reasoning: { type: Type.STRING },
          },
          required: ['type', 'date', 'categoryCode', 'description', 'amount', 'paymentMethod', 'bankAccountId', 'reasoning'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (err: unknown) {
    console.error('AI parse-entry error:', err);
    const message = err instanceof Error ? err.message : 'ไม่สามารถวิเคราะห์รายการด้วย AI ได้';
    res.status(500).json({ error: message });
  }
});

// 2. AI Audit & Reconciliation Review
app.post('/api/ai/audit', async (req, res) => {
  try {
    const { unitName, fiscalYear, selectedMonthLabel, transactions, summaryStats } = req.body;

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
            overallStatus: { type: Type.STRING, description: 'normal, attention, or warning' },
            summary: { type: Type.STRING },
            reconciliationNote: { type: Type.STRING },
            findings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  severity: { type: Type.STRING, description: 'ok, warning, or critical' },
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
    res.json(parsed);
  } catch (err: unknown) {
    console.error('AI audit error:', err);
    const message = err instanceof Error ? err.message : 'ไม่สามารถตรวจสอบบัญชีด้วย AI ได้';
    res.status(500).json({ error: message });
  }
});

// 3. AI Accounting Expert Q&A Chat
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, contextSummary, history } = req.body as {
      message: string;
      contextSummary?: string;
      history?: Array<{ role: 'user' | 'model'; text: string }>;
    };

    if (!message?.trim()) {
      return res.status(400).json({ error: 'กรุณาระบุคำถาม' });
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
    res.json({ reply: response.text || '' });
  } catch (err: unknown) {
    console.error('AI chat error:', err);
    const message = err instanceof Error ? err.message : 'ไม่สามารถติดต่อ AI ผู้เชี่ยวชาญได้';
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  const port = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`PCU Ledger server running on http://0.0.0.0:${port}`);
  });
}

startServer();
