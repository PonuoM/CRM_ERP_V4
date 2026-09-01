# SCREENS — สเปกทีละหน้า ค่าจริงทุกตัว

หน่วยตัวอักษร = **sp** · หน่วยอื่นทั้งหมด = **dp** · สีอ้างชื่อ token ใน `Design.kt`
ค่าในเอกสารนี้เป็นค่าสุดท้าย **ห้ามปัดเศษ ห้ามคิดใหม่**

---

## โครงร่วมของทุกหน้าจอ

```
FrameLayout (MATCH_PARENT, พื้น = Design.bg)
├─ [0] Design.aurora("ready")        ← ต้องเป็นลูกคนแรกเสมอ
├─ [1] เนื้อหา (LinearLayout VERTICAL / ScrollView)
└─ [2] แถบแท็บล่าง (เฉพาะ 4 หน้าแท็บ · ลอยทับ ไม่ใช่ต่อท้าย)
```

**ระยะห่างมาตรฐาน**

| ใช้กับ | ค่า |
|---|---|
| หัวเรื่อง · label หัวกลุ่ม · ข้อความทั่วไป | ร่นขอบจอ **20** |
| แผงกระจก (ลิสต์ การ์ด) | ร่นขอบจอ **18** |
| การ์ดสรุปหน้าหลัก | ร่นขอบจอ **16** |
| แถบแท็บล่าง | ร่นขอบจอ **14** ทุกด้าน |
| padding ในแผงกระจก | **16** ซ้ายขวา · **12–13** บนล่างต่อแถว |

**มุมโค้ง** — แผงลิสต์ 22 · การ์ดใหญ่ 26 · การ์ดย่อย 20 · ปุ่ม 17 · ชิป 12 · segmented ราง 14 ปุ่มใน 11 · แถบล่าง 26 · sheet 30 (เฉพาะมุมบน) · pill 999

**เงา** — แผงกระจก elevation 10 · การ์ดสรุป 14 · แถบล่าง 12 · ปุ่มหลัก 8 · ปุ่มกลมทึบ 14

---

## แถบแท็บล่าง

- ลอยทับเนื้อหา: `left/right/bottom = 14`
- พื้น `glassFillHi` · ขอบบน `glassSpecHi` · radius **26** · padding `8` บนล่าง `6` ซ้ายขวา · elevation 12
- 4 ช่อง แบ่งเท่ากัน (`weight=1`) · แต่ละช่อง: VERTICAL · CENTER · padding บนล่าง **6** · ช่องไฟไอคอน↔ป้าย **3**
- ไอคอน **22×22** · ป้าย **10.5sp**
- เลือกอยู่: พื้น `glassSelected` radius **20** · สี `ink` · น้ำหนัก **medium**
- ไม่ได้เลือก: พื้นใส · สี `ink` ที่ **55%** · น้ำหนัก **regular**
- แท็บ "ทีม" โชว์เฉพาะ `session.isSupervisor`

---

## 01 · เข้าสู่ระบบ

padding ซ้ายขวา **22** · ล่าง **26** · ไม่มีแถบแท็บ

| # | element | ค่า |
|---|---|---|
| 1 | ช่องว่างบน | **70** |
| 2 | โลโก้ | **64×64** · radius **19** · gradient 160° `#4BEF97 → #219A5C` · ไอคอน ic_call **30** สี `onGreen` · elevation 12 เงาเขียว |
| 3 | ชื่อแอป | **34sp / semi** · tracking **-0.025em** · `ink` · paddingTop **22** |
| 4 | คำอธิบาย 2 บรรทัด | **16sp** · `ink60` · lineHeight 1.55 · paddingTop **8** |
| 5 | ตัวเว้นยืด | weight 1 · อย่างน้อย **24** |
| 6 | แผงฟอร์ม | กระจก radius **20** · 3 แถว · แต่ละแถว padding **15×17** · label กว้าง **92** `16sp/ink60` · ค่า `17sp/ink` · คั่นด้วย `glassDivider(17)` |
| 7 | ช่องว่าง | **26** |
| 8 | ปุ่มเข้าสู่ระบบ | `primaryButton` เต็มความกว้าง |
| 9 | ข้อความท้าย | **13sp** · `ink40` · กลาง · paddingTop **16** · lineHeight 1.5 |

---

## 02 · หน้าหลัก ★

| # | element | ค่า |
|---|---|---|
| 1 | แถวบน | padding `15` บน `20` ซ้ายขวา · ซ้าย: `PHONE-07 · 92%` **13sp/ink** 50% (weight 1) · ขวา: ปุ่มค้นหา **34×34** วงกลม พื้น `glassFillHi` ขอบ `glassSpecular` ไอคอน **17** |
| 2 | ชิปสถานะ | `statusPill` · paddingTop **20** จากแถวบน · ซ้ายชิดขอบ 20 · จุดเขียวมีเงาเรือง `0 0 10 rgba(61,220,132,0.9)` |
| 3 | คำทักทาย | **36sp / semi** · tracking **-0.025em** · lineHeight 1.12 · `ink` · paddingTop **16** · 2 บรรทัด `สวัสดีตอนบ่าย` / `<ชื่อ>` |
| 4 | **การ์ดสรุป** | margin ซ้ายขวา **16** · marginTop **22** · radius **26** · padding **20** · elevation 14 · **พื้น `0x8C0C0A16` (ทึบ) ไม่ใช่ glassFill** · ขอบบน `0x38FFFFFF` |
| 4a | ตัวเลขใหญ่ | **56sp / semi** · tracking **-0.035em** · lineHeight **0.88** · `ink` |
| 4b | `สายวันนี้` | **15sp** · `ink` 65% · padding ซ้าย **13** ล่าง **7** · จัด baseline ล่าง |
| 4c | เวลาอัปเดต | **12.5sp** · `ink40` · ชิดขวา · paddingBottom **9** |
| 4d | แถบสัดส่วน | สูง **7** · radius **4** · marginTop **18** · พื้น `0x1FFFFFFF` · ซ้าย gradient 90° `#2FB86E→#3DDC84` (weight = ได้คุย) · ขวา `#D9453C→#FF6A5E` (weight = ไม่รับ) |
| 4e | legend | paddingTop **13** · ช่องไฟระหว่างสองอัน **18** · จุด **7** วงกลม · ข้อความ **13.5sp** `ink` 75% · ช่องไฟจุด↔ข้อความ **6** |
| 4f | เส้นคั่น | สูง 1 · `0x1AFFFFFF` · margin บนล่าง **17** |
| 4g | 3 คอลัมน์ | weight เท่ากัน · ค่า **20sp / medium** · label **12sp** `ink40` paddingTop **3** · สีค่า: เวลาคุยรวม `ink` · ขายได้ `green` · เฉลี่ย `ink` |
| 5 | หัว "นัดหมายวันนี้" | **19sp / semi** tracking -0.01em · padding `22` บน `20` ซ้ายขวา `9` ล่าง · ขวา `ทั้งหมด` **15sp** `green` |
| 6 | แผงนัดหมาย | กระจก radius **22** margin 16 · แต่ละแถว padding **13×16** · คั่น `glassDivider(16)` |
| 6a | เวลา | กว้างคงที่ **48** · **16sp / semi** · นัดถัดไป `#FFB340` · อื่น ๆ `ink60` |
| 6b | ชื่อ/โน้ต | paddingLeft **10** · ชื่อ **16sp** `ink` · โน้ต **13sp** `ink60` paddingTop 2 |
| 6c | ปุ่มโทร | **36×36** วงกลม · **พื้น `green` ทึบ** · ไอคอน **17** `onGreen` · เงาเขียว |
| 7 | ตัวเว้น | weight 1 |

---

## 04 · ประวัติการโทร

| # | element | ค่า |
|---|---|---|
| 1 | หัวเรื่อง `ประวัติ` | **34sp / semi** tracking -0.025em · padding `20` บน `20` ซ้ายขวา |
| 2 | segmented | `Design.segmented(["ทั้งหมด","ได้คุย","ไม่รับ","ขายได้"])` · margin ซ้ายขวา **18** · marginTop **16** |
| 3 | label กลุ่ม | **12.5sp / medium** `ink45` · padding `20` บน `22` ซ้ายขวา `7` ล่าง · เช่น `วันนี้ · 12 สาย` |
| 4 | แผงลิสต์ | กระจก radius **22** margin 18 · แถว padding **12×16** · **คั่นร่นซ้าย 67** |
| 4a | อวาตาร์ | **38×38** · **17sp / medium** · ได้คุย: พื้น `greenGlass` ตัวอักษร `greenSoft` · ไม่รับ: `redGlass` / `redSoft` · อื่น ๆ `glassFillHi` / `ink` |
| 4b | ชื่อ/meta | padding ซ้าย **13** ขวา **10** · ชื่อ **16sp** `ink` · meta **12.5sp** paddingTop 2 · สี meta: ไม่รับ = `redSoft` อื่น ๆ = `ink60` |
| 4c | เวลา | **13.5sp** `ink40` · paddingRight **11** |
| 4d | ปุ่มโทร | **34×34** วงกลม · พื้น `greenGlass` **(กระจก ไม่ใช่ทึบ)** · ไอคอน **16** `greenSoft` |

---

## 05 · ทีม (หัวหน้าเท่านั้น)

| # | element | ค่า |
|---|---|---|
| 1 | หัวเรื่อง | `ทีมของฉัน` **34sp / semi** tracking -0.025em · padding 20 |
| 2 | บรรทัดรอง | `อัปเดตอัตโนมัติทุก 15 วินาที` **14sp** `ink` 50% · paddingTop 4 |
| 3 | การ์ดสถิติ 3 ใบ | ช่องไฟ **10** · margin ซ้ายขวา **18** · marginTop **20** · กระจก radius **20** padding **14** |
| 3a | ตัวเลข | **28sp / semi** lineHeight 1 · กำลังคุย `green` · ออนไลน์ `ink` · ลูกทีม `ink60` |
| 3b | label | **12.5sp** `ink60` · paddingTop **5** |
| 4 | label ลิสต์ | `รายชื่อ · โทร / คุย / ขาย` **12.5sp/medium** `ink45` · padding 20/22/7 |
| 5 | แผงลิสต์ | กระจก radius **22** margin 18 · แถว padding **12×16** · คั่นร่นซ้าย **67** |
| 5a | อวาตาร์ | **38×38** **16sp / semi** · gradient 150°: น=`#3DDC84→#1F8A52` ตัวอักษร `onGreen` · ธ=`#5FA0E8→#2C5288` · ก=`#A177D6→#5E3F91` · ส=`#D6A05C→#8A5F26` · ออฟไลน์=`glassFillHi` ตัวอักษร `ink` |
| 5b | ชื่อ/สถิติ | padding ซ้าย 13 ขวา 10 · ชื่อ **16sp** `ink` · สถิติ **12.5sp** `ink60` รูปแบบ `38 / 25 / 4` |
| 5c | ป้ายสถานะ | **กำลังคุย**: พื้น `greenGlass` radius **10** padding `6×10` · จุด **6** เรืองแสง + เวลา **13sp/medium** `greenSoft` · **กำลังโทร**: พื้น `amberGlass` ตัวอักษร `amberSoft` · **ออนไลน์/ออฟไลน์**: ไม่มีพื้น ตัวอักษร **13.5sp** `ink45` |
| 5d | แถวออฟไลน์ | ทั้งแถว `alpha = 0.5` |

---

## 06 · ฉัน / ตั้งค่า

| # | element | ค่า |
|---|---|---|
| 1 | หัวเรื่อง `ฉัน` | **34sp / semi** tracking -0.025em · padding 20 |
| 2 | การ์ดโปรไฟล์ | กระจก radius **22** · margin 18 marginTop **18** · padding **16** · HORIZONTAL CENTER_VERTICAL |
| 2a | อวาตาร์ | **56×56** วงกลม · gradient 160° `#4BEF97→#219A5C` · **22sp / semi** `onGreen` |
| 2b | ชื่อ | paddingLeft **14** · **20sp / semi** `ink` · ตำแหน่ง **14sp** `ink60` paddingTop 2 |
| 3 | label กลุ่ม | **12.5sp / medium** `ink45` · padding `20` บน `22` ซ้ายขวา `7` ล่าง |
| 4 | แผง `เครื่องนี้` | กระจก radius **22** margin 18 · แถว padding **13×16** · คั่น `glassDivider(16)` · key **16sp** `ink` · value **15sp** `ink60` (ค่า "ตั้งแล้ว" ใช้ `green`) |
| 5 | สวิตช์ | **51×31** radius **16** · เปิด: พื้น `green` ปุ่มชิดขวา · ปิด: พื้น `0x52787880` ปุ่มชิดซ้าย · ปุ่มขาว **27** วงกลม เงา `0 2 5 rgba(0,0,0,0.28)` · แถวนี้ padding บนล่างเหลือ **11** |
| 6 | โหมดสี | `Design.segmented(["มืด","สว่าง","ตามระบบ"])` |
| 7 | ปุ่มออกจากระบบ | margin 18 · radius **17** · padding **16** · พื้น `0x29FF453A` · **16sp / medium** `redSoft` · ขอบบน `0x24FFFFFF` |

---

## 07 · กำลังโทรออก

พื้นราก **`bgCall`** · aurora **`"call"`** · ไม่มีแถบแท็บ · padding ซ้ายขวา **24** ล่าง **30** · จัดกลางแนวนอน

| # | element | ค่า |
|---|---|---|
| 1 | ช่องว่างบน | **76** |
| 2 | `กำลังโทรออก…` | **15sp** `ink` 62% |
| 3 | ชื่อลูกค้า | **38sp / semi** tracking **-0.025em** · `ink` · กลาง · paddingTop **10** |
| 4 | บรรทัดรอง | **15sp** `ink` 55% · paddingTop **8** · เช่น `#10482 · เกรด A · ถังทอง` |
| 5 | อวาตาร์ | **112×112** วงกลม · พื้น `0x21FFFFFF` · ขอบบน `0x66FFFFFF` **หนา 2** · **44sp / medium** `ink` · marginTop **44** · elevation 16 |
| 6 | ข้อความซ่อนเบอร์ | **14sp** `ink` 35% · กลาง · paddingTop **34** · 2 บรรทัด lineHeight 1.6 |
| 7 | ตัวเว้น | weight 1 |
| 8 | แถวปุ่ม | ช่องไฟ **56** · ปิดไมค์ = `callCircle(72, glassy=true)` · วางสาย = `callCircle(72, fill=red, glassy=false)` · ป้ายใต้ปุ่ม **13sp** `ink` 70% ช่องไฟ **11** |

---

## 08 · กำลังสนทนา

พื้นราก **`bgCall`** · aurora **`"call"`**

| # | element | ค่า |
|---|---|---|
| 1 | บล็อกหัว | กลาง · padding `36` บน `24` ซ้ายขวา |
| 1a | `กำลังสนทนา` | **14.5sp / medium** `greenSoft` |
| 1b | ชื่อ | **34sp / semi** tracking -0.025em · paddingTop **8** |
| 1c | นาฬิกา | **46sp / light(300)** tracking **-0.02em** · `ink85` · paddingTop **8** · lineHeight 1.1 · **ต้องเปิด tnum** |
| 1d | บรรทัดรอง | **13.5sp** `ink` 55% · paddingTop 6 |
| 2 | แถวปุ่ม 3 ปุ่ม | กลาง · ช่องไฟ **20** · paddingTop **28** · ทั้งหมด **66** · ปิดไมค์+โน้ต = glassy · วางสาย = `red` ทึบ · ป้าย **12.5sp** `ink` 68% ช่องไฟ **9** |
| 3 | ตัวเว้น | weight 1 · อย่างน้อย **22** |
| 4 | **แผงข้อมูลล่าง** | ติดขอบจอซ้ายขวา · radius **30 เฉพาะมุมบน** · พื้น `0x17FFFFFF` · ขอบบน `0x4DFFFFFF` · padding `10` บน `18` ล่าง · เงาขึ้นบน `0 -12 40 rgba(0,0,0,0.4)` |
| 4a | handle | **38×5** radius 3 · `0x4DFFFFFF` · กลาง · paddingBottom **13** |
| 4b | แท็บ | ราง margin 16 · พื้น **`glassSunken`** radius **12** padding **3** · ปุ่มใน radius **9** padding 7 · **13sp** |
| 4c | ตาราง | margin `14` บน `16` ซ้ายขวา · พื้น **`0x47000000`** radius **18** · แถว padding **12×16** · key **15sp** `ink60` · value **15sp / medium** |
| 4d | โน้ต | label **12.5sp/medium** `ink45` padding `15/20/7` · กล่อง margin 16 · พื้น `0x47000000` radius **18** padding **14×16** · **15sp** `ink85` lineHeight 1.6 |

---

## 09 · สายเข้า

พื้นราก **`bgIncoming`** · aurora **`"incoming"`** · แสดงเหนือหน้าล็อก · padding ซ้ายขวา **20** ล่าง **28**

| # | element | ค่า |
|---|---|---|
| 1 | ช่องว่างบน | **70** |
| 2 | `สายเข้า` | **15sp / medium** **`amberSoft`** |
| 3 | ชื่อ | **40sp / semi** tracking -0.025em · paddingTop **10** · กลาง |
| 4 | บรรทัดรอง | **15sp** `ink` 70% · paddingTop 8 |
| 5 | อวาตาร์ | **112×112** · พื้น `0x24FFFFFF` · ขอบบน `0x6BFFFFFF` หนา 2 · **44sp** · marginTop **32** |
| 6 | กล่องบริบท | เต็มความกว้าง · กระจก radius **22** padding `16×18` · marginTop **30** · หัว **13.5sp/medium** `amberSoft` · เนื้อ **15sp** `ink` 90% paddingTop 7 lineHeight 1.6 |
| 7 | ตัวเว้น | weight 1 · อย่างน้อย 20 |
| 8 | แถวปุ่ม | `SPACE_BETWEEN` เต็มความกว้าง padding ซ้ายขวา **4** · **ปฏิเสธ 74 `red` ทึบ (ซ้าย)** · **ปิดเสียง 68 กระจก (กลาง, marginTop 3)** · **รับสาย 74 `green` ทึบ (ขวา)** · ป้าย **13sp** `ink` 75% ช่องไฟ **11** |

> ปุ่มรับสายอยู่ **ขวา** ปฏิเสธอยู่ **ซ้าย** — ห้ามสลับ

---

## 10 · บันทึกการโทร (bottom sheet)

BottomSheetDialog · **เว้นจากขอบบน 52** · พื้น **`sheetFill`** · radius **30 เฉพาะมุมบน** · scrim `Design.scrim`

| # | element | ค่า |
|---|---|---|
| 1 | handle | **38×5** radius 3 `0x47FFFFFF` · กลาง · paddingTop **10** |
| 2 | แถบหัว | padding `13` บน `20` ซ้ายขวา `14` ล่าง · ซ้าย `ทีหลัง` **16sp** `ink60` · กลาง `บันทึกการโทร` **17sp/semi** `ink` · ขวา เวลาคุย **16sp/medium** `green` |
| 3 | การ์ดลูกค้า | padding ซ้ายขวา **18** · พื้น `0x17FFFFFF` radius **20** padding `14×16` · อวาตาร์ **44** พื้น `greenGlass` **19sp** `greenSoft` · ชื่อ **18sp/semi** paddingLeft 13 · meta **13sp** `ink60` |
| 4 | คำใบ้ | **12.5sp** `ink` 42% · padding `9` บน `4` ซ้ายขวา · lineHeight 1.5 |
| 5 | label `ผลการโทร` | **12.5sp/medium** `ink45` · padding `14/4/6` |
| 6 | แผงตัวเลือก | พื้น `0x12FFFFFF` radius **20** · แถว padding **13×16** · คั่น `0x17FFFFFF` |
| 6a | ตัวที่เลือก | พื้นแถว `0x2E3DDC84` (เขียว 18%) · ข้อความ **16.5sp / medium** · ขวาสุดเครื่องหมายถูก **19** `green` |
| 6b | ตัวที่ไม่เลือก | **16.5sp / regular** `ink85` · ไม่มีไอคอน |
| 7 | label `Tag ลูกค้า` | เหมือนข้อ 5 |
| 8 | ชิป Tag | ช่องไฟ **8** · radius **12** padding `8×13` · จุด **7** · ข้อความ **14sp** · เปิด: พื้น `greenGlass`/`amberGlass` ตัวอักษร `greenSoft`/`amberSoft` · ปิด: พื้น `glassFill` จุด `0x59FFFFFF` ตัวอักษร `ink60` |
| 9 | ปุ่มบันทึก | padding `14` บน `18` ซ้ายขวา `20` ล่าง · radius **17** padding **17** · **17sp/semi** · เลือกผลแล้ว: พื้น `green` ตัวอักษร `onGreen` · **ยังไม่เลือก: พื้น `0x24FFFFFF` ตัวอักษร `ink45` ข้อความ `เลือกผลการโทรก่อน` กดไม่ได้** |

---

## 11 · ยืนยันก่อนโทร

Dialog ลอยล่าง · `left/right = 10` `bottom = 12` · **ไม่มี handle ไม่มีวงแหวนเต้น**

| # | element | ค่า |
|---|---|---|
| 1 | กล่องบน | พื้น `0xD11C192A` radius **20** · ขอบบน `0x4DFFFFFF` · elevation 16 |
| 1a | อวาตาร์ | **74×74** วงกลม พื้น `greenGlass` **29sp/medium** `greenSoft` · กลาง · paddingTop **22** |
| 1b | หัวเรื่อง | `โทรหา <ชื่อ>` **20sp / semi** `ink` · กลาง · paddingTop **14** |
| 1c | คำอธิบาย | **14sp** `ink60` · กลาง · paddingTop 6 · lineHeight 1.55 · 2 บรรทัด (บรรทัดสอง: `ระบบจะสั่งเครื่องโทรออกให้ เบอร์จะไม่ปรากฏบนจอ`) |
| 1d | เส้นคั่น | สูง 1 `0x1FFFFFFF` · เต็มความกว้าง (ไม่ร่น) |
| 1e | ปุ่ม `โทรออก` | padding **17** · กลาง · **18sp / semi** `green` |
| 2 | ปุ่ม `ยกเลิก` | กล่องแยก marginTop **8** · พื้น/radius เท่ากล่องบน · padding 17 · **18sp/semi** `ink` |

---

## 12 · รายละเอียดลูกค้า

| # | element | ค่า |
|---|---|---|
| 1 | ปุ่มกลับ | padding `16` บน `20` ซ้ายขวา · ไอคอน chevron **18** + ข้อความ **16sp** ทั้งคู่สี `green` · ช่องไฟ **3** |
| 2 | อวาตาร์ | **84×84** วงกลม gradient 160° `#6FAEEE→#2C5288` · **33sp/medium** `ink` · กลาง · paddingTop **18** · elevation 12 |
| 3 | ชื่อ | **26sp / semi** tracking **-0.015em** · paddingTop **14** |
| 4 | บรรทัดรอง | **15sp** `ink60` · paddingTop 4 |
| 5 | การ์ดสถิติ 3 ใบ | ช่องไฟ **10** margin 18 marginTop **20** · กระจก radius **20** padding `14×12` กลาง · ค่า **19sp/semi** (ยอดซื้อ = `green`) · label **12sp** `ink45` paddingTop 4 |
| 6 | แผงข้อมูล | label กลุ่ม + กระจก radius 22 · แถว padding `13×16` · key **16sp** `ink` · value **15sp** `ink60` · แถวเบอร์โทร value = `ซ่อนไว้` สี `ink40` |
| 7 | โน้ตครั้งก่อน | กระจก radius **22** padding `14×16` · **15sp** `ink85` lineHeight 1.6 |
| 8 | ปุ่มล่าง | `primaryButton("โทรหาลูกค้ารายนี้")` margin 18 marginBottom **18** |

---

## 13 · นัดหมายวันนี้

| # | element | ค่า |
|---|---|---|
| 1 | ปุ่มกลับ | เหมือนหน้า 12 |
| 2 | หัวเรื่อง | **34sp/semi** tracking -0.025em · paddingTop 14 |
| 3 | บรรทัดรอง | **15sp** `ink60` paddingTop 4 |
| 4 | **การ์ดนัดถัดไป** | margin 18 marginTop **20** · radius **24** padding **18** · พื้น gradient 150° `0x3DFF9F0A → 0x12FF9F0A` · ขอบบน `0x3DFFFFFF` · elevation 12 |
| 4a | หัว | ซ้าย `นัดถัดไป` **15sp/medium** `amberSoft` · ขวา เวลา **22sp/semi** `amberSoft` |
| 4b | ชื่อ | **22sp / semi** `ink` paddingTop **10** |
| 4c | meta | **14sp** `ink60` paddingTop 3 |
| 4d | โน้ตนัด | **15sp** `ink85` paddingTop **12** lineHeight 1.6 |
| 4e | ปุ่ม | paddingTop **16** ช่องไฟ **9** · `โทรเลย` weight 1 พื้น `green` radius **14** padding 13 **16sp/semi** · `เลื่อน` พื้น `0x24FFFFFF` radius 14 padding `13×20` **16sp** `ink` |
| 5 | ลิสต์ต่อไป | label `ต่อไป` + กระจก radius 22 · แถว padding `13×16` · เวลากว้าง **46** **16sp/medium** `ink60` · ชื่อ **16sp** paddingLeft 12 · เหตุผล **13sp** `ink60` · **คั่นร่นซ้าย 74** |

---

## 14 · ค้นหา · สรุปสิ้นวัน

**ค้นหา** — หัวเรื่อง `ค้นหา` 34sp/semi · ช่องค้นหา: กระจก radius **13** padding `10×12` ไอคอน **17** `ink` 55% ข้อความ **17sp** · ขวา `ยกเลิก` **16sp** `green` ช่องไฟ **12** · คำใบ้กติกา **13sp** `ink40` paddingTop 10 · ลิสต์ผลเหมือนหน้าประวัติแต่ไม่มีปุ่มโทร · แถว `ห้ามติดต่อ`: alpha **0.55** อวาตาร์ `0x4DFF453A` meta `redSoft`

**สรุปสิ้นวัน** — วันที่ **13sp** `ink45` · หัวเรื่อง 2 บรรทัด **32sp/semi** tracking -0.025em paddingTop 10 lineHeight 1.25 · การ์ดฮีโร่: margin 18 marginTop **22** radius **26** padding **20** พื้น gradient 150° `0x423DDC84 → 0x0FFFFFFF` ขอบบน `0x47FFFFFF` · ตัวเลข **56sp/semi** tracking -0.035em · ป้ายเทียบเมื่อวาน พื้น `0x3D3DDC84` radius 999 padding `6×12` **12.5sp/semi** `greenSoft` · 3 คอลัมน์ **19sp/medium** label **12sp** `ink` 50% · แถวแท่ง: label **15sp** `ink85` · ราง **88×6** radius 3 พื้น `0x21FFFFFF` marginEnd **14** · ค่า **16sp/medium** กว้าง **32** ชิดขวา

---

## ห้ามลืม

1. **เบอร์ลูกค้าห้ามโผล่ทุกหน้า** — ช่องที่ควรมีเบอร์ให้เขียน `ซ่อนไว้` เท่านั้น
2. **ห้ามมีแป้นกด ห้ามมีสมุดรายชื่อ ห้ามมีปุ่มโอนสาย/เพิ่มสาย**
3. ตัวเลือกสถานะ/ผลการโทร ใช้ชุดเดิมใน `DispositionActivity` ทุกตัว **ห้ามแก้คำ**
4. Tag ที่ลูกค้ามีอยู่แล้ว ถอดไม่ได้ (ระบบเพิ่มอย่างเดียว)
5. ข้อความไทยทุกคำอยู่ใน `strings.xml` ห้าม hardcode
6. ปุ่มกดทุกปุ่มสูงอย่างน้อย **48**
7. ทุกหน้าต้องมี `Design.aurora()` เป็นลูกคนแรก **ไม่มี = ดีไซน์พังทั้งใบ**
