# ระบบห้องให้คำปรึกษา (Counseling Booking System)

เว็บแอปสำหรับจองคิวเข้ารับคำปรึกษา ประกอบด้วย:

- **หน้าเว็บสำหรับผู้ใช้บริการ** — ปฏิทินแสดงวันว่าง/ไม่ว่าง รายชื่อผู้ให้คำปรึกษาในแต่ละวัน และฟอร์มจองคิว
- **ระบบแอดมิน** — จัดการผู้ให้คำปรึกษา, สร้าง/ลบคิวว่าง (รองรับสร้างซ้ำหลายวัน), จัดการวันหยุด, ดู/อนุมัติ/ยกเลิกการจอง
- **แจ้งเตือนเข้า LINE กลุ่ม** — เมื่อมีคนจองคิวใหม่ ระบบจะส่งการ์ด Flex Message ไปยังกลุ่ม LINE ที่ตั้งค่าไว้ทันที และสมาชิกในกลุ่มพิมพ์ "ตารางวันนี้"/"ตารางพรุ่งนี้" เพื่อให้บอทตอบกลับตารางคิวแบบการ์ดปฏิทินได้

สร้างด้วย Next.js 16 (App Router) + Prisma 7 + PostgreSQL + Tailwind CSS

> หมายเหตุ: LINE Notify ปิดให้บริการไปแล้วตั้งแต่ มี.ค. 2025 ระบบนี้จึงใช้ **LINE Messaging API** ผ่าน LINE Official Account แทน

## เริ่มต้นใช้งาน (Development)

### 1. ติดตั้ง dependencies

```bash
npm install
```

### 2. ตั้งค่าฐานข้อมูล PostgreSQL

แก้ไข `DATABASE_URL` ในไฟล์ `.env` ให้ชี้ไปยังฐานข้อมูล PostgreSQL ของคุณ จากนั้นรัน migration:

```bash
npx prisma migrate dev
```

### 3. สร้างบัญชีแอดมินเริ่มต้น + ข้อมูลตัวอย่าง

```bash
npm run db:seed
```

ค่าเริ่มต้น: username `admin` / password `changeme123` (กำหนดผ่าน `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` ได้) — **กรุณาเปลี่ยนรหัสผ่านหลังเข้าสู่ระบบครั้งแรก**

### 4. รันเซิร์ฟเวอร์

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000) สำหรับหน้าเว็บผู้ใช้บริการ และ [http://localhost:3000/admin/login](http://localhost:3000/admin/login) สำหรับหน้าแอดมิน

## Environment Variables

ดูตัวอย่างทั้งหมดใน `.env`:

| ตัวแปร | คำอธิบาย |
| --- | --- |
| `DATABASE_URL` | connection string ของ PostgreSQL |
| `SESSION_SECRET` | ค่าลับสำหรับเซ็นชื่อ session cookie ของแอดมิน (ควรสุ่มค่าใหม่ในโปรดักชัน) |
| `LINE_CHANNEL_ACCESS_TOKEN` | Channel access token ของ LINE Official Account |
| `LINE_CHANNEL_SECRET` | Channel secret สำหรับตรวจสอบลายเซ็น webhook |
| `LINE_GROUP_ID` | Group ID ของกลุ่ม LINE ที่ต้องการรับการแจ้งเตือน |
| `APP_BASE_URL` | URL สาธารณะของเว็บแอป ใช้สร้างลิงก์ในข้อความ LINE |

## ตั้งค่าการแจ้งเตือน LINE กลุ่ม

1. สร้าง LINE Official Account และเปิดใช้งาน Messaging API ที่ [LINE Developers Console](https://developers.line.biz/console/)
2. คัดลอก **Channel access token** (long-lived) และ **Channel secret** ใส่ในไฟล์ `.env`
3. เชิญบัญชี Official Account เข้ากลุ่ม LINE ที่ต้องการรับแจ้งเตือน
4. ตั้งค่า Webhook URL เป็น `https://<your-domain>/api/line/webhook` แล้วเปิดใช้งาน "Use webhook"
5. พิมพ์ข้อความใดๆ ในกลุ่มหนึ่งครั้ง แล้วดู log ของเซิร์ฟเวอร์เพื่อหา `groupId` (หรือ log ค่า `event.source.groupId` ชั่วคราวใน `src/app/api/line/webhook/route.ts`) แล้วนำไปใส่ใน `LINE_GROUP_ID`
6. รีสตาร์ทเซิร์ฟเวอร์ แล้วไปที่หน้า **แอดมิน > ตั้งค่า** เพื่อกดส่งข้อความทดสอบ

เมื่อมีการจองใหม่เกิดขึ้น ระบบจะส่ง Flex Message รูปการ์ดปฏิทินไปยังกลุ่มโดยอัตโนมัติ และสมาชิกกลุ่มสามารถพิมพ์ "ตารางวันนี้" หรือ "ตารางพรุ่งนี้" เพื่อให้บอทตอบกลับตารางคิวของวันนั้นแบบการ์ดได้ทันที

## โครงสร้างระบบหลัก

- `src/app/page.tsx` + `src/components/BookingCalendar.tsx` — หน้าปฏิทิน/จองคิวสำหรับผู้ใช้บริการ
- `src/app/admin/**` — หน้าแอดมิน (ป้องกันด้วย `src/proxy.ts` + session cookie)
- `src/app/api/**` — REST API สำหรับทั้งฝั่งผู้ใช้และแอดมิน
- `src/lib/line.ts` — ฟังก์ชันส่ง/รับข้อความ LINE Messaging API และสร้าง Flex Message
- `prisma/schema.prisma` — โมเดลข้อมูล (Counselor, Slot, Booking, ClosedDate, Admin)

## Deploy

แอปนี้เป็น Next.js server ธรรมดา (ไม่ใช่ static export) ต้องรันบน Node.js server หรือแพลตฟอร์มที่รองรับ (Vercel, Railway, Docker เป็นต้น) และต้องมี PostgreSQL ที่เข้าถึงได้จากเซิร์ฟเวอร์ที่รันแอป
