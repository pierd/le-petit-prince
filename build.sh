#!/bin/sh
# Build the bilingual PDF.  Usage:  ./build.sh
set -e

DIR=$(cd "$(dirname "$0")" && pwd)
cd "$DIR"

# TeX on macOS lives in /Library/TeX/texbin and is often not on PATH.
if ! command -v pdflatex >/dev/null 2>&1; then
    PATH="/Library/TeX/texbin:$PATH"
    export PATH
fi

command -v pdflatex >/dev/null 2>&1 || {
    echo "pdflatex not found. Install TeX Live: brew install --cask mactex-no-gui" >&2
    exit 1
}

for i in 1 2; do
    echo "--- pdflatex pass $i"
    pdflatex -interaction=nonstopmode bilingual-template.tex
done

echo
echo "Done: $DIR/bilingual-template.pdf"
