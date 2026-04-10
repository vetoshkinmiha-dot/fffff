import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASSWORD
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        }
      : undefined,
});

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
) {
  if (process.env.NODE_ENV === "development" && !process.env.SMTP_HOST) {
    console.log(`[EMAIL MOCK] To: ${to} | Subject: ${subject} | Body: ${html}`);
    return;
  }

  await transporter.sendMail({
    from: `"Contractor Management System" <${process.env.SMTP_FROM || "noreply@company.ru"}>`,
    to,
    subject,
    html,
  });
}

export async function sendApprovalNotification(
  to: string,
  approverName: string,
  employeeName: string,
  orgName: string,
  departments: string,
  deadline: string,
) {
  const deadlineStr = new Date(deadline).toLocaleDateString("ru-RU");

  await sendEmail(
    to,
    `Новый запрос на согласование — ${employeeName}`,
    `
      <p>Здравствуйте, ${approverName}!</p>
      <p>Сотрудник <strong>${employeeName}</strong> (${orgName}) отправлен на согласование.</p>
      <p>Департаменты: ${departments}</p>
      <p>Срок: <strong>${deadlineStr}</strong></p>
      <p><a href="${process.env.APP_URL || "http://localhost:3000"}/approvals">Перейти к согласованию</a></p>
    `,
  );
}

export async function sendDocumentExpiryAlert(
  to: string,
  employeeName: string,
  documentName: string,
  expiryDate: string,
) {
  const expiryStr = new Date(expiryDate).toLocaleDateString("ru-RU");

  await sendEmail(
    to,
    `Истекает срок документа — ${employeeName}`,
    `
      <p>Документ <strong>${documentName}</strong> сотрудника ${employeeName} истекает ${expiryStr}.</p>
      <p>Пожалуйста, обновите документ.</p>
    `,
  );
}

export async function sendApprovalResult(
  to: string,
  employeeName: string,
  orgName: string,
  departmentName: string,
  status: "approved" | "rejected",
  comment: string | null,
  employeeId: string,
) {
  const statusLabel = status === "approved" ? "Одобрено" : "Отклонено";
  const statusIcon = status === "approved" ? "✅" : "❌";
  const commentBlock = comment ? `<p>Комментарий: <strong>${comment}</strong></p>` : "";

  await sendEmail(
    to,
    `Решение по согласованию: ${employeeName}`,
    `
      <h2>${statusIcon} ${statusLabel}</h2>
      <p>Сотрудник: <strong>${employeeName}</strong> (${orgName})</p>
      <p>Департамент: ${departmentName}</p>
      <p>Статус: <strong>${status === "approved" ? "Согласовано" : "Отклонено"}</strong></p>
      ${commentBlock}
      <p><a href="${process.env.APP_URL || "http://localhost:3000"}/employees/${employeeId}">Карточка сотрудника</a></p>
    `,
  );
}

export async function sendRegDocUpdated(
  users: Array<{ email: string; fullName: string }>,
  docName: string,
  docUrl: string,
) {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const recipients = users.map((u) => `${u.fullName} <${u.email}>`).join(", ");

  await sendEmail(
    recipients,
    `Новый нормативный документ: ${docName}`,
    `
      <p>Добавлен новый нормативный документ: <strong>${docName}</strong></p>
      <p><a href="${appUrl}${docUrl}">Открыть документ</a></p>
    `,
  );
}
