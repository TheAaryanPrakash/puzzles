#!/usr/bin/env python3
"""Convert the DataMeet States/Admin2 shapefile (data/geo/india/Admin2.shp, committed raw)
to a full-resolution GeoJSON FeatureCollection with ST_NM -> {name, code} (ISO 3166-2:IN)
properties. Writes to a temp path -- this intermediate is NOT committed (it's ~43 MB,
full Survey-of-India coastline resolution); only the mapshaper-simplified TopoJSON in
public/assets/shared/india-states.json is. Feed the output of this script to mapshaper,
e.g.:

  python3 scripts/_data/shp_to_geojson.py
  npx mapshaper -i /tmp/india-states-full.geojson -simplify 3% keep-shapes \
      -o format=topojson public/assets/shared/india-states.json

Run from the repo root: python3 scripts/_data/shp_to_geojson.py
"""
import json
import os

import shapefile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHP = os.path.join(ROOT, "data", "geo", "india", "Admin2.shp")
OUT = "/tmp/india-states-full.geojson"

# Current ISO 3166-2:IN codes (post Jammu & Kashmir/Ladakh split 2019,
# post Dadra and Nagar Haveli + Daman and Diu merger 2020, post Chhattisgarh/
# Odisha/Telangana/Uttarakhand code updates).
ST_NM_TO_CODE = {
    "Andaman & Nicobar": "AN",
    "Andhra Pradesh": "AP",
    "Arunachal Pradesh": "AR",
    "Assam": "AS",
    "Bihar": "BR",
    "Chandigarh": "CH",
    "Chhattisgarh": "CG",
    "Dadra and Nagar Haveli and Daman and Diu": "DH",
    "Delhi": "DL",
    "Goa": "GA",
    "Gujarat": "GJ",
    "Haryana": "HR",
    "Himachal Pradesh": "HP",
    "Jammu & Kashmir": "JK",
    "Jharkhand": "JH",
    "Karnataka": "KA",
    "Kerala": "KL",
    "Ladakh": "LA",
    "Lakshadweep": "LD",
    "Madhya Pradesh": "MP",
    "Maharashtra": "MH",
    "Manipur": "MN",
    "Meghalaya": "ML",
    "Mizoram": "MZ",
    "Nagaland": "NL",
    "Odisha": "OD",
    "Puducherry": "PY",
    "Punjab": "PB",
    "Rajasthan": "RJ",
    "Sikkim": "SK",
    "Tamil Nadu": "TN",
    "Telangana": "TS",
    "Tripura": "TR",
    "Uttar Pradesh": "UP",
    "Uttarakhand": "UK",
    "West Bengal": "WB",
}


def main():
    sf = shapefile.Reader(SHP)
    features = []
    seen_names = set()
    for i, rec in enumerate(sf.records()):
        name = rec["ST_NM"]
        seen_names.add(name)
        code = ST_NM_TO_CODE[name]
        shape = sf.shape(i)
        geom = shape.__geo_interface__
        features.append(
            {
                "type": "Feature",
                "properties": {"name": name, "code": f"IN-{code}"},
                "geometry": geom,
            }
        )

    missing = set(ST_NM_TO_CODE) - seen_names
    if missing:
        raise SystemExit(f"shapefile missing expected states: {missing}")
    assert len(features) == 36, f"expected 36 states/UTs, got {len(features)}"

    fc = {"type": "FeatureCollection", "features": features}
    with open(OUT, "w") as f:
        json.dump(fc, f)
    print(f"wrote {OUT} with {len(features)} features")


if __name__ == "__main__":
    main()
