export type PromptKind = "detail-sheet" | "flyer" | "custom";
export type PromptFacts = {
  brandName: string; descriptor: string; schoolYear: string; phone: string; website?: string;
  schedule?: string; groups?: string; ages?: string; fees?: string; registrationFee?: string;
  location?: string; benefits?: string; recording?: string; callToAction?: string; customBrief?: string;
};

const directions = [
  { name: "Elegant studio editorial", palette: "warm white, deep burgundy, muted blush and restrained champagne accents", layout: "editorial grid with generous breathing room, a strong typographic hierarchy and one confident focal image" },
  { name: "Modern performance poster", palette: "soft ivory, wine red, dusty rose and subtle charcoal", layout: "bold asymmetric composition, crisp information modules and controlled stage-inspired movement" },
  { name: "Refined recital program", palette: "white, burgundy, pale rose and fine black rules", layout: "quiet luxury, centered brand moment, structured facts and subtle musical rhythm" },
  { name: "Warm contemporary school guide", palette: "warm white, raspberry burgundy, soft peach and ink", layout: "friendly modular layout, readable cards and polished documentary photography" },
] as const;

export function buildCreativePrompt(kind: PromptKind, facts: PromptFacts, variation = 0, styleOverride = "") {
  const direction = directions[Math.abs(variation) % directions.length];
  const exactFacts = Object.entries(facts).filter(([, value]) => value).map(([key, value]) => `${key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}: ${value}`).join("\n");
  const format = kind === "detail-sheet" ? "A clean information-first detail sheet. This is NOT a promotional flyer." : kind === "flyer" ? "A polished promotional flyer with emotional visual impact and an immediate call to action." : `A professional custom Choir Chug communication piece. Purpose: ${facts.customBrief || "clear parent communication"}.`;
  return `FILES TO ATTACH BEFORE GENERATING
1. Attach the official transparent PNG logo for ${facts.brandName} FIRST. Use the supplied logo exactly as provided. Do not redraw, restyle, recolor, crop, replace, reinterpret or retype it. Keep every letter, apostrophe, crown, divider line, sparkle and color accurate.
2. Attach one or more approved Choir Chug photographs only if they are intended for this piece. Preserve faces, modest clothing, microphones and instruments naturally; do not invent or alter any child.
3. If a QR code will be used, attach the finished QR code as a separate image and keep it crisp, square and scannable.
4. Attach a style reference only if it supports the direction below. The official logo and exact facts always take priority over the reference.

OUTPUT PURPOSE
${format}

FORMAT AND PRODUCTION
Create a print-ready ${kind === "flyer" ? "A4 portrait design that can also crop cleanly to a 4:5 social post" : "A4 portrait page"}. Use high resolution, safe margins, clean alignment and readable text at normal viewing size. Do not render the design as a mockup, on a desk, in a frame or with perspective distortion. Output the flat finished artwork only.

APPROVED CREATIVE DIRECTION
Style: ${styleOverride || direction.name}.
Palette: ${direction.palette}. Match the burgundy/red family already present in the supplied logo. Avoid neon pink, excessive glitter, childish clip art, generic AI sparkles and crowded decoration.
Composition: ${direction.layout}. Use a professional girls' choir/studio atmosphere—warm, uplifting, capable and sincere. The result should feel designed by an experienced brand studio, not generated from a generic template.

LOGO RULES
Place the supplied logo prominently near the top with generous clear space. The logo must remain fully legible and proportional. Never type the brand name in an imitation of the logo. If the brand name is repeated in body copy, use a clean supporting typeface.

TEXT ACCURACY — COPY VERBATIM
Use every selected fact below exactly as written. Do not change spelling, punctuation, names, dates, prices, phone numbers, Hebrew text, times or locations. Do not invent groups, ages, discounts, session lengths, concerts, promises or payment terms. If the layout cannot fit all text legibly, simplify decoration or reduce nonessential imagery—never rewrite or omit approved facts.

${exactFacts}

TYPOGRAPHY AND HIERARCHY
Use a highly legible modern sans serif for facts and a refined display face only for short headlines. Keep body text large enough for print. Use clear sections, consistent spacing and strong contrast. Do not warp text, place text across faces, use faux handwriting for important details or generate nonsense microtext.

IMAGE DIRECTION
If approved photos are attached, use them as real documentary images. Keep all girls visible where practical and do not cut through faces, hands or microphones. Use subtle tonal correction only. If no photo is attached, build the piece with typography, restrained stage-light shapes and brand color—not invented children.

FINAL QUALITY CHECK BEFORE OUTPUT
Confirm that the supplied logo is unchanged; every exact fact matches character-for-character; all prices use the correct shekel symbol and amount; every date and time is correct; text is readable; no extra offer or schedule was invented; and the final result is flat, high-resolution, professionally aligned artwork.`;
}

