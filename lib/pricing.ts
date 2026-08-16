import { isPastInJerusalem } from "@/lib/calendar";
import { ensureCurrentRegistrationConfig, type RegistrationSettings } from "@/lib/registration-defaults";
import type { ChoirRuntimeEnv } from "@/lib/runtime-env";
import { hashOpaqueToken } from "@/lib/security";

export type ResolvedRegistrationOffer = {
  id: string;
  label: string;
  token: string;
  settings: RegistrationSettings;
  groupId: string | null;
  registrationFeeAgorot: number;
  monthlyFeeAgorot: number;
  juneFeeAgorot: number;
  securityCheckAgorot: number;
  oneTimeAmountAgorot: number;
  monthOverrides: Record<string, number>;
  allowedPaymentMethod: string | null;
  proofPolicy: "required" | "optional" | "none" | null;
};

type OfferRow = {
  id: string; label: string; school_year_id: string; group_id: string | null;
  registration_fee_agorot: number | null; monthly_fee_agorot: number | null; june_fee_agorot: number | null;
  security_check_agorot: number | null; one_time_amount_agorot: number | null; month_overrides_json: string;
  allowed_payment_method: string | null; proof_policy: string | null; status: string; max_uses: number | null;
  use_count: number; expires_at: string | null;
};

export async function resolveRegistrationOffer(runtime: ChoirRuntimeEnv, token: string): Promise<ResolvedRegistrationOffer | null> {
  if (!token || token.length > 300) return null;
  const tokenHash = await hashOpaqueToken(token, runtime.CHOIR_TOKEN_SECRET);
  const row = await runtime.DB.prepare(`SELECT * FROM custom_registration_links WHERE token_hash = ? LIMIT 1`).bind(tokenHash).first<OfferRow>();
  if (!row || row.status !== "active") return null;
  if (row.expires_at && isPastInJerusalem(row.expires_at)) return null;
  if (row.max_uses !== null && row.use_count >= row.max_uses) return null;
  const settings = await ensureCurrentRegistrationConfig(runtime.DB, row.school_year_id);
  let monthOverrides: Record<string, number> = {};
  try {
    const raw = JSON.parse(row.month_overrides_json) as Record<string, unknown>;
    monthOverrides = Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, number] => /^\d{4}-\d{2}$/.test(entry[0]) && typeof entry[1] === "number").map(([key, value]) => [key, Math.round(value * (value < 10000 ? 100 : 1))]));
  } catch { monthOverrides = {}; }
  const policy = ["required", "optional", "none"].includes(row.proof_policy || "") ? row.proof_policy as ResolvedRegistrationOffer["proofPolicy"] : null;
  return {
    id: row.id, label: row.label, token, settings, groupId: row.group_id,
    registrationFeeAgorot: row.registration_fee_agorot ?? settings.registrationFeeAgorot,
    monthlyFeeAgorot: row.monthly_fee_agorot ?? settings.monthlyFeeAgorot,
    juneFeeAgorot: row.june_fee_agorot ?? settings.juneFeeAgorot,
    securityCheckAgorot: row.security_check_agorot ?? settings.securityCheckAgorot,
    oneTimeAmountAgorot: row.one_time_amount_agorot ?? 0,
    monthOverrides,
    allowedPaymentMethod: row.allowed_payment_method,
    proofPolicy: policy,
  };
}

