#!/usr/bin/env python3
"""Sanity checks for everything the `data` agent produces: word lists, geo data
and the raw archive dumps. Prints counts and a few spot lookups; paste the
output into data/README.md.

Run from the repo root: python3 scripts/_data/sanity_check.py
"""
import csv
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def p(*parts):
    return os.path.join(ROOT, *parts)


def section(title):
    print(f"\n=== {title} ===")


def check_wordlists():
    section("wordlists/")
    enable = [l.strip() for l in open(p("wordlists", "enable1.txt"), encoding="utf-8")]
    common = [l.strip() for l in open(p("wordlists", "common.txt"), encoding="utf-8")]
    blocklist = [l.strip() for l in open(p("wordlists", "blocklist.txt"), encoding="utf-8")]
    enable_set = set(enable)
    common_set = set(common)
    block_set = set(blocklist)

    print(f"enable1.txt:   {len(enable)} words, {len(enable_set)} unique, "
          f"all lowercase: {all(w == w.lower() for w in enable)}, "
          f"sorted: {enable == sorted(enable)}")
    print(f"common.txt:    {len(common)} words, {len(common_set)} unique "
          f"(wordfreq top_n_list('en', 50000), includes punctuation/numeric tokens by design)")
    print(f"blocklist.txt: {len(blocklist)} entries, {len(block_set)} unique, "
          f"all lowercase: {all(w == w.lower() for w in blocklist)}")

    fair_answers = enable_set & common_set
    fair_clean = fair_answers - block_set
    print(f"ENABLE ∩ common = {len(fair_answers)} candidate fair answers "
          f"(before blocklist); after removing blocklist: {len(fair_clean)}")

    for w in ["snow", "level", "shift", "kayak", "zymurgy", "aa"]:
        print(f'  "{w}" in enable1: {w in enable_set}, in common: {w in common_set}, '
              f"in blocklist: {w in block_set}")


def check_countries():
    section("public/assets/shared/countries.json + country-names.json")
    topo = json.load(open(p("public", "assets", "shared", "countries.json")))
    names = json.load(open(p("public", "assets", "shared", "country-names.json")))
    geoms = topo["objects"]["countries"]["geometries"]
    codes_in_topo = sorted(g["properties"]["iso_a2"] for g in geoms)
    codes_in_names = sorted(names.keys())
    print(f"countries.json: {len(geoms)} features, {len(set(codes_in_topo))} unique iso_a2 codes")
    print(f"country-names.json: {len(names)} codes")
    print(f"topo codes == country-names codes: {codes_in_topo == codes_in_names}")
    print(f"'land' background object present: {'land' in topo['objects']}")

    for code in ["US", "GB", "IN", "KR", "KP", "XK", "CI", "CD"]:
        n = names.get(code)
        print(f"  {code}: {n}")


def check_india_states():
    section("public/assets/shared/india-states.json")
    topo = json.load(open(p("public", "assets", "shared", "india-states.json")))
    layer = list(topo["objects"].keys())[0]
    geoms = topo["objects"][layer]["geometries"]
    codes = sorted(g["properties"]["code"] for g in geoms)
    print(f"layer '{layer}': {len(geoms)} features, {len(set(codes))} unique codes")
    print(f"has Ladakh (IN-LA): {'IN-LA' in codes}, "
          f"has merged Dadra & Nagar Haveli + Daman & Diu (IN-DH): {'IN-DH' in codes}")
    for g in geoms:
        if g["properties"]["code"] in ("IN-LA", "IN-DH", "IN-JK"):
            print(f'  {g["properties"]["code"]}: {g["properties"]["name"]}')


def check_connections():
    section("data/connections/Connections_Data.csv (raw, untouched)")
    rows = list(csv.DictReader(open(p("data", "connections", "Connections_Data.csv"))))
    dates = sorted(set(r["Puzzle Date"] for r in rows))
    ids = set(r["Game ID"] for r in rows)
    print(f"{len(rows)} rows, {len(ids)} puzzles, {len(dates)} unique dates")
    print(f"date range: {dates[0]} .. {dates[-1]}")
    bad = [gid for gid in ids if len([r for r in rows if r["Game ID"] == gid]) != 16]
    print(f"puzzles without exactly 16 word-rows: {len(bad)}")
    print("example puzzle (Game ID 1):")
    for r in rows[:4]:
        print(f'  {r["Word"]:>8} | group {r["Group Level"]}: {r["Group Name"]}')


def check_mini():
    section("data/mini/data.json (raw, untouched)")
    data = json.load(open(p("data", "mini", "data.json")))
    dates = [e["print_date"] for e in data]
    sizes = {}
    for e in data:
        n = len(e["board"]["cells"])
        sizes[n] = sizes.get(n, 0) + 1
    print(f"{len(data)} puzzles, {len(set(dates))} unique dates, "
          f"range {min(dates)} .. {max(dates)}")
    print(f"grid-size distribution (cell count -> puzzle count): {sizes}")
    print("NOTE: no clue text in this dataset, only solution letters per cell "
          "('guess') plus solve timestamps and 'blank' markers for black squares "
          "-- see data/README.md quirks.")
    e = data[0]
    print(f"example puzzle: {e['print_date']} (puzzle_id {e['puzzle_id']}), "
          f"{len(e['board']['cells'])} cells, first 5 cells: {e['board']['cells'][:5]}")


def main():
    check_wordlists()
    check_countries()
    check_india_states()
    check_connections()
    check_mini()


if __name__ == "__main__":
    main()
