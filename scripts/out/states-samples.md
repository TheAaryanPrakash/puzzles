# states — sample days

Pool: 36 states/UTs. Schedule: 365 days from 2026-10-12, cycling every 36 days (~10.1 cycles).
India-scaled max centroid distance (used as proximity%'s 0% point): 3105 km.
States/UTs rendered with more than one silhouette part (islands, enclaves): 12.

## Sample days

- **Day 1** (2026-10-12): `IN-DL` — Delhi
- **Day 71** (2026-12-21): `IN-GJ` — Gujarat
- **Day 151** (2027-03-11): `IN-SK` — Sikkim
- **Day 241** (2027-06-09): `IN-TS` — Telangana
- **Day 331** (2027-09-07): `IN-CH` — Chandigarh

## Full roster (alphabetical)

- `IN-AN` Andaman & Nicobar (48 parts)
- `IN-AP` Andhra Pradesh (2 parts)
- `IN-AR` Arunachal Pradesh
- `IN-AS` Assam
- `IN-BR` Bihar
- `IN-CH` Chandigarh
- `IN-CG` Chhattisgarh
- `IN-DH` Dadra and Nagar Haveli and Daman and Diu (3 parts)
- `IN-DL` Delhi
- `IN-GA` Goa
- `IN-GJ` Gujarat (9 parts)
- `IN-HR` Haryana
- `IN-HP` Himachal Pradesh
- `IN-JK` Jammu & Kashmir
- `IN-JH` Jharkhand
- `IN-KA` Karnataka
- `IN-KL` Kerala (2 parts)
- `IN-LA` Ladakh
- `IN-LD` Lakshadweep (3 parts)
- `IN-MP` Madhya Pradesh (3 parts)
- `IN-MH` Maharashtra (2 parts)
- `IN-MN` Manipur
- `IN-ML` Meghalaya
- `IN-MZ` Mizoram
- `IN-NL` Nagaland
- `IN-OD` Odisha
- `IN-PY` Puducherry (12 parts)
- `IN-PB` Punjab
- `IN-RJ` Rajasthan
- `IN-SK` Sikkim
- `IN-TN` Tamil Nadu (8 parts)
- `IN-TS` Telangana
- `IN-TR` Tripura
- `IN-UP` Uttar Pradesh (3 parts)
- `IN-UK` Uttarakhand
- `IN-WB` West Bengal (56 parts)

## Anything suspicious

- Multi-part silhouettes (Andaman & Nicobar, Lakshadweep, Puducherry's 4 enclaves, Gujarat, Maharashtra, Tamil Nadu, Uttar Pradesh, West Bengal, Andhra Pradesh, Kerala, Madhya Pradesh, and the merged Dadra-Nagar-Haveli-Daman-Diu) render with real gaps between parts — expected, not a bug (see RESEARCH.md §4).
- Chandigarh, Delhi, Puducherry and Lakshadweep are geographically tiny but render at the same visual size as Rajasthan — intentional (per-feature fit, see RESEARCH.md §4).
