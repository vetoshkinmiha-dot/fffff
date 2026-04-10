import { z } from "zod";

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

// ─── Auth ──────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/, "Must contain uppercase letter").regex(/[0-9]/, "Must contain a number"),
  fullName: z.string().min(2).transform(stripHtmlTags),
  role: z.enum([
    "admin", "factory_hse", "factory_hr", "factory_curator",
    "contractor_admin", "contractor_user", "security", "permit_bureau",
  ]),
  organizationId: z.string().uuid().nullable().optional(),
  department: z.enum(["security", "hr", "safety", "safety_training", "permit_bureau"]).nullable().optional(),
});

// ─── Organization ──────────────────────────────────────────────
export const createOrgSchema = z.object({
  name: z.string().min(1).transform(stripHtmlTags),
  inn: z.string().length(10).or(z.string().length(12)),
  kpp: z.string().length(9).optional().or(z.string().length(0)),
  legalAddress: z.string().min(1).transform(stripHtmlTags),
  contactPersonName: z.string().optional().transform((v) => v ? stripHtmlTags(v) : v),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.string().length(0)),
});

export const updateOrgSchema = createOrgSchema.partial();

export const orgStatusSchema = z.object({
  status: z.enum(["pending", "active", "blocked"]),
});

// ─── Employee ──────────────────────────────────────────────────
export const createEmployeeSchema = z.object({
  fullName: z.string().min(2).transform(stripHtmlTags),
  position: z.string().min(1).transform(stripHtmlTags),
  passportSeries: z.string().regex(/^\d{4}$/, "Series must be 4 digits"),
  passportNumber: z.string().regex(/^\d{6}$/, "Number must be 6 digits"),
  passportIssuedBy: z.string().optional().transform((v) => v ? stripHtmlTags(v) : v),
  passportIssueDate: z.string().datetime().optional(),
  workClasses: z.array(z.string()).default([]),
  previouslyAtPirelli: z.boolean().default(false),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

// ─── Approval ──────────────────────────────────────────────────
export const createApprovalSchema = z.object({
  departments: z.array(z.enum(["security", "hr", "safety", "safety_training", "permit_bureau"])).min(1),
  deadline: z.string().datetime(),
});

export const decideApprovalSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  comment: z.string().optional(),
});

// ─── Pagination / Query ────────────────────────────────────────
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.string().optional(),
});

// ─── Permit ────────────────────────────────────────────────────
export const createPermitSchema = z.object({
  category: z.enum(["hot_work", "height_work", "confined_space", "electrical", "excavation", "other"]),
  contractorId: z.string().uuid(),
  workSite: z.string().min(1).transform(stripHtmlTags),
  responsiblePerson: z.string().min(1).transform(stripHtmlTags),
  openDate: z.string().datetime(),
  expiryDate: z.string().datetime(),
});

export const updatePermitSchema = createPermitSchema.partial();

export const closePermitSchema = z.object({
  closeReason: z.string().min(1).transform(stripHtmlTags),
});

// ─── Violation ───────────────────────────────────────────────────
export const createViolationSchema = z.object({
  contractorId: z.string().uuid(),
  date: z.string().datetime(),
  description: z.string().min(1).transform(stripHtmlTags),
  severity: z.enum(["low", "medium", "high", "critical"]),
  department: z.string().min(1),
  photoUrl: z.string().optional(),
});

export const updateViolationSchema = createViolationSchema.partial();

export const resolveViolationSchema = z.object({
  resolutionNotes: z.string().min(1).transform(stripHtmlTags),
});

export const createViolationTemplateSchema = z.object({
  title: z.string().min(1).transform(stripHtmlTags),
  description: z.string().min(1).transform(stripHtmlTags),
  defaultSeverity: z.enum(["low", "medium", "high", "critical"]),
  department: z.string().min(1),
});

// ─── Checklist ───────────────────────────────────────────────────
export const createChecklistSchema = z.object({
  contractorId: z.string().uuid(),
  inspectorName: z.string().min(1).transform(stripHtmlTags),
  date: z.string().datetime(),
  comments: z.string().optional(),
  items: z.array(z.object({
    question: z.string().min(1),
    answer: z.enum(["pass", "fail", "n/a"]),
    comment: z.string().optional(),
    photoUrl: z.string().optional(),
  })).default([]),
});

export const updateChecklistSchema = createChecklistSchema.partial();
