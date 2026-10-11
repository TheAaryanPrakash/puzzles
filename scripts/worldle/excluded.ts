// Non-sovereign dependent territories / SARs / Crown dependencies / free-association states /
// uninhabited administrative territories, all under ~2,000 km² — see RESEARCH.md "Excluding very
// small territories" for the reasoning (sovereignty + size, not size alone: small *sovereign*
// countries like Monaco, San Marino and Maldives stay in the pool).
export interface ExcludedTerritory {
  code: string;
  name: string;
  reason: string;
}

export const EXCLUDED_TERRITORIES: ExcludedTerritory[] = [
  { code: "VA", name: "Vatican City", reason: "Not a UN member; ~1 km² — no usable silhouette" },
  { code: "MO", name: "Macao", reason: "Special Administrative Region of China, ~23 km²" },
  { code: "BL", name: "Saint Barthélemy", reason: "Overseas collectivity of France, ~25 km²" },
  { code: "PN", name: "Pitcairn Islands", reason: "UK overseas territory, ~40 km², population ~50" },
  { code: "NF", name: "Norfolk Island", reason: "Australian external territory, ~42 km²" },
  { code: "SX", name: "Sint Maarten", reason: "Constituent country of the Netherlands, ~42 km²" },
  { code: "GG", name: "Guernsey", reason: "UK Crown dependency, ~49 km²" },
  { code: "MF", name: "Saint Martin", reason: "Overseas collectivity of France, ~50 km²" },
  { code: "CK", name: "Cook Islands", reason: "Free association with New Zealand, ~62 km²" },
  { code: "BM", name: "Bermuda", reason: "UK overseas territory, ~65 km²" },
  { code: "MS", name: "Montserrat", reason: "UK overseas territory, ~82 km²" },
  { code: "AI", name: "Anguilla", reason: "UK overseas territory, ~84 km²" },
  { code: "AS", name: "American Samoa", reason: "US unincorporated territory, ~119 km²" },
  { code: "JE", name: "Jersey", reason: "UK Crown dependency, ~127 km²" },
  { code: "WF", name: "Wallis and Futuna", reason: "French overseas collectivity, ~129 km²" },
  {
    code: "IO",
    name: "British Indian Ocean Territory",
    reason: "UK overseas territory, uninhabited except a military base, ~133 km²",
  },
  { code: "VG", name: "British Virgin Islands", reason: "UK overseas territory, ~135 km²" },
  { code: "AW", name: "Aruba", reason: "Constituent country of the Netherlands, ~157 km²" },
  { code: "SH", name: "Saint Helena", reason: "UK overseas territory, ~188 km²" },
  { code: "NU", name: "Niue", reason: "Free association with New Zealand, ~197 km²" },
  { code: "PM", name: "Saint Pierre and Miquelon", reason: "French overseas collectivity, ~207 km²" },
  { code: "KY", name: "Cayman Islands", reason: "UK overseas territory, ~303 km²" },
  { code: "VI", name: "United States Virgin Islands", reason: "US unincorporated territory, ~318 km²" },
  { code: "TC", name: "Turks and Caicos Islands", reason: "UK overseas territory, ~331 km²" },
  { code: "MP", name: "Northern Mariana Islands", reason: "US commonwealth, ~395 km²" },
  {
    code: "HM",
    name: "Heard Island and McDonald Islands",
    reason: "Australian external territory, uninhabited, ~419 km²",
  },
  { code: "CW", name: "Curaçao", reason: "Constituent country of the Netherlands, ~429 km²" },
  { code: "GU", name: "Guam", reason: "US unincorporated territory, ~482 km²" },
  { code: "IM", name: "Isle of Man", reason: "UK Crown dependency, ~562 km²" },
  { code: "AX", name: "Åland", reason: "Autonomous region of Finland, ~761 km²" },
  { code: "FO", name: "Faroe Islands", reason: "Autonomous territory of Denmark, ~1,036 km²" },
];

export const EXCLUDED_CODES: ReadonlySet<string> = new Set(EXCLUDED_TERRITORIES.map((t) => t.code));
