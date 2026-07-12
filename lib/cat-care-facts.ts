/**
 * British Shorthair care reference — distilled from a cross-checked veterinary
 * research pass (Granström 2011 HCM cohort; Kwan 2023 BSH bodyweight; WSAVA /
 * AAHA-AAFP 2020/2021; ESCCAP / TroCCAP for tropical Jakarta; Cornell FHC;
 * Royal Canin / Purina fecal scoring). Numbers are directional references, not
 * prescriptions — every red flag routes to "see your vet", never a home fix.
 *
 * ONE source of truth: the in-app handbook (/care-guide) renders `CARE_GUIDE`,
 * and the AI prompts import `AI_CARE_CONTEXT` so the assistant reasons from
 * these real numbers instead of generic caution.
 */

export type GuideItem = { label: string; value: string };
export type GuideSection = {
  id: string;
  title: string;
  blurb: string;
  items: GuideItem[];
  redFlags: string[];
};

export const CARE_GUIDE: GuideSection[] = [
  {
    id: "weight",
    title: "Weight & body condition",
    blurb:
      "British Shorthairs are a large, stocky breed and run high for obesity — nearly half are overweight in breed studies, and their cobby build hides fat gain. Score by feel, not the scale.",
    items: [
      { label: "Ideal weight (lean, BCS 5/9)", value: "males ~5–7 kg · females ~3.5–5.5 kg" },
      { label: "Body Condition Score", value: "4–5 = ideal · 6–7 = overweight · 8–9 = obese" },
      { label: "The lean look", value: "ribs easily felt, waist visible from above, slight belly tuck from the side" },
      { label: "Home check", value: "monthly weigh-in + BCS by feel; a >5% change unexplained by diet is worth noting" },
    ],
    redFlags: [
      "Ribs no longer easily felt, or a hanging belly pad that swings when walking",
      "Reluctance to jump, play, or groom the rear; new limping (excess weight ≈ 2.5× joint-pain risk)",
    ],
  },
  {
    id: "food",
    title: "Feeding & calories",
    blurb:
      "Feed to a daily calorie number, then adjust over 4–6 weeks by measured weight and body condition — the formula varies ±30% per cat. The classic failure mode is free-feeding dry food.",
    items: [
      { label: "Daily need (neutered adult)", value: "MER = 70 × (ideal kg)^0.75 × 1.2" },
      { label: "Typical 4–5 kg indoor cat", value: "~180–260 kcal/day (≈44–55 kcal per kg of ideal weight)" },
      { label: "Intact adult multiplier", value: "× 1.4 instead of × 1.2" },
      { label: "Treats", value: "cap at ≤10% of daily calories (the app warns past this)" },
      { label: "Wet vs dry", value: "wet ~70–78% water aids hydration & satiety; measure meals by scale, not scoops" },
    ],
    redFlags: [
      "Refusing food for 24–48h+, especially in an overweight cat — fatty-liver risk; never crash-diet a fat cat",
      "More thirst + urinating with weight loss despite a good appetite — screen for diabetes",
    ],
  },
  {
    id: "heart",
    title: "Heart — HCM (the #1 breed concern)",
    blurb:
      "Hypertrophic cardiomyopathy is the breed's biggest health risk and shows up young. There is no reliable HCM gene test for British Shorthairs — an echocardiogram is the only real screen.",
    items: [
      { label: "Breed prevalence", value: "~8.5% overall — males 20% vs females 2%" },
      { label: "Median age at diagnosis", value: "2.7 years (this breed develops it young)" },
      { label: "Screening", value: "echo from ~2 years for breeding cats; any murmur/gallop → echo at any age" },
      { label: "Resting breathing rate", value: "count sleeping breaths — under 30/min is normal" },
    ],
    redFlags: [
      "Fast or labored breathing at rest (>30 sleeping breaths/min), open-mouth breathing, or panting — emergency",
      "Sudden hind-leg weakness/paralysis, crying, cold pale foot pads — possible saddle thrombus; go now",
      "Fainting or collapse — never normal",
    ],
  },
  {
    id: "hydration",
    title: "Water & hydration",
    blurb:
      "The breed's weight and lower-urinary-tract tendencies make hydration worth watching. Total water includes food moisture — a wet-fed cat drinks little at the bowl and that's fine.",
    items: [
      { label: "Daily water target (all sources)", value: "~50 ml/kg (normal 40–66) — 5 kg cat ≈ 250–300 ml" },
      { label: "Boost hydration", value: "wet food, a fountain/running water, extra bowls away from food & litter" },
      { label: "Too much (see vet)", value: ">100 ml/kg/day (or >50 ml/kg on a wet diet)" },
      { label: "Dehydration check", value: "skin over the shoulders should snap back fast; gums moist, not tacky" },
    ],
    redFlags: [
      "Marked increase in drinking and/or urine volume — screen for kidney disease, diabetes, thyroid",
      "Skin stays tented + dry/tacky gums + lethargy — clinical dehydration, needs fluids",
    ],
  },
  {
    id: "litter",
    title: "Litter — stool & urine",
    blurb:
      "A consistent litter record is one of the best early-warning tools you have. Healthy output is boringly regular; changes in form, color, or frequency are the signal.",
    items: [
      { label: "Healthy stool", value: "firm, segmented, holds form, brown to dark brown, no blood/mucus" },
      { label: "Stool frequency", value: "about once or twice a day (up to ~48h can be normal if otherwise well)" },
      { label: "Healthy urine", value: "clear to pale yellow, no cloudiness or grit" },
      { label: "Urine frequency", value: "~2–4 times/day; with clumping litter ~3–6 clumps, golf- to tennis-ball sized" },
    ],
    redFlags: [
      "Straining with little or no urine, or blood in urine — possible blockage; in males a same-day emergency",
      "No stool for 48–72h+, or repeated straining and hard dry pellets — constipation",
      "Diarrhea lasting >48h, or any black/tarry stool",
    ],
  },
  {
    id: "preventive",
    title: "Vaccines, worming & fleas (Jakarta)",
    blurb:
      "Intervals tuned for an indoor cat in a tropical climate. Indoor doesn't mean unexposed — fleas ride in on shoes, and rabies is endemic in Indonesia, so keep it current. Confirm exact products with your vet.",
    items: [
      { label: "FVRCP (core)", value: "kitten series to ≥16 wks, boost at ~1 yr, then every 3 years indoors" },
      { label: "Rabies (core in Indonesia)", value: "from 12 wks, boost at 1 yr, then per product/local law" },
      { label: "Deworming", value: "every 3 months (quarterly); a stool test twice a year is a good tropical add-on" },
      { label: "Flea prevention", value: "monthly, year-round — Jakarta has no low season" },
    ],
    redFlags: [
      "Rice-grain segments near the tail or spaghetti-like worms in stool/vomit",
      '"Flea dirt" (black specks that go red-brown when wet), scabs along the lower back, or overgrooming',
      "Sneezing, runny eyes/nose, or mouth ulcers — possible vaccine-breakthrough virus",
    ],
  },
  {
    id: "dental",
    title: "Teeth & other checks",
    blurb:
      "Dental disease is age-driven and easy to miss, and British Shorthairs carry a couple of breed-specific things worth a one-time check.",
    items: [
      { label: "Teeth", value: "brush most days (the only home method with strong evidence); dental check each annual visit" },
      { label: "Blood type", value: "BSH are ~20–45% type B — type both parents before breeding (neonatal-isoerythrolysis risk); know your cat's type before any transfusion" },
      { label: "PKD", value: "uncommon in the breed; a one-time DNA test clears breeding lines" },
    ],
    redFlags: [
      "Bad breath, drooling, dropping food, chewing on one side, or pawing at the mouth — dental pain",
      "In newborn kittens of a type-B queen: jaundice, dark urine, sudden fading in the first days",
    ],
  },
];

/**
 * Compact fact block injected into the AI system prompts so the assistant
 * anchors on real British Shorthair numbers (not generic caution) while still
 * routing red flags to the vet. Kept terse to spare tokens.
 */
export const AI_CARE_CONTEXT = `British Shorthair reference numbers (use these; they are breed-specific, not generic — still never diagnose, and route red flags to the vet):
- Weight: large stocky breed, obesity-prone (~half are overweight). Ideal lean males ~5-7kg, females ~3.5-5.5kg. Body Condition Score 4-5 ideal, 6-7 over, 8-9 obese. Score by feel (ribs), not the scale.
- Calories: neutered daily need ≈ 70 × (ideal kg)^0.75 × 1.2; a 4-5kg indoor cat ≈ 180-260 kcal/day (~44-55 kcal/kg ideal). Treats ≤10% of daily kcal.
- Water: ~50 ml/kg/day total incl. food moisture (5kg ≈ 250-300ml); >100 ml/kg (or >50 on wet food) is excessive → vet.
- Stool: firm, segmented, brown, no blood/mucus; ~1-2x/day, up to 48h normal if well. Urine: clear to pale yellow; ~2-4x/day, ~3-6 clumps.
- Preventive (indoor, tropical Jakarta): FVRCP every 3y adult; rabies core (endemic); deworm quarterly; flea prevention monthly year-round.
- Heart: HCM is the top breed risk (~8.5%; males ~20%), onset young (~2.7y); resting/sleeping breathing over 30/min is a red flag. Labored/open-mouth breathing, sudden hind-leg paralysis, fainting = emergency.`;
