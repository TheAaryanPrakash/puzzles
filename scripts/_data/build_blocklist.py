#!/usr/bin/env python3
"""Build wordlists/blocklist.txt: the LDNOOBW English list plus a supplementary set of
ethnic/racial/ableist/homophobic slurs LDNOOBW doesn't already cover. Used by every
generator to remove unfair/offensive answers (CLAUDE.md "Word data").

Run from the repo root: python3 scripts/_data/build_blocklist.py
"""
import os
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LDNOOBW_URL = (
    "https://raw.githubusercontent.com/LDNOOBW/"
    "List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/master/en"
)
OUT = os.path.join(ROOT, "wordlists", "blocklist.txt")

# Slurs across ethnicity/race, disability, sexuality and gender not already present in
# the LDNOOBW list (which leans heavily toward sexual/profane terms). Checked against
# LDNOOBW before adding -- see scripts/_data/sanity_check.py's blocklist dedup check.
EXTRA_SLURS = [
    "chink", "chinks", "gook", "gooks", "cracker", "crackers", "dyke", "dykes",
    "spook", "spooks", "retard", "retards", "retarded", "gypsy", "gypsies",
    "towelhead", "towelheads", "raghead", "ragheads", "injun", "injuns",
    "redskin", "redskins", "jap", "japs", "slant", "slants", "slanteye",
    "negro", "negroes", "darkie", "darkies", "mick", "micks", "wop", "wops",
    "guido", "guidos", "kraut", "krauts", "kyke", "kikes", "yid", "yids",
    "zipperhead", "zipperheads", "oreo", "oreos", "uncle tom", "sambo", "sambos",
    "jigaboo", "jigaboos", "porchmonkey", "porch monkey", "camel jockey",
    "sand nigger", "abo", "abos", "boong", "boongs", "golliwog", "golliwogs",
    "wigger", "wiggers", "octoroon", "mulatto", "halfbreed", "half-breed",
    "shemale", "shemales", "ladyboy", "ladyboys", "faggy", "fags", "crippled",
    "cripple", "cripples", "mongoloid", "mongoloids", "spaz", "spazzes",
    "spastic", "midget", "midgets",
]


def main():
    with urllib.request.urlopen(LDNOOBW_URL, timeout=30) as resp:
        base = [line.decode("utf-8").strip().lower() for line in resp if line.strip()]

    combined = sorted(set(base) | set(EXTRA_SLURS))
    with open(OUT, "w") as f:
        f.write("\n".join(combined) + "\n")
    print(f"wrote {OUT}: {len(combined)} entries ({len(base)} from LDNOOBW, "
          f"{len(set(EXTRA_SLURS) - set(base))} supplementary)")


if __name__ == "__main__":
    main()
