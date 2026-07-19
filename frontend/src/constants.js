export const MAX_DESCRIPTION_LENGTH = 2000; // mirrors backend/src/routes/reports.js

export const QUICK_EMOJI = [
  "😀", "😂", "😍", "😢", "😡", "👍", "👎", "🙏",
  "🔥", "💯", "🤔", "😱", "🎉", "👀", "💰", "⚠️",
  "🏛️", "⚖️", "🚨", "🤝", "🙌", "😤", "🫡", "💀",
];

export const CATEGORIES = [
  { value: "bribery", label: "Bribery" },
  { value: "abuse_of_office", label: "Abuse of Office" },
  { value: "embezzlement", label: "Embezzlement" },
  { value: "electoral_malpractice", label: "Electoral Malpractice" },
  { value: "other", label: "Other" },
];

export const STATUSES = [
  { value: "unverified", label: "Unverified" },
  { value: "corroborated", label: "Corroborated" },
  { value: "disputed", label: "Disputed" },
  { value: "official_response", label: "Official Response" },
];

// Article 142 (President), County Governments Act (Governor) — everything
// else in Kenya's structure currently has no constitutional term limit.
export const KENYA_TERM_LIMITS = [
  { role: "President", length: "5 yrs", limit: "2 terms (10 yrs max)" },
  { role: "Governor", length: "5 yrs", limit: "2 terms (10 yrs max)" },
  { role: "Senator", length: "5 yrs", limit: "No limit" },
  { role: "MP (National Assembly)", length: "5 yrs", limit: "No limit" },
  { role: "Woman Representative", length: "5 yrs", limit: "No limit" },
  { role: "MCA", length: "5 yrs", limit: "No limit" },
];

export const KENYA_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa",
  "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi",
  "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu",
  "Machakos", "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa",
  "Murang'a", "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua",
  "Nyeri", "Samburu", "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi",
  "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
];
