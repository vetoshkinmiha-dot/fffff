import { prisma } from "./prisma";

export type NotificationType =
  | "approval_requested"
  | "approval_result"
  | "document_added"
  | "document_expiring"
  | "document_expired"
  | "permit_expiring"
  | "permit_closed"
  | "complaint_submitted"
  | "violation_created"
  | "checklist_assigned";

interface CreateNotification {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

export async function createNotification(data: CreateNotification) {
  return prisma.notification.create({ data });
}

export async function createNotificationsForRole(
  role: string,
  options: {
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    organizationId?: string;
    department?: string;
  }
) {
  const where: Record<string, unknown> = { isActive: true, role };
  if (options.organizationId) where.organizationId = options.organizationId;
  if (options.department) where.department = options.department;

  const users = await prisma.user.findMany({ where, select: { id: true } });
  if (users.length === 0) return 0;

  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type: options.type,
      title: options.title,
      message: options.message,
      link: options.link,
    })),
  });
  return users.length;
}

/**
 * Send notification to all contractor employees and admins of an organization
 */
export async function notifyOrganizationContractors(
  organizationId: string,
  options: {
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
  }
) {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      organizationId,
      role: { in: ["contractor_employee", "contractor_admin"] },
    },
    select: { id: true },
  });

  if (users.length === 0) return 0;

  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type: options.type,
      title: options.title,
      message: options.message,
      link: options.link,
    })),
  });
  return users.length;
}
