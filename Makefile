.PHONY: serve check

serve:
	python3 -m http.server 4000 --bind 127.0.0.1

check:
	python3 scripts/check_site.py
