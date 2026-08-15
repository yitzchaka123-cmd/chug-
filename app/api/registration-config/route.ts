import { getRuntimeEnv } from "@/lib/runtime-env";
import { ensureCurrentRegistrationConfig } from "@/lib/registration-defaults";
import { resolveRegistrationOffer } from "@/lib/pricing";
import { personalizeAgreementSections } from "@/lib/agreement-content";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const offerToken = new URL(request.url).searchParams.get("offer")?.trim() || "";
    const offer = offerToken ? await resolveRegistrationOffer(runtime, offerToken) : null;
    if (offerToken && !offer) return Response.json({ error: "This custom registration link is invalid, expired, or no longer active." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    const settings = offer?.settings || await ensureCurrentRegistrationConfig(runtime.DB);
    const methods = offer?.allowedPaymentMethod
      ? settings.paymentMethodRecords.filter((method) => method.label === offer.allowedPaymentMethod || method.code === offer.allowedPaymentMethod)
      : settings.paymentMethodRecords;
    const agreementSections = personalizeAgreementSections(settings.agreementSections, {
      schoolYearName: settings.schoolYearName,
      startsOn: settings.startsOn,
      endsOn: settings.endsOn,
      registrationFeeAgorot: offer?.registrationFeeAgorot ?? settings.registrationFeeAgorot,
      monthlyFeeAgorot: offer?.monthlyFeeAgorot ?? settings.monthlyFeeAgorot,
      juneFeeAgorot: offer?.juneFeeAgorot ?? settings.juneFeeAgorot,
      securityCheckAgorot: offer?.securityCheckAgorot ?? settings.securityCheckAgorot,
      securityCheckMonths: settings.securityCheckMonths,
      paymentDueDay: settings.paymentDueDay,
      monthOverrides: offer?.monthOverrides,
      oneTimeAmountAgorot: offer?.oneTimeAmountAgorot,
      customLabel: offer?.label,
      paymentMethodLabels: methods.map((method) => method.label),
      scheduleWeekday: settings.scheduleWeekday,
      scheduleStartTime: settings.scheduleStartTime,
      scheduleEndTime: settings.scheduleEndTime,
      sessionLengthMinutes: settings.sessionLengthMinutes,
      location: settings.location,
    });
    return Response.json({
      year: settings.schoolYearName,
      yearId: settings.schoolYearId,
      agreementVersion: settings.agreementVersionCode,
      agreementSections,
      proofUploadRequired: offer?.proofPolicy === "required" ? true : offer?.proofPolicy === "none" ? false : settings.proofUploadRequired,
      cashReminderText: settings.cashReminderText,
      paymentMethods: methods.map((method) => method.label),
      paymentMethodRecords: methods,
      securityCheckMonths: settings.securityCheckMonths,
      customOffer: offer ? { label: offer.label, token: offerToken, oneTimeAmount: offer.oneTimeAmountAgorot / 100 } : null,
      homeAddressEnabled: settings.homeAddressEnabled,
      schoolEnabled: settings.schoolEnabled,
      schedule: { startsOn: settings.startsOn, endsOn: settings.endsOn, weekday: settings.scheduleWeekday, startTime: settings.scheduleStartTime, endTime: settings.scheduleEndTime, sessionLengthMinutes: settings.sessionLengthMinutes, location: settings.location },
      amounts: {
        registration: (offer?.registrationFeeAgorot ?? settings.registrationFeeAgorot) / 100,
        monthly: (offer?.monthlyFeeAgorot ?? settings.monthlyFeeAgorot) / 100,
        june: (offer?.juneFeeAgorot ?? settings.juneFeeAgorot) / 100,
        securityCheck: (offer?.securityCheckAgorot ?? settings.securityCheckAgorot) / 100,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Registration settings are unavailable." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
