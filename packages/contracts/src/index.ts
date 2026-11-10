import { z } from "zod";

export const API_PREFIX = "/api/v1";

export const errorCodes = [
  "VALIDATION",
  "NOT_FOUND",
  "CATALOG_CHANGED",
  "IDEMPOTENCY_MISMATCH",
  "IDEMPOTENCY_KEY_REQUIRED",
  "RATE_LIMITED",
  "UNAUTHORIZED",
  "MFA_REQUIRED",
  "FORBIDDEN",
  "CSRF",
  "VERSION_CONFLICT",
  "INVALID_TRANSITION",
  "CONFLICT",
  "PAYLOAD_TOO_LARGE",
  "INTERNAL",
] as const;
export type ErrorCode = (typeof errorCodes)[number];

export type ApiError = {
  code: ErrorCode;
  message: string;
  fieldErrors?: Record<string, string>;
  requestId: string;
  [extra: string]: unknown;
};

export const positions = ["front", "rear", "kit"] as const;
export type Position = (typeof positions)[number];

export const deliveryMethodCodes = ["pickup", "shipping", "install"] as const;
export type DeliveryMethodCode = (typeof deliveryMethodCodes)[number];

export type Features = {
  account: boolean;
  loyalty: boolean;
  offers: boolean;
  news: boolean;
  campaigns: boolean;
};

export type MetaResponse = {
  features: Features;
  deliveryMethods: { code: DeliveryMethodCode; label: string }[];
  contacts: { phone?: string; email?: string; telegram?: string; address?: string; hours?: string };
};

export type Vehicle = { slug: string; make: string; model: string; label: string };
export type VehiclesResponse = { items: Vehicle[] };

export type Image = { url: string; alt: string; width: number; height: number };
export type Facet = { value: string; label: string; count: number };

export type ProductCard = {
  slug: string;
  code: string;
  title: string;
  vehicle: { slug: string; label: string };
  position: Position;
  image: Image | null;
  priceFrom: number | null;
  status: "available" | "on_request";
};

export type CatalogResponse = {
  items: ProductCard[];
  filters: { position: Facet[]; material: Facet[] };
  page: number;
  pageSize: number;
  total: number;
};

export type ProductDetail = ProductCard & {
  gallery: Image[];
  description: string;
  composition: string[];
  material: string | null;
  installation: string | null;
  compatibility: { vehicleSlug: string; label: string; note?: string }[];
  variants: { id: string; title: string; vehicleSlug: string; priceFrom: number | null; available: boolean }[];
};

export type ProductResponse = { product: ProductDetail } | { redirect: string };

export type SitemapResponse = { urls: { path: string; updatedAt: string }[] };

export const catalogQuery = z.object({
  vehicle: z.string().trim().max(80).optional(),
  position: z.enum(positions).optional(),
  material: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type CatalogQuery = z.infer<typeof catalogQuery>;

const name = z.string().trim().min(1, { error: "Укажите имя" }).max(80, { error: "Не длиннее 80 символов" });
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Не длиннее ${max} символов` })
    .optional()
    .transform((v) => (v === "" ? undefined : v));

export const contactSchema = z
  .object({
    preferred: z.enum(["phone", "email"], { error: "Выберите способ связи" }),
    phone: z.string().trim().max(32).optional(),
    email: z.string().trim().max(254).optional(),
  })
  .superRefine((c, ctx) => {
    if (c.preferred === "phone" && !c.phone) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Укажите телефон" });
    }
    if (c.preferred === "email" && !c.email) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Укажите email" });
    }
    if (c.email && !z.email().safeParse(c.email).success) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Проверьте email" });
    }
  });

const antiBot = {
  website: z.string().max(200).default(""),
  formStartedAt: z.number().int().nonnegative(),
};

export const leadItemSchema = z.object({
  variantId: z.uuid({ error: "Неизвестная позиция" }),
  quantity: z.number().int().min(1, { error: "Минимум 1" }).max(20, { error: "Не больше 20" }),
  seenPriceFrom: z.number().int().positive().nullable().optional(),
});

export const leadRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("catalog"),
    name,
    contact: contactSchema,
    items: z.array(leadItemSchema).min(1, { error: "Подборка пуста" }).max(30),
    deliveryMethod: z.enum(deliveryMethodCodes).optional(),
    comment: optionalText(1000),
    ...antiBot,
  }),
  z.object({
    type: z.literal("custom"),
    name,
    contact: contactSchema,
    vehicle: z.object({
      make: z.string().trim().min(1, { error: "Укажите марку" }).max(60),
      model: z.string().trim().min(1, { error: "Укажите модель" }).max(60),
      year: z.number().int().min(1950).max(2100).optional(),
    }),
    request: z.string().trim().min(3, { error: "Опишите, что нужно изготовить" }).max(2000),
    comment: optionalText(1000),
    ...antiBot,
  }),
  z.object({
    type: z.literal("general"),
    name,
    contact: contactSchema,
    message: z.string().trim().min(3, { error: "Напишите сообщение" }).max(2000),
    ...antiBot,
  }),
]);
export type LeadRequest = z.infer<typeof leadRequestSchema>;

export type LeadCreatedResponse = {
  reference: string;
  status: "received";
  loyaltyStatus?: "pending" | "credited" | "ineligible";
};

export type CatalogChange = { variantId: string; available: boolean; priceFrom: number | null };

export const leadStatuses = ["new", "in_progress", "offer_agreed", "sale_confirmed", "closed"] as const;
export type LeadStatus = (typeof leadStatuses)[number];

export const closeReasons = ["no_contact", "price", "no_solution", "spam", "other"] as const;
export type CloseReason = (typeof closeReasons)[number];

export const staffRoles = ["manager", "editor", "admin"] as const;
export const grants = ["contacts_view", "sales_confirm", "campaigns_send"] as const;
export const roleValues = [...staffRoles, ...grants, "client"] as const;
export type RoleValue = (typeof roleValues)[number];

export const emailRequestSchema = z.object({ email: z.email({ error: "Проверьте email" }).max(254) });
export const emailVerifySchema = z.object({
  challengeId: z.string().min(10).max(100),
  code: z.string().trim().regex(/^\d{6}$/, { error: "Код из 6 цифр" }),
});
export const totpVerifySchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, { error: "Код из 6 цифр" }) });
export const recoveryVerifySchema = z.object({ code: z.string().trim().min(8).max(32) });

export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  roles: RoleValue[];
};

export type SessionResponse = {
  user: SessionUser;
  mfa: { required: boolean; enrolled: boolean; passed: boolean };
  csrfToken: string;
};
