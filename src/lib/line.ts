import crypto from "crypto";
import { thaiDateLabel } from "@/lib/dates";

const LINE_API_BASE = "https://api.line.me/v2/bot";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LineMessage = Record<string, any>;

function channelAccessToken() {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN;
}

export function isLineConfigured() {
  return Boolean(
    process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_GROUP_ID
  );
}

export function verifyLineSignature(rawBody: string, signature: string | null) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const hash = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  return hash === signature;
}

async function callLineApi(path: string, body: unknown) {
  const token = channelAccessToken();
  if (!token) {
    console.warn("LINE_CHANNEL_ACCESS_TOKEN not set; skipping LINE API call");
    return { ok: false, skipped: true };
  }
  const res = await fetch(`${LINE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`LINE API error ${res.status}: ${text}`);
    return { ok: false, status: res.status, body: text };
  }
  return { ok: true };
}

export async function pushMessageToGroup(messages: LineMessage[]) {
  const to = process.env.LINE_GROUP_ID;
  if (!to) {
    console.warn("LINE_GROUP_ID not set; skipping LINE push");
    return { ok: false, skipped: true };
  }
  return callLineApi("/message/push", { to, messages });
}

export async function replyMessage(replyToken: string, messages: LineMessage[]) {
  return callLineApi("/message/reply", { replyToken, messages });
}

/** Build a text message that @-mentions a counselor's LINE account, e.g. for new booking alerts. */
export function buildCounselorMentionMessage(counselorName: string, lineUserId: string) {
  const mentionText = `@${counselorName}`;
  const text = `${mentionText} มีการจองคิวใหม่เข้ามา กรุณาตรวจสอบและกดยืนยัน 🔔`;
  return {
    type: "text",
    text,
    mention: {
      mentionees: [
        {
          index: 0,
          length: mentionText.length,
          type: "user",
          userId: lineUserId,
        },
      ],
    },
  };
}

export function buildBookingFlexMessage(params: {
  bookingId: string;
  counselorName: string;
  clientName: string;
  studentId?: string | null;
  faculty: string;
  major: string;
  clientPhone: string;
  lineId: string;
  consultationFormat: string;
  topic?: string | null;
  dateKey: string;
  startTime: string;
  endTime: string;
}) {
  const day = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
  }).format(new Date(`${params.dateKey}T00:00:00+07:00`));
  const monthShort = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    month: "short",
  }).format(new Date(`${params.dateKey}T00:00:00+07:00`));

  const baseUrl = process.env.APP_BASE_URL;
  const hasValidBaseUrl = Boolean(baseUrl && /^https?:\/\//.test(baseUrl));

  return {
    type: "flex",
    altText: `มีการจองใหม่: ${params.clientName} วันที่ ${thaiDateLabel(params.dateKey)} เวลา ${params.startTime}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "horizontal",
        backgroundColor: "#2563eb",
        paddingAll: "16px",
        contents: [
          {
            type: "box",
            layout: "vertical",
            width: "72px",
            backgroundColor: "#ffffff",
            cornerRadius: "8px",
            paddingAll: "8px",
            contents: [
              {
                type: "text",
                text: monthShort,
                align: "center",
                size: "xs",
                color: "#2563eb",
                weight: "bold",
              },
              {
                type: "text",
                text: day,
                align: "center",
                size: "xxl",
                color: "#111827",
                weight: "bold",
              },
            ],
          },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            justifyContent: "center",
            contents: [
              {
                type: "text",
                text: "มีการจองคิวปรึกษาใหม่",
                color: "#ffffff",
                weight: "bold",
                size: "md",
                wrap: true,
              },
              {
                type: "text",
                text: `${params.startTime} - ${params.endTime} น.`,
                color: "#dbeafe",
                size: "sm",
              },
            ],
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          lineField("ผู้ให้คำปรึกษา", params.counselorName),
          lineField("ผู้ขอรับคำปรึกษา", params.clientName),
          ...(params.studentId ? [lineField("เลขระเบียน", params.studentId)] : []),
          lineField("คณะ/สาขา", `${params.faculty} - ${params.major}`),
          lineField("รูปแบบ", params.consultationFormat),
          lineField("เบอร์ติดต่อ", params.clientPhone),
          lineField("LINE ID", params.lineId),
          ...(params.topic ? [lineField("หัวข้อ", params.topic)] : []),
          lineField("สถานะ", "รอการยืนยัน"),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#16a34a",
                action: {
                  type: "postback",
                  label: "ยืนยัน",
                  data: `action=confirm&bookingId=${params.bookingId}`,
                  displayText: "✅ ยืนยันการจองนี้",
                },
              },
              {
                type: "button",
                style: "primary",
                color: "#dc2626",
                action: {
                  type: "postback",
                  label: "ยกเลิก",
                  data: `action=cancel&bookingId=${params.bookingId}`,
                  displayText: "❌ ยกเลิกการจองนี้",
                },
              },
            ],
          },
          ...(hasValidBaseUrl
            ? [
                {
                  type: "button",
                  style: "secondary",
                  action: {
                    type: "uri",
                    label: "เปิดระบบจัดการการจอง",
                    uri: `${baseUrl}/admin/bookings`,
                  },
                },
              ]
            : []),
        ],
      },
    },
  };
}

function lineField(label: string, value: string) {
  return {
    type: "box",
    layout: "baseline",
    spacing: "sm",
    contents: [
      { type: "text", text: label, color: "#6b7280", size: "sm", flex: 3 },
      { type: "text", text: value, color: "#111827", size: "sm", flex: 5, wrap: true },
    ],
  };
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "รอการยืนยัน",
  CONFIRMED: "ยืนยันแล้ว ✅",
  CANCELLED: "ยกเลิกแล้ว ❌",
  COMPLETED: "เสร็จสิ้น",
};

export function buildStatusUpdateMessage(params: {
  clientName: string;
  counselorName: string;
  dateKey: string;
  startTime: string;
  endTime: string;
  status: string;
}) {
  const statusLabel = STATUS_LABELS[params.status] || params.status;
  return {
    type: "text",
    text: [
      "📌 อัปเดตสถานะการจอง",
      `ผู้จอง: ${params.clientName}`,
      `ผู้ให้คำปรึกษา: ${params.counselorName}`,
      `วันที่: ${thaiDateLabel(params.dateKey)}`,
      `เวลา: ${params.startTime}-${params.endTime} น.`,
      `สถานะใหม่: ${statusLabel}`,
    ].join("\n"),
  };
}

export function buildScheduleFlexMessage(params: {
  dateKey: string;
  items: {
    counselorName: string;
    counselorColor: string;
    startTime: string;
    endTime: string;
    status: "available" | "booked";
    clientName?: string;
  }[];
}) {
  const label = thaiDateLabel(params.dateKey);
  const bubbles = params.items.length
    ? params.items.map((item) => ({
        type: "box",
        layout: "horizontal",
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "vertical",
            width: "6px",
            backgroundColor: item.counselorColor,
            cornerRadius: "4px",
            contents: [{ type: "filler" }],
          },
          {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: `${item.startTime}-${item.endTime}  ${item.counselorName}`,
                size: "sm",
                weight: "bold",
                wrap: true,
              },
              {
                type: "text",
                text:
                  item.status === "booked"
                    ? `จองแล้ว: ${item.clientName ?? "-"}`
                    : "ว่าง",
                size: "xs",
                color: item.status === "booked" ? "#dc2626" : "#16a34a",
              },
            ],
          },
        ],
      }))
    : [
        {
          type: "text",
          text: "ไม่มีคิวว่างในวันนี้",
          color: "#6b7280",
          size: "sm",
        },
      ];

  return {
    type: "flex",
    altText: `ตารางวันที่ ${label}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#2563eb",
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: "ปฏิทินห้องให้คำปรึกษา",
            color: "#ffffff",
            weight: "bold",
          },
          { type: "text", text: label, color: "#dbeafe", size: "sm" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: bubbles,
      },
    },
  };
}
