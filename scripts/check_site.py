#!/usr/bin/env python3
"""Dependency-free checks for the static course site."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote,urlparse

ROOT=Path(__file__).resolve().parents[1]
class SiteParser(HTMLParser):
    def __init__(self):
        super().__init__();self.ids=set();self.refs=[];self.images_without_alt=[]
    def handle_starttag(self,tag,attrs):
        values=dict(attrs)
        if "id" in values:self.ids.add(values["id"])
        for attribute in ("href","src"):
            if attribute in values:self.refs.append((attribute,values[attribute]))
        if tag=="img" and not values.get("alt"):self.images_without_alt.append(values.get("src","<unknown>"))
def main():
    failures=[]
    for path in [ROOT/"index.html",ROOT/".nojekyll",ROOT/".github/workflows/pages.yml"]:
        if not path.exists():failures.append(f"missing required file: {path.relative_to(ROOT)}")
    parser=SiteParser();parser.feed((ROOT/"index.html").read_text(encoding="utf-8"))
    for attribute,reference in parser.refs:
        if not reference.strip():
            failures.append(f"empty {attribute} attribute")
            continue
        parsed=urlparse(reference)
        if parsed.scheme in {"http","https","mailto","tel"} or reference.startswith("//"):continue
        if reference.startswith("#"):
            if reference[1:] not in parser.ids:failures.append(f"missing fragment target: {reference}")
            continue
        path=unquote(parsed.path);target=ROOT/path.lstrip("/")
        generated = path == "assets/js/calendar-config.js" and (ROOT / "assets/js/calendar-config.example.js").exists()
        if path and not target.exists() and not generated:failures.append(f"broken {attribute}: {reference}")
    failures.extend(f"image lacks useful alt text: {path}" for path in parser.images_without_alt)
    if failures:
        print("Site checks failed:")
        for failure in failures:print(f"  - {failure}")
        return 1
    print(f"Site checks passed: {len(parser.refs)} references, {len(parser.ids)} fragment targets.");return 0
if __name__=="__main__":raise SystemExit(main())
