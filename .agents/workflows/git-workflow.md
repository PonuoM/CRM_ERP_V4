---
name: "git-workflow"
description: "คู่มืออธิบายข้อตกลงในการใช้งาน Git (Commit & Pull Request Guidelines)"
---

# Git & Pull Request Workflow

คู่มือนี้รวบรวมข้อตกลงและแนวปฏิบัติในการใช้งาน Git และการสร้าง Pull Request ภายในโปรเจกต์ เพื่อความเป็นระเบียบและติดตามประวัติการแก้ไขได้ง่าย

## Commit Guidelines (ข้อตกลงการเขียน Commit)

โปรเจกต์นี้ใช้รูปแบบ **Conventional Commits** ในการตั้งชื่อ Commit เพื่อให้ข้อความมีความหมายและสื่อถึงสิ่งที่แก้ไขได้อย่างชัดเจน

รูปแบบ: `ประเภท(ส่วนที่แก้ไข): สรุปการแก้ไขสั้นๆ`

### ประเภทของ Commit (Types)
- `feat:` สำหรับการเพิ่มฟีเจอร์ใหม่ (New feature)
- `fix:` สำหรับการแก้ไขบั๊ก (Bug fix)
- `docs:` สำหรับการปรับปรุงหรือเพิ่มเอกสาร (Documentation)
- `refactor:` สำหรับการจัดระเบียบโค้ดใหม่โดยไม่เปลี่ยนพฤติกรรมการทำงาน (Refactoring)
- `chore:` สำหรับงานดูแลรักษาระบบ, อัปเดต dependencies, หรือตั้งค่าต่างๆ (Maintenance/Config)
- `style:` สำหรับการแก้ไขเกี่ยวกับการจัดรูปแบบโค้ด (เช่น เว้นวรรค, ลบ unused imports)
- `test:` สำหรับการเพิ่มหรือแก้ไขโค้ดทดสอบ (Testing)

### ตัวอย่างการเขียน Commit
- `feat(pages): add ReportsPage filters` (เพิ่มตัวกรองในหน้ารายงาน)
- `fix(api): handle null customer_type in dashboard_data` (แก้บั๊กเมื่อ customer_type เป็น null)
- `chore(deps): update react to version 18` (อัปเดตไลบรารี)

## Pull Request Guidelines

เพื่อให้การตรวจโค้ด (Code Review) เป็นไปอย่างรวดเร็วและมีประสิทธิภาพ ควรปฏิบัติตามคำแนะนำดังนี้:

1. **Keep PRs focused and small:** 
   - 1 PR ควรจัดการกับ 1 งานหรือ 1 ฟีเจอร์เท่านั้น 
   - อย่ารวมการแก้ไขหลายๆ เรื่องที่ไม่เกี่ยวข้องกันไว้ใน PR เดียว
2. **Clear Summary:** 
   - เขียนคำอธิบาย PR ให้ชัดเจนว่าแก้ไขอะไร ทำไมถึงต้องแก้ และกระทบกับส่วนไหนบ้าง
3. **Link Related Issues:** 
   - แนบลิงก์ไปยัง Issue หรือ Task ที่เกี่ยวข้อง (ถ้ามี)
4. **Screenshots/GIFs:** 
   - หากมีการแก้ไข UI (หน้าจอ) ควรแนบภาพ Screenshot หรือไฟล์ GIF ก่อน-หลังการแก้ไข (Before/After) เพื่อให้ผู้ตรวจเห็นภาพได้ทันทีโดยไม่ต้องรันโค้ด
5. **Self-Review:**
   - ทบทวนโค้ดของตัวเองก่อนเปิด PR เสมอ (เช่น ตรวจสอบว่าลบ `console.log` ที่ใช้ debug ออกหรือยัง)
