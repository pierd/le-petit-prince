#!/bin/sh
# Build the bilingual Le Petit Prince.
#
#   ./build-book.sh              regenerate + compile, refusing an unfinished Spanish
#   ./build-book.sh --draft      compile with French standing in for missing Spanish
#   ./build-book.sh --tex-only   only (re)generate le-petit-prince.tex
#
# Step 1 fetches the French text and the 47 illustrations (both are cached, so
# this is a no-op after the first run). Step 2 pairs the two languages. Step 3
# runs pdflatex twice so page numbers settle.
set -e
cd "$(dirname "$0")"

TEXBIN="/Library/TeX/texbin"
[ -d "$TEXBIN" ] && PATH="$TEXBIN:$PATH" && export PATH

if [ ! -f content/fr.txt ]; then
    echo "==> fetching the French text and illustrations"
    python3 tools/fetch_source.py
fi

echo "==> generating le-petit-prince.tex"
python3 tools/makebook.py "$@" || exit $?

case "$*" in
    *--tex-only*) exit 0 ;;
esac

echo "==> pdflatex (twice)"
pdflatex -interaction=nonstopmode -halt-on-error le-petit-prince.tex >/dev/null
pdflatex -interaction=nonstopmode -halt-on-error le-petit-prince.tex >/dev/null

SUMMARY=$(grep -o '([0-9][0-9]* pages[^)]*)' le-petit-prince.log | tail -1 || true)
echo "==> done: le-petit-prince.pdf ${SUMMARY}"
