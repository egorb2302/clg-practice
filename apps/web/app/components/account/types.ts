import type { Post } from "./post";

export type Profile = {
  id: string;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  name: string | null;
  identities: string[];
};

export type Lead = { reference: string; type: "catalog" | "custom" | "general"; status: string; createdAt: string; items: number };
export type Claimable = { reference: string; type: Lead["type"]; createdAt: string };
export type Purchase = {
  id: string;
  status: "confirmed" | "partially_refunded" | "refunded";
  amount: number;
  refunded: number;
  soldOn: string;
  items: { title: string; quantity: number }[];
};
export type LedgerRow = { type: "earn" | "redeem" | "reverse" | "expire" | "adjust"; points: number; reason: string | null; createdAt: string; expiresAt: string | null };
export type Loyalty = { balance: number; history: LedgerRow[]; pending: { points: number; reference: string; confirmDeadline: string }[] };
export type MyOffers = { purchases: number; items: Post[] };
export type Subscription = { status: "pending" | "active" | "unsubscribed"; email: string; unsubscribe: string } | null;
