import {
  AccrualExpenseNode,
  CategoryGroup,
  LedgerTransaction,
  PcuSettings,
  ProjectItem,
} from '../types/accounting';

// 13 หมวดรายรับเงินบำรุง ตามแบบฟอร์มรายงานการรับ-จ่ายเงินบำรุง รพ.สต. (PCU Money)
export const INCOME_CATEGORIES: CategoryGroup[] = [
  {
    code: 'INC_01',
    number: 1,
    name: '1. รับค่ารักษาพยาบาล',
    shortLabel: 'ค่ารักษาพยาบาล',
    subItems: [
      { code: 'INC_01_01', name: 'รับเงินค่ากลุ่มบริการ กลุ่มข้าราชการ / รัฐวิสาหกิจ' },
      { code: 'INC_01_02', name: 'รับเงินค่ากลุ่มบริการ ทุกประเภท ยกเว้น กลุ่ม ขรก. / รัฐวิสาหกิจ' },
      { code: 'INC_01_03', name: 'เงินโอน รักษา กองทุนประกันสังคม' },
      { code: 'INC_01_04', name: 'เงินโอน ทันตกรรม กองทุนประกันสังคม' },
      { code: 'INC_01_05', name: 'เงินโอน แพทย์แผนไทย กองทุนประกันสังคม' },
      { code: 'INC_01_06', name: 'เงินโอน ผู้ป่วยสิทธิ พนักงาน ข้าราชการ จาก อปท.' },
      { code: 'INC_01_07', name: 'เงินโอน แรงงานต่างด้าว' },
      { code: 'INC_01_08', name: 'เงินโอน พรบ.ผู้ประสบภัยจากรถ' },
      { code: 'INC_01_09', name: 'เงินโอน กรมบัญชีกลาง (จ่ายตรง)' },
      { code: 'INC_01_10', name: 'เงินโอน จาก สปสช.' },
    ],
  },
  {
    code: 'INC_02',
    number: 2,
    name: '2. ค่าธรรมเนียม บริการทางการแพทย์ / ค่าบำรุง',
    shortLabel: 'ธรรมเนียม/บำรุง',
    subItems: [],
  },
  {
    code: 'INC_03',
    number: 3,
    name: '3. เงินบริจาค (ตามระเบียบเงินบริจาค)',
    shortLabel: 'เงินบริจาค',
    subItems: [],
  },
  {
    code: 'INC_04',
    number: 4,
    name: '4. ดอกเบี้ยเงินฝากธนาคาร (ทุกบัญชี)',
    shortLabel: 'ดอกเบี้ย',
    subItems: [],
  },
  {
    code: 'INC_05',
    number: 5,
    name: '5. งบกองทุนหลักประกันสุขภาพ (UC)',
    shortLabel: 'งบ UC (สปสช.)',
    subItems: [
      { code: 'INC_05_01', name: 'Fixed cost' },
      { code: 'INC_05_02', name: 'ค่าจ้างชั่วคราวกลุ่มวิชาชีพ' },
      { code: 'INC_05_03', name: 'ค่าตอบแทนเบี้ยเลี้ยงเหมาจ่ายฯ พ.ศ. 2566 (ฉ.10 / ฉ.11)' },
      { code: 'INC_05_04', name: 'ผลงานการให้บริการผู้ป่วยนอก' },
      { code: 'INC_05_05', name: 'โครงการ P & P / งบเหมาจ่ายรายหัว' },
      { code: 'INC_05_06', name: 'งบค่าผลงานบริการอื่นๆ เช่น แพทย์แผนไทย, Pap smear' },
      { code: 'INC_05_07', name: 'งบลงทุน / งบค่าเสื่อม' },
    ],
  },
  {
    code: 'INC_06',
    number: 6,
    name: '6. กองทุนสุขภาพ จาก องค์การบริหารส่วนท้องถิ่น',
    shortLabel: 'กองทุนสุขภาพ อปท.',
    subItems: [],
  },
  {
    code: 'INC_07',
    number: 7,
    name: '7. เงินรับฝากประกันสังคม / รับฝากอื่นๆ',
    shortLabel: 'เงินรับฝาก ปกส./อื่นๆ',
    subItems: [],
  },
  {
    code: 'INC_08',
    number: 8,
    name: '8. เงินรับฝากภาษี หัก ณ ที่จ่าย',
    shortLabel: 'รับฝากภาษี หัก ณ ที่จ่าย',
    subItems: [],
  },
  {
    code: 'INC_09',
    number: 9,
    name: '9. รับเงินอื่นๆ จาก องค์การบริหารส่วนท้องถิ่น',
    shortLabel: 'รับอื่นๆ จาก อปท.',
    subItems: [],
  },
  {
    code: 'INC_10',
    number: 10,
    name: '10. รับเงินอื่นๆ จาก สสจ.',
    shortLabel: 'รับอื่นๆ จาก สสจ.',
    subItems: [],
  },
  {
    code: 'INC_11',
    number: 11,
    name: '11. รับเงินอื่นๆ จาก รพ.แม่ข่าย',
    shortLabel: 'รับจาก รพ.แม่ข่าย',
    subItems: [],
  },
  {
    code: 'INC_12',
    number: 12,
    name: '12. เงินรับโอนระหว่าง รพ.สต. / สสอ.',
    shortLabel: 'รับโอนระหว่างหน่วย',
    subItems: [],
  },
  {
    code: 'INC_13',
    number: 13,
    name: '13. รับเงินอื่น ๆ',
    shortLabel: 'รายรับอื่นๆ',
    subItems: [],
  },
];

// 14 หมวดรายจ่ายเงินบำรุง ตามแบบฟอร์มมาตรฐาน (เกณฑ์เงินสด)
export const EXPENSE_CATEGORIES: CategoryGroup[] = [
  {
    code: 'EXP_01',
    number: 1,
    name: '1. ค่าจ้าง (มีคำสั่งจ้าง)',
    shortLabel: 'ค่าจ้าง',
    subItems: [
      { code: 'EXP_01_01', name: 'พนักงานกระทรวงสาธารณสุข' },
      { code: 'EXP_01_02', name: 'ค่าจ้างชั่วคราว' },
      { code: 'EXP_01_03', name: 'ค่าจ้างเหมาบุคลากรกลุ่มวิชาชีพ' },
    ],
  },
  {
    code: 'EXP_02',
    number: 2,
    name: '2. ค่าตอบแทน',
    shortLabel: 'ค่าตอบแทน',
    subItems: [
      { code: 'EXP_02_01', name: 'ค่าตอบแทน ปฏิบัติงานนอกเวลาราชการ' },
      { code: 'EXP_02_02', name: 'ค่าตอบแทนเบี้ยเลี้ยงเหมาจ่ายฯ พ.ศ. 2566 (ฉ.10 / ฉ.11)' },
      { code: 'EXP_02_03', name: 'ค่าตอบแทน ผู้ช่วยเหลือผู้ดูแลผู้ที่มีภาวะพึ่งพิง (Care giver)' },
      { code: 'EXP_02_04', name: 'ค่าตอบแทนอื่น' },
    ],
  },
  {
    code: 'EXP_03',
    number: 3,
    name: '3. ค่าใช้จ่ายในการเดินทางไปราชการ (ไปประชุมชี้แจง)',
    shortLabel: 'ค่าใช้สอย (เดินทาง)',
    subItems: [],
  },
  {
    code: 'EXP_04',
    number: 4,
    name: '4. ค่าใช้จ่ายในการสัมมนาและฝึกอบรม (ที่มีค่าลงทะเบียน)',
    shortLabel: 'ค่าใช้สอย (อบรม)',
    subItems: [],
  },
  {
    code: 'EXP_05',
    number: 5,
    name: '5. ค่าใช้จ่ายตามโครงการ (รายจ่ายในโครงการทั้งหมด)',
    shortLabel: 'ค่าใช้จ่ายตามโครงการ',
    subItems: [
      { code: 'EXP_05_01', name: 'โครงการส่งเสริมป้องกัน P & P' },
      { code: 'EXP_05_02', name: 'โครงการ งบกองทุนหลักประกันสุขภาพ' },
    ],
  },
  {
    code: 'EXP_06',
    number: 6,
    name: '6. ค่าซ่อมแซมและบำรุงรักษา',
    shortLabel: 'ค่าใช้สอย (ซ่อมแซม)',
    subItems: [],
  },
  {
    code: 'EXP_07',
    number: 7,
    name: '7. ค่าจ้างเหมาบริการ',
    shortLabel: 'ค่าใช้สอย',
    subItems: [],
  },
  {
    code: 'EXP_08',
    number: 8,
    name: '8. ค่าวัสดุ (ไม่รวมซื้อตามโครงการ)',
    shortLabel: 'ค่าวัสดุ',
    subItems: [
      { code: 'EXP_08_01', name: 'วัสดุการแพทย์' },
      { code: 'EXP_08_02', name: 'วัสดุสำนักงาน' },
      { code: 'EXP_08_03', name: 'วัสดุเชื้อเพลิง และหล่อลื่น' },
      { code: 'EXP_08_04', name: 'วัสดุไฟฟ้าและวิทยุ' },
      { code: 'EXP_08_05', name: 'วัสดุคอมพิวเตอร์' },
      { code: 'EXP_08_06', name: 'วัสดุงานบ้านงานครัว' },
      { code: 'EXP_08_07', name: 'วัสดุอื่น' },
    ],
  },
  {
    code: 'EXP_09',
    number: 9,
    name: '9. ค่าสาธารณูปโภค',
    shortLabel: 'ค่าสาธารณูปโภค',
    subItems: [
      { code: 'EXP_09_01', name: 'ค่าไฟฟ้า' },
      { code: 'EXP_09_02', name: 'ค่าน้ำประปา' },
      { code: 'EXP_09_03', name: 'ค่าโทรศัพท์ / อินเทอร์เน็ต / ไปรษณีย์' },
    ],
  },
  {
    code: 'EXP_10',
    number: 10,
    name: '10. ค่าครุภัณฑ์',
    shortLabel: 'ค่าครุภัณฑ์',
    subItems: [],
  },
  {
    code: 'EXP_11',
    number: 11,
    name: '11. เงินสมทบประกันสังคม / กองทุนสำรองเลี้ยงชีพ / กองทุนเงินทดแทน',
    shortLabel: 'สมทบประกันสังคม/กองทุน',
    subItems: [
      { code: 'EXP_11_01', name: 'สมทบประกันสังคม / กองทุนสำรองเลี้ยงชีพ ส่วนนายจ้าง' },
      { code: 'EXP_11_02', name: 'สมทบประกันสังคม / กองทุนสำรองเลี้ยงชีพ ส่วนลูกจ้าง' },
      { code: 'EXP_11_03', name: 'กองทุนเงินทดแทน' },
    ],
  },
  {
    code: 'EXP_12',
    number: 12,
    name: '12. เงินโอนระหว่าง รพ.สต. / สสอ.',
    shortLabel: 'เงินโอนระหว่างหน่วย',
    subItems: [],
  },
  {
    code: 'EXP_13',
    number: 13,
    name: '13. นำส่งสรรพากร ภาษี หัก ณ ที่จ่าย / กองทุนกู้ยืมเพื่อการศึกษา',
    shortLabel: 'นำส่งสรรพากร',
    subItems: [],
  },
  {
    code: 'EXP_14',
    number: 14,
    name: '14. ค่าใช้จ่ายอื่น ๆ',
    shortLabel: 'ค่าใช้จ่ายอื่นๆ',
    subItems: [],
  },
];

// ผังหมวดรายจ่ายระบบเกณฑ์คงค้าง (11 หมวดหลัก + หมวดย่อยครบตามแบบรายงาน PCU Money)
export const ACCRUAL_EXPENSE_NODES: AccrualExpenseNode[] = [
  { code: 'ACC_EXP_01', label: '1. ค่าจ้าง (มีคำสั่งจ้าง)', level: 1 },
  { code: 'ACC_EXP_01_01', label: 'พนักงานกระทรวงสาธารณสุข', level: 3 },
  { code: 'ACC_EXP_01_02', label: 'ค่าจ้างชั่วคราว', level: 3 },
  { code: 'ACC_EXP_01_03', label: 'ค่าจ้างเหมาบุคลากรกลุ่มวิชาชีพ', level: 3 },

  { code: 'ACC_EXP_02', label: '2. ค่าตอบแทน', level: 1 },
  { code: 'ACC_EXP_02_01', label: 'ค่าตอบแทน ปฏิบัติงานนอกเวลาราชการ', level: 3 },
  { code: 'ACC_EXP_02_02', label: 'ค่าตอบแทนเบี้ยเลี้ยงเหมาจ่ายฯ พ.ศ. 2566 (ฉ.10 / ฉ.11)', level: 3 },
  { code: 'ACC_EXP_02_03', label: 'ค่าตอบแทนผู้ช่วยเหลือดูแลผู้ที่มีภาวะพึ่งพิง (Care giver)', level: 3 },
  { code: 'ACC_EXP_02_04', label: 'ค่าตอบแทนอื่น (โปรดระบุ)...', level: 3 },

  { code: 'ACC_EXP_03', label: '3. หมวดค่าใช้สอย', level: 1 },
  { code: 'ACC_EXP_03_01', label: '3.1 ค่าใช้จ่ายในการเดินทางไปราชการ (ไม่รวมทุนที่ส่ง)', level: 2 },
  { code: 'ACC_EXP_03_01_01', label: 'ค่าเบี้ยเลี้ยง', level: 3 },
  { code: 'ACC_EXP_03_01_02', label: 'ค่าที่พัก', level: 3 },
  { code: 'ACC_EXP_03_01_03', label: 'ค่าใช้จ่ายอื่นๆ เช่น ค่าพาหนะ/ค่าเชื้อเพลิงเดินทางไปราชการ', level: 3 },

  { code: 'ACC_EXP_03_02', label: '3.2 ค่าใช้จ่ายในการสัมมนาและฝึกอบรม (ไปประชุม อบรมที่มีค่าลงทะเบียน)', level: 2 },

  { code: 'ACC_EXP_03_03', label: '3.3 ค่าใช้จ่ายตามโครงการ (รายจ่ายในโครงการทั้งหมด)', level: 2 },
  { code: 'ACC_EXP_03_03_01', label: 'โครงการส่งเสริมป้องกัน P & P', level: 3 },
  { code: 'ACC_EXP_03_03_02', label: 'โครงการ งบกองทุนหลักประกันสุขภาพ', level: 3 },

  { code: 'ACC_EXP_03_04', label: '3.4 ค่าซ่อมแซมและบำรุงรักษา', level: 2 },
  { code: 'ACC_EXP_03_04_01', label: 'ค่าซ่อมแซมอาคารและสิ่งปลูกสร้าง', level: 3 },
  { code: 'ACC_EXP_03_04_02', label: 'ค่าซ่อมแซมครุภัณฑ์สำนักงาน', level: 3 },
  { code: 'ACC_EXP_03_04_03', label: 'ค่าซ่อมแซมครุภัณฑ์ยานพาหนะ', level: 3 },
  { code: 'ACC_EXP_03_04_04', label: 'ค่าซ่อมแซมครุภัณฑ์ไฟฟ้าและวิทยุ', level: 3 },
  { code: 'ACC_EXP_03_04_05', label: 'ค่าซ่อมแซมครุภัณฑ์โฆษณาและเผยแพร่', level: 3 },
  { code: 'ACC_EXP_03_04_06', label: 'ค่าซ่อมแซมครุภัณฑ์วิทยาศาสตร์และการแพทย์', level: 3 },
  { code: 'ACC_EXP_03_04_07', label: 'ค่าซ่อมแซมครุภัณฑ์คอมพิวเตอร์', level: 3 },
  { code: 'ACC_EXP_03_04_08', label: 'ค่าซ่อมแซมครุภัณฑ์อื่น', level: 3 },

  { code: 'ACC_EXP_03_05', label: '3.5 ค่าจ้างเหมาบริการ', level: 2 },
  { code: 'ACC_EXP_03_05_01', label: 'ผู้ช่วยเหลือผู้ดูแลผู้ที่มีภาวะพึ่งพิง (Care giver)', level: 3 },
  { code: 'ACC_EXP_03_05_02', label: 'ผู้ช่วยเจ้าหน้าที่สาธารณสุข', level: 3 },
  { code: 'ACC_EXP_03_05_03', label: 'พนักงานช่วยเหลือผู้มารับบริการ', level: 3 },
  { code: 'ACC_EXP_03_05_04', label: 'พนักงานขับรถ', level: 3 },
  { code: 'ACC_EXP_03_05_05', label: 'พนักงานธุรการ', level: 3 },
  { code: 'ACC_EXP_03_05_06', label: 'พนักงานเกษตรพื้นฐาน', level: 3 },
  { code: 'ACC_EXP_03_05_07', label: 'พนักงานช่างทั่วไป', level: 3 },
  { code: 'ACC_EXP_03_05_08', label: 'พนักงานบันทึกข้อมูล', level: 3 },
  { code: 'ACC_EXP_03_05_09', label: 'ผู้ช่วยแพทย์แผนไทย', level: 3 },
  { code: 'ACC_EXP_03_05_10', label: 'ผู้ช่วยทันตกรรม', level: 3 },
  { code: 'ACC_EXP_03_05_11', label: 'งานนักส่งเสริมสุขภาพ', level: 3 },
  { code: 'ACC_EXP_03_05_12', label: 'เจ้าหน้าที่การเงินและบัญชี', level: 3 },
  { code: 'ACC_EXP_03_05_13', label: 'นักวิชาการสาธารณสุข', level: 3 },
  { code: 'ACC_EXP_03_05_14', label: 'ค่าจ้างเหมาทำความสะอาด', level: 3 },
  { code: 'ACC_EXP_03_05_15', label: 'ค่าจ้างเหมาตรวจทางห้องปฏิบัติการ LAB', level: 3 },
  { code: 'ACC_EXP_03_05_16', label: 'ค่าจ้างเหมาเก็บขยะ', level: 3 },
  { code: 'ACC_EXP_03_05_17', label: 'ค่าบำรุงรักษาซอฟต์แวร์', level: 3 },
  { code: 'ACC_EXP_03_05_18', label: 'ค่ากำจัดขยะและสิ่งปฏิกูล', level: 3 },
  { code: 'ACC_EXP_03_05_19', label: 'ค่าจ้างเหมาบริการอื่น ๆ', level: 3 },

  { code: 'ACC_EXP_04', label: '4. ค่าวัสดุ (ไม่รวมซื้อตามโครงการ)', level: 1 },
  { code: 'ACC_EXP_04_01', label: 'วัสดุการแพทย์', level: 3 },
  { code: 'ACC_EXP_04_02', label: 'วัสดุสำนักงาน', level: 3 },
  { code: 'ACC_EXP_04_03', label: 'วัสดุยานพาหนะ', level: 3 },
  { code: 'ACC_EXP_04_04', label: 'วัสดุเชื้อเพลิง และหล่อลื่น', level: 3 },
  { code: 'ACC_EXP_04_05', label: 'วัสดุไฟฟ้าและวิทยุ', level: 3 },
  { code: 'ACC_EXP_04_06', label: 'วัสดุโฆษณาและเผยแพร่', level: 3 },
  { code: 'ACC_EXP_04_07', label: 'วัสดุคอมพิวเตอร์', level: 3 },
  { code: 'ACC_EXP_04_08', label: 'วัสดุงานบ้านงานครัว', level: 3 },
  { code: 'ACC_EXP_04_09', label: 'วัสดุก่อสร้าง', level: 3 },
  { code: 'ACC_EXP_04_10', label: 'วัสดุอื่น', level: 3 },

  { code: 'ACC_EXP_05', label: '5. ค่าสาธารณูปโภค', level: 1 },
  { code: 'ACC_EXP_05_01', label: 'ค่าไฟฟ้า', level: 3 },
  { code: 'ACC_EXP_05_02', label: 'ค่าน้ำประปา', level: 3 },
  { code: 'ACC_EXP_05_03', label: 'ค่าโทรศัพท์', level: 3 },
  { code: 'ACC_EXP_05_04', label: 'ค่าบริการสื่อสารและโทรคมนาคม / อินเทอร์เน็ต', level: 3 },
  { code: 'ACC_EXP_05_05', label: 'ค่าไปรษณีย์และโทรเลข', level: 3 },

  { code: 'ACC_EXP_06', label: '6. ค่าครุภัณฑ์ (ราคาต่อหน่วยเกิน 10,000 บาท ไม่รวมเงิน ซื้อด้วยเงินบำรุง)', level: 1 },
  { code: 'ACC_EXP_06_01', label: 'ครุภัณฑ์สำนักงาน', level: 3 },
  { code: 'ACC_EXP_06_02', label: 'ครุภัณฑ์ทางการแพทย์', level: 3 },
  { code: 'ACC_EXP_06_03', label: 'ครุภัณฑ์คอมพิวเตอร์', level: 3 },
  { code: 'ACC_EXP_06_04', label: 'ครุภัณฑ์งานบ้านงานครัว', level: 3 },
  { code: 'ACC_EXP_06_05', label: 'ครุภัณฑ์โฆษณาและเผยแพร่', level: 3 },
  { code: 'ACC_EXP_06_06', label: 'ครุภัณฑ์การเกษตร', level: 3 },
  { code: 'ACC_EXP_06_07', label: 'ครุภัณฑ์ยานพาหนะและขนส่ง', level: 3 },
  { code: 'ACC_EXP_06_08', label: 'ครุภัณฑ์ไฟฟ้าและวิทยุ', level: 3 },
  { code: 'ACC_EXP_06_09', label: 'ครุภัณฑ์ก่อสร้าง', level: 3 },
  { code: 'ACC_EXP_06_10', label: 'ครุภัณฑ์อื่น', level: 3 },

  { code: 'ACC_EXP_07', label: '7. เงินสมทบประกันสังคม / กองทุนสำรองเลี้ยงชีพ / กองทุนเงินทดแทน', level: 1 },
  { code: 'ACC_EXP_07_01', label: 'สมทบประกันสังคม ส่วนนายจ้าง', level: 3 },
  { code: 'ACC_EXP_07_02', label: 'สมทบประกันสังคม ส่วนลูกจ้าง', level: 3 },
  { code: 'ACC_EXP_07_03', label: 'กองทุนสำรองเลี้ยงชีพ ส่วนนายจ้าง', level: 3 },
  { code: 'ACC_EXP_07_04', label: 'กองทุนสำรองเลี้ยงชีพ ส่วนลูกจ้าง', level: 3 },
  { code: 'ACC_EXP_07_05', label: 'กองทุนเงินทดแทน', level: 3 },

  { code: 'ACC_EXP_08', label: '8. เงินโอนระหว่าง รพ.สต. / สสอ. (โปรดระบุ)...', level: 1 },
  { code: 'ACC_EXP_09', label: '9. นำส่ง ภาษี หัก ณ ที่จ่าย', level: 1 },
  { code: 'ACC_EXP_10', label: '10. นำส่ง กองทุนกู้ยืมเพื่อการศึกษา ( กยศ. )', level: 1 },

  { code: 'ACC_EXP_11', label: '11. ค่าใช้จ่ายอื่น ๆ', level: 1 },
  { code: 'ACC_EXP_11_01', label: 'ค่าที่ดินและสิ่งก่อสร้าง', level: 3 },
  { code: 'ACC_EXP_11_02', label: 'ค่าธรรมเนียมธนาคาร', level: 3 },
  { code: 'ACC_EXP_11_03', label: 'ส่งเงินคืนกองทุนสุขภาพตำบล', level: 3 },
  { code: 'ACC_EXP_11_04', label: 'เงินอุดหนุน', level: 3 },
  { code: 'ACC_EXP_11_05', label: 'ชดเชยนิติกรรมทรัพย์', level: 3 },
  { code: 'ACC_EXP_11_06', label: 'คืนเงินประกันสัญญา', level: 3 },
  { code: 'ACC_EXP_11_07', label: 'ส่งเงินคืนคลัง', level: 3 },
  { code: 'ACC_EXP_11_08', label: 'อื่นๆ โปรดระบุ...', level: 3 },
];

export const ACCRUAL_SELECTABLE_LEAVES = ACCRUAL_EXPENSE_NODES.filter(
  (n) =>
    n.level === 3 ||
    ['ACC_EXP_03_02', 'ACC_EXP_08', 'ACC_EXP_09', 'ACC_EXP_10'].includes(n.code)
);

export function resolveAccrualExpenseCode(tx: LedgerTransaction): string {
  if (tx.accrualCode) return tx.accrualCode;
  const desc = tx.description.toLowerCase();

  if (tx.categoryCode === 'EXP_01') {
    if (tx.subCategoryCode === 'EXP_01_01') return 'ACC_EXP_01_01';
    if (tx.subCategoryCode === 'EXP_01_02') return 'ACC_EXP_01_02';
    return 'ACC_EXP_01_03';
  }
  if (tx.categoryCode === 'EXP_02') {
    if (tx.subCategoryCode === 'EXP_02_01') return 'ACC_EXP_02_01';
    if (tx.subCategoryCode === 'EXP_02_02') return 'ACC_EXP_02_02';
    if (tx.subCategoryCode === 'EXP_02_03') return 'ACC_EXP_02_03';
    return 'ACC_EXP_02_04';
  }
  if (tx.categoryCode === 'EXP_03') return 'ACC_EXP_03_01_03';
  if (tx.categoryCode === 'EXP_04') return 'ACC_EXP_03_02';
  if (tx.categoryCode === 'EXP_05') {
    return tx.subCategoryCode === 'EXP_05_02'
      ? 'ACC_EXP_03_03_02'
      : 'ACC_EXP_03_03_01';
  }
  if (tx.categoryCode === 'EXP_06') return 'ACC_EXP_03_04_08';
  if (tx.categoryCode === 'EXP_07') {
    if (desc.includes('ทำความสะอาด')) return 'ACC_EXP_03_05_14';
    if (desc.includes('ขยะ') || desc.includes('ปฏิกูล')) return 'ACC_EXP_03_05_18';
    if (desc.includes('ซอฟต์แวร์')) return 'ACC_EXP_03_05_17';
    if (desc.includes('lab') || desc.includes('ปฏิบัติการ')) return 'ACC_EXP_03_05_15';
    return 'ACC_EXP_03_05_19';
  }
  if (tx.categoryCode === 'EXP_08') {
    const map: Record<string, string> = {
      EXP_08_01: 'ACC_EXP_04_01',
      EXP_08_02: 'ACC_EXP_04_02',
      EXP_08_03: 'ACC_EXP_04_04',
      EXP_08_04: 'ACC_EXP_04_05',
      EXP_08_05: 'ACC_EXP_04_07',
      EXP_08_06: 'ACC_EXP_04_08',
    };
    return map[tx.subCategoryCode] || 'ACC_EXP_04_10';
  }
  if (tx.categoryCode === 'EXP_09') {
    if (tx.subCategoryCode === 'EXP_09_01' || desc.includes('ไฟฟ้า')) {
      return 'ACC_EXP_05_01';
    }
    if (tx.subCategoryCode === 'EXP_09_02' || desc.includes('ประปา')) {
      return 'ACC_EXP_05_02';
    }
    if (desc.includes('ไปรษณีย์')) return 'ACC_EXP_05_05';
    if (desc.includes('อินเทอร์เน็ต') || desc.includes('เน็ต')) {
      return 'ACC_EXP_05_04';
    }
    return 'ACC_EXP_05_03';
  }
  if (tx.categoryCode === 'EXP_10') return 'ACC_EXP_06_10';
  if (tx.categoryCode === 'EXP_11') {
    if (tx.subCategoryCode === 'EXP_11_01') return 'ACC_EXP_07_01';
    if (tx.subCategoryCode === 'EXP_11_02') return 'ACC_EXP_07_02';
    return 'ACC_EXP_07_05';
  }
  if (tx.categoryCode === 'EXP_12') return 'ACC_EXP_08';
  if (tx.categoryCode === 'EXP_13') {
    return desc.includes('กยศ') ? 'ACC_EXP_10' : 'ACC_EXP_09';
  }
  return 'ACC_EXP_11_08';
}

export const FISCAL_MONTHS = [
  { key: '2026-10', label: 'ตุลาคม 2569', shortLabel: 'ต.ค. 69', monthName: 'ตุลาคม', beYear: 2569 },
  { key: '2026-11', label: 'พฤศจิกายน 2569', shortLabel: 'พ.ย. 69', monthName: 'พฤศจิกายน', beYear: 2569 },
  { key: '2026-12', label: 'ธันวาคม 2569', shortLabel: 'ธ.ค. 69', monthName: 'ธันวาคม', beYear: 2569 },
  { key: '2027-01', label: 'มกราคม 2570', shortLabel: 'ม.ค. 70', monthName: 'มกราคม', beYear: 2570 },
  { key: '2027-02', label: 'กุมภาพันธ์ 2570', shortLabel: 'ก.พ. 70', monthName: 'กุมภาพันธ์', beYear: 2570 },
  { key: '2027-03', label: 'มีนาคม 2570', shortLabel: 'มี.ค. 70', monthName: 'มีนาคม', beYear: 2570 },
  { key: '2027-04', label: 'เมษายน 2570', shortLabel: 'เม.ย. 70', monthName: 'เมษายน', beYear: 2570 },
  { key: '2027-05', label: 'พฤษภาคม 2570', shortLabel: 'พ.ค. 70', monthName: 'พฤษภาคม', beYear: 2570 },
  { key: '2027-06', label: 'มิถุนายน 2570', shortLabel: 'มิ.ย. 70', monthName: 'มิถุนายน', beYear: 2570 },
  { key: '2027-07', label: 'กรกฎาคม 2570', shortLabel: 'ก.ค. 70', monthName: 'กรกฎาคม', beYear: 2570 },
  { key: '2027-08', label: 'สิงหาคม 2570', shortLabel: 'ส.ค. 70', monthName: 'สิงหาคม', beYear: 2570 },
  { key: '2027-09', label: 'กันยายน 2570', shortLabel: 'ก.ย. 70', monthName: 'กันยายน', beYear: 2570 },
];

export const DEFAULT_PROJECTS: ProjectItem[] = [
  {
    id: 'proj-1',
    order: 1,
    type: 'fund_project',
    shortName: 'เด็กอ้วน งบ 60,000',
    fullName: 'โครงการแก้ไขภาวะโภชนาการ ปี 2570',
    openingBalance: 0,
  },
  {
    id: 'proj-2',
    order: 2,
    type: 'pp_project',
    shortName: 'ผู้สูงอายุ งบ 30,000',
    fullName: 'โครงการส่งเสริมสุขภาพผู้สูงอายุ ปี 2570',
    openingBalance: 0,
  },
  {
    id: 'proj-3',
    order: 3,
    type: 'sub_404',
    shortName: 'ภาษีหัก ณ ที่จ่าย',
    fullName: 'ทะเบียนคุมภาษี หัก ณ ที่จ่าย',
    openingBalance: 0,
  },
  {
    id: 'proj-4',
    order: 4,
    type: 'fund_project',
    shortName: 'ไข้เลือดออก งบ 10,000',
    fullName: 'โครงการป้องกันโรคไข้เลือดออก ปี 2570',
    openingBalance: 0,
  },
  {
    id: 'proj-10',
    order: 10,
    type: 'fund_project',
    shortName: 'LTC 2569',
    fullName: 'โครงการดูแลผู้ป่วยระยะยาวปี 2570',
    openingBalance: 0,
  },
  {
    id: 'proj-11',
    order: 11,
    type: 'sub_404',
    shortName: 'นวดแผนไทย',
    fullName: 'รับเงินจากผู้ป่วยค่านวดแผนไทย',
    openingBalance: 0,
  },
];

export const DEFAULT_PCU_SETTINGS: PcuSettings = {
  unitName: 'โรงพยาบาลส่งเสริมสุขภาพตำบลบ้านรี',
  address: 'อ.ดอนพุด จ.สระบุรี',
  affiliation: 'moph',
  affiliationLabel: 'สำนักงานสาธารณสุขอำเภอดอนพุด จ.สระบุรี',
  fiscalYearBE: 2570,
  fiscalStartDate: '2026-10-01',
  fiscalEndDate: '2027-09-30',
  bankAccounts: [
    {
      id: 'bank-1',
      order: 1,
      name: 'เงินบำรุง สอ.บ้านรี',
      fundType: 'นอกงบประมาณ',
      accountNo: '015072077799',
      openingBank: 295625.42,
      openingCash: 3859.0,
      openingLoan: 0,
      openingAdvance: 0,
      openingCheque: 0,
    },
    {
      id: 'bank-2',
      order: 2,
      name: 'โรงพยาบาลส่งเสริมสุขภาพตำบลบ้านรี',
      fundType: 'นอกงบประมาณ',
      accountNo: '136042795',
      openingBank: 19395.92,
      openingCash: 0,
      openingLoan: 0,
      openingAdvance: 0,
      openingCheque: 0,
    },
  ],
  projects: DEFAULT_PROJECTS,
  officers: {
    cashCommittee1: 'น.ส.ธัญชนก คำประกอบ',
    cashCommittee2: 'นายสมพงษ์ มลิวัลย์',
    cashCommittee3: 'นายศุภฤกษ์ แสงประจวบ',
    cashReceiver407: 'นายสมพงษ์ มลิวัลย์',
    financeOfficer: 'นายสมพงษ์ มลิวัลย์',
    unitHead: 'นายสมพงษ์ มลิวัลย์',
    chequeSigner1: 'ธัญชนก',
    chequeSigner2: 'จิราภรณ์',
    chequeSigner3: '',
  },
  docPrefixes: {
    expensePrefix: 'สบ1133.6.2/',
    receiptBookMain: 'สบ./ดพ.041',
    receiptBookSub1: '',
    receiptBookSub2: '',
  },
  linkedSpreadsheetId: '',
  linkedSpreadsheetTitle: '',
  backupSync: {
    backupReminderEnabled: true,
    backupIntervalDays: 15,
    lastBackupAt: null,
    warnBeforeClose: true,
    sheetsConnectionEnabled: true,
    autoSyncSheetsEnabled: false,
    autoSyncIntervalMinutes: 5,
    lastAutoSyncAt: null,
    lockedGoogleEmail: '',
    sheetsSettingsLocked: false,
    sheetsLockPin: '',
  },
};

// ข้อมูลเริ่มต้นเดือนตุลาคม 2569 ตรงตามตัวอย่างรายงานแบบ 401, 404, 407, หน้างบใบสำคัญ และงบเกณฑ์คงค้าง
export const DEFAULT_TRANSACTIONS: LedgerTransaction[] = [
  {
    id: 'tx-25691001-1',
    date: '2026-10-01',
    type: 'income',
    docNo: '',
    categoryCode: 'INC_08',
    subCategoryCode: '',
    description: 'รับฝาก(หักเช็ค/e-pay) ภาษีหัก ณ ที่จ่าย',
    amount: 50.0,
    paymentMethod: 'bank',
    bankAccountId: 'bank-1',
    issuerName: 'นายสมพงษ์ มลิวัลย์',
    createdAt: '2026-10-01T09:00:00.000Z',
  },
  {
    id: 'tx-25691001-2',
    date: '2026-10-01',
    type: 'expense',
    docNo: 'สบ1133.6.2/99',
    categoryCode: 'EXP_07',
    subCategoryCode: '',
    accrualCode: 'ACC_EXP_03_05_14',
    description: 'จ้างเหมาบริการทำความสะอาด ต.ค.69',
    amount: 5000.0,
    paymentMethod: 'cheque',
    bankAccountId: 'bank-1',
    chequeNo: '61438789',
    issuerName: 'นายสมพงษ์ มลิวัลย์',
    createdAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'tx-25691001-3',
    date: '2026-10-01',
    type: 'expense',
    docNo: 'สบ1133.6.2/98',
    categoryCode: 'EXP_13',
    subCategoryCode: '',
    accrualCode: 'ACC_EXP_09',
    description: 'ภาษีหัก ณ ที่จ่าย',
    amount: 289.54,
    paymentMethod: 'cheque',
    bankAccountId: 'bank-1',
    chequeNo: '61438790',
    issuerName: 'นายสมพงษ์ มลิวัลย์',
    createdAt: '2026-10-01T10:30:00.000Z',
  },
  {
    id: 'tx-25691016-1',
    date: '2026-10-16',
    type: 'income',
    docNo: 'สบ./ดพ.041 / 01 - 01',
    categoryCode: 'INC_01',
    subCategoryCode: 'INC_01_01',
    description: 'ค่ายา ขรก./รัฐวิสาหกิจ',
    amount: 200.0,
    paymentMethod: 'cash',
    bankAccountId: 'bank-1',
    issuerName: 'นายสมพงษ์ มลิวัลย์',
    createdAt: '2026-10-16T11:00:00.000Z',
  },
  {
    id: 'tx-25691021-1',
    date: '2026-10-21',
    type: 'income',
    docNo: 'สบ./ดพ.041 / 02 - 02',
    categoryCode: 'INC_01',
    subCategoryCode: 'INC_01_01',
    description: 'ค่ายา ขรก./รัฐวิสาหกิจ',
    amount: 250.0,
    paymentMethod: 'cash',
    bankAccountId: 'bank-1',
    issuerName: 'นายสมพงษ์ มลิวัลย์',
    createdAt: '2026-10-21T14:00:00.000Z',
  },
  {
    id: 'tx-25691022-1',
    date: '2026-10-22',
    type: 'income',
    docNo: 'สบ./ดพ.041 / 3 - 3',
    categoryCode: 'INC_01',
    subCategoryCode: 'INC_01_04',
    description: 'รับเงินโอนทันตกรรม กองทุนประกันสังคม',
    amount: 700.0,
    paymentMethod: 'bank',
    bankAccountId: 'bank-1',
    issuerName: 'นายสมพงษ์ มลิวัลย์',
    createdAt: '2026-10-22T09:30:00.000Z',
  },
  {
    id: 'tx-25691026-1',
    date: '2026-10-26',
    type: 'income',
    docNo: '',
    categoryCode: 'INC_08',
    subCategoryCode: '',
    description: 'รับฝาก(หักเช็ค/e-pay) ภาษีหัก ณ ที่จ่าย Fiber 20 10/69',
    amount: 5.9,
    paymentMethod: 'bank',
    bankAccountId: 'bank-1',
    issuerName: 'นายสมพงษ์ มลิวัลย์',
    createdAt: '2026-10-26T09:00:00.000Z',
  },
  {
    id: 'tx-25691026-2',
    date: '2026-10-26',
    type: 'expense',
    docNo: 'สบ1133.6.2/',
    categoryCode: 'EXP_09',
    subCategoryCode: 'EXP_09_03',
    accrualCode: 'ACC_EXP_05_04',
    description: 'อินเทอร์เน็ต 10/69',
    amount: 631.3,
    paymentMethod: 'cheque',
    bankAccountId: 'bank-1',
    chequeNo: '61438791',
    issuerName: 'นายสมพงษ์ มลิวัลย์',
    createdAt: '2026-10-26T10:00:00.000Z',
  },
  {
    id: 'tx-25691026-3',
    date: '2026-10-26',
    type: 'expense',
    docNo: 'สบ1133.6.2/',
    categoryCode: 'EXP_09',
    subCategoryCode: 'EXP_09_02',
    accrualCode: 'ACC_EXP_05_02',
    description: 'น้ำประปา 10/69',
    amount: 119.0,
    paymentMethod: 'cash',
    bankAccountId: 'bank-1',
    issuerName: 'นายสมพงษ์ มลิวัลย์',
    createdAt: '2026-10-26T11:00:00.000Z',
  },
  {
    id: 'tx-25691026-4',
    date: '2026-10-26',
    type: 'expense',
    docNo: 'สบ1133.6.2/',
    categoryCode: 'EXP_09',
    subCategoryCode: 'EXP_09_01',
    accrualCode: 'ACC_EXP_05_01',
    description: 'ไฟฟ้า 10/69',
    amount: 1436.8,
    paymentMethod: 'cheque',
    bankAccountId: 'bank-1',
    chequeNo: '61438792',
    issuerName: 'นายสมพงษ์ มลิวัลย์',
    createdAt: '2026-10-26T13:00:00.000Z',
  },
];

export function buildCategoriesPromptText(): string {
  const incLines = INCOME_CATEGORIES.map((cat) => {
    if (cat.subItems.length === 0) {
      return `- [รายรับ] ${cat.code}: ${cat.name}`;
    }
    const subs = cat.subItems.map((s) => `    * ${s.code}: ${s.name}`).join('\n');
    return `- [รายรับ] ${cat.code}: ${cat.name}\n${subs}`;
  }).join('\n');

  const expLines = EXPENSE_CATEGORIES.map((cat) => {
    if (cat.subItems.length === 0) {
      return `- [รายจ่าย] ${cat.code}: ${cat.name}`;
    }
    const subs = cat.subItems.map((s) => `    * ${s.code}: ${s.name}`).join('\n');
    return `- [รายจ่าย] ${cat.code}: ${cat.name}\n${subs}`;
  }).join('\n');

  return `${incLines}\n\n${expLines}`;
}
