#!/usr/bin/env python3
"""Build the web mod, removing explicitly delimited Steam-only source blocks.

No dependency acquisition, game access or deployment. Only the selected output
is written. Unbalanced/nested delimiters and leaked adapter identifiers fail
before writing, so a source edit cannot silently ship Steam support on the web.
"""
import argparse
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
BEGIN = "// @steam-only begin"
END = "// @steam-only end"
# Match adapter families, not the pre-existing Frozen shimmer compatibility note.
STEAM_SYMBOLS = re.compile(
    r"(?:[Gg]reenhouse|[Ff]rozenCookies|a11yFrozen|fc_menu|fcButton|"
    r"grandpas greenhouse|frozen_cookies|steamOptionalMod|FCshortcuts)"
)


def web_source(source):
    result = []
    inside = False
    blocks = 0
    for number, line in enumerate(source.splitlines(keepends=True), 1):
        marker = line.strip()
        if marker == BEGIN:
            if inside:
                raise ValueError(f"Nested Steam-only block at line {number}")
            inside = True
            blocks += 1
        elif marker == END:
            if not inside:
                raise ValueError(f"Unmatched Steam-only end at line {number}")
            inside = False
        elif "@steam-only" in line:
            raise ValueError(f"Malformed Steam-only delimiter at line {number}")
        elif not inside:
            result.append(line)
    if inside or blocks == 0:
        raise ValueError("Missing or unclosed Steam-only blocks")
    result = "".join(result)
    leaked = STEAM_SYMBOLS.search(result)
    if leaked:
        raise ValueError(f"Steam-only identifier leaked into web source: {leaked[0]}")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "cookie-clicker-accessibility.user.js")
    args = parser.parse_args()
    source = web_source((ROOT / "main.js").read_text(encoding="utf-8"))
    header = (ROOT / "userscript-header.txt").read_text(encoding="utf-8")
    output = header.rstrip() + "\n\n" + """(function() {
    'use strict';

    // Wrap registration until the game is ready.
    function registerAccessibilityMod() {
        if (typeof Game === 'undefined' || !Game.ready) {
            setTimeout(registerAccessibilityMod, 100);
            return;
        }

""" + source.rstrip() + "\n" + """
    }
    registerAccessibilityMod();
})();
"""
    with args.output.open("w", encoding="utf-8", newline="\n") as target:
        target.write(output)
    print(f"Built {args.output} ({len(output.encode('utf-8'))} bytes)")


if __name__ == "__main__":
    main()
