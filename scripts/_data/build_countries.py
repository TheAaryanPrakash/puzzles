#!/usr/bin/env python3
"""Build public/assets/shared/countries.json and country-names.json from the raw
world-atlas countries-50m.json TopoJSON (data/geo/countries-50m.json) plus the
ISO 3166-1 numeric -> alpha-2 lookup fetched into /tmp/iso3166.csv's source
(lukes/ISO-3166-Countries-with-Regional-Codes).

Run from the repo root: python3 scripts/_data/build_countries.py
"""
import csv
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW_TOPOJSON = os.path.join(ROOT, "data", "geo", "countries-50m.json")
ISO_CSV = os.path.join(ROOT, "data", "geo", "iso-3166-countries.csv")
OUT_TOPOJSON = os.path.join(ROOT, "public", "assets", "shared", "countries.json")
OUT_NAMES = os.path.join(ROOT, "public", "assets", "shared", "country-names.json")

# Natural Earth / world-atlas ships abbreviated or formal ISO names on some
# features ("Antigua and Barb.", "Russian Federation" via ISO lookup, etc).
# Override with the common English name a casual player would type or expect
# to read. Anything not listed here keeps world-atlas's own `name` property,
# which is already a plain common name for most countries.
NAME_OVERRIDES = {
    "AG": "Antigua and Barbuda",
    "BA": "Bosnia and Herzegovina",
    "IO": "British Indian Ocean Territory",
    "VG": "British Virgin Islands",
    "KY": "Cayman Islands",
    "CF": "Central African Republic",
    "CK": "Cook Islands",
    "CD": "Democratic Republic of the Congo",
    "DO": "Dominican Republic",
    "GQ": "Equatorial Guinea",
    "FO": "Faroe Islands",
    "FK": "Falkland Islands",
    "PF": "French Polynesia",
    "TF": "French Southern and Antarctic Lands",
    "HM": "Heard Island and McDonald Islands",
    "MH": "Marshall Islands",
    "MP": "Northern Mariana Islands",
    "GS": "South Georgia and the South Sandwich Islands",
    "SS": "South Sudan",
    "SB": "Solomon Islands",
    "BL": "Saint Barthélemy",
    "MF": "Saint Martin",
    "KN": "Saint Kitts and Nevis",
    "PM": "Saint Pierre and Miquelon",
    "VC": "Saint Vincent and the Grenadines",
    "TC": "Turks and Caicos Islands",
    "VI": "United States Virgin Islands",
    "WF": "Wallis and Futuna",
    "SZ": "Eswatini",
    "CZ": "Czech Republic",
    "MK": "North Macedonia",
    "CG": "Congo",
    "CI": "Ivory Coast",
    "EH": "Western Sahara",
    "US": "United States",
    "XK": "Kosovo",
}

# Alternate names/abbreviations a player might reasonably type. Only
# populated where a meaningfully common alternate exists; most countries have
# none and get an empty list.
ALIASES = {
    "US": ["USA", "United States of America", "America"],
    "GB": ["UK", "Britain", "Great Britain", "United Kingdom of Great Britain and Northern Ireland"],
    "KR": ["Republic of Korea"],
    "KP": ["Democratic People's Republic of Korea"],
    "RU": ["Russian Federation"],
    "CD": ["DR Congo", "DRC", "Congo-Kinshasa", "Zaire"],
    "CG": ["Republic of the Congo", "Congo-Brazzaville"],
    "CI": ["Cote d'Ivoire", "Côte d'Ivoire"],
    "CZ": ["Czechia"],
    "MK": ["Macedonia"],
    "MM": ["Burma"],
    "SZ": ["Swaziland"],
    "CV": ["Cape Verde"],
    "BN": ["Brunei Darussalam"],
    "VA": ["Holy See", "Vatican City"],
    "TW": ["Chinese Taipei", "Formosa"],
    "NL": ["Holland"],
    "AE": ["UAE", "United Arab Emirates"],
    "LA": ["Lao PDR", "Laos People's Democratic Republic"],
    "IR": ["Persia"],
    "TL": ["East Timor"],
    "FM": ["Federated States of Micronesia"],
    "VI": ["US Virgin Islands"],
    "VG": ["BVI"],
    "BA": ["Bosnia"],
}

# Features with no numeric ISO id in world-atlas: not officially assigned an
# ISO 3166-1 alpha-2 code. Kosovo gets the widely-used (if unofficial) "XK"
# code; the rest are dropped from the guessing-game dataset (see data/README.md).
NO_ID_ALPHA2 = {
    "Kosovo": "XK",
}
DROP_NAMES = {"Somaliland", "N. Cyprus", "Indian Ocean Ter.", "Siachen Glacier"}
# Ashmore and Cartier Is. shares Australia's numeric ISO code (036) in this
# dataset; it's an uninhabited Australian external territory, so drop the
# duplicate feature and keep the "Australia" one.
DROP_DUPLICATE_NAMES = {"Ashmore and Cartier Is."}


def load_iso_table():
    table = {}
    with open(ISO_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            num = int(row["country-code"])
            table[num] = {"alpha2": row["alpha-2"], "iso_name": row["name"]}
    return table


def common_name(alpha2, fallback):
    return NAME_OVERRIDES.get(alpha2, fallback)


def main():
    iso_table = load_iso_table()
    topo = json.load(open(RAW_TOPOJSON))
    geometries = topo["objects"]["countries"]["geometries"]

    kept = []
    codes_seen = {}
    dropped = []
    for g in geometries:
        props = g.get("properties", {})
        ne_name = props.get("name")
        gid = g.get("id")

        if ne_name in DROP_DUPLICATE_NAMES:
            dropped.append((ne_name, "duplicate ISO numeric code"))
            continue
        if gid is None:
            if ne_name in NO_ID_ALPHA2:
                alpha2 = NO_ID_ALPHA2[ne_name]
            elif ne_name in DROP_NAMES:
                dropped.append((ne_name, "no ISO 3166-1 alpha-2 code assigned"))
                continue
            else:
                dropped.append((ne_name, "no numeric id and not in NO_ID_ALPHA2"))
                continue
        else:
            entry = iso_table.get(int(gid))
            if entry is None:
                dropped.append((ne_name, f"numeric id {gid} not found in ISO table"))
                continue
            alpha2 = entry["alpha2"]

        name = common_name(alpha2, ne_name)
        new_geom = dict(g)
        new_geom["properties"] = {"name": name, "iso_a2": alpha2}
        kept.append(new_geom)
        codes_seen[alpha2] = name

    topo["objects"]["countries"]["geometries"] = kept

    os.makedirs(os.path.dirname(OUT_TOPOJSON), exist_ok=True)
    with open(OUT_TOPOJSON, "w") as f:
        json.dump(topo, f, separators=(",", ":"))

    names_out = {
        code: {"name": name, "aliases": ALIASES.get(code, [])}
        for code, name in sorted(codes_seen.items())
    }
    with open(OUT_NAMES, "w") as f:
        json.dump(names_out, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"kept {len(kept)} country features, dropped {len(dropped)}")
    for name, reason in dropped:
        print(f"  dropped: {name} ({reason})")
    print(f"wrote {OUT_TOPOJSON}")
    print(f"wrote {OUT_NAMES} with {len(names_out)} codes")


if __name__ == "__main__":
    main()
