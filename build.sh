#!/bin/sh
cd $(git rev-parse --show-toplevel)
rm -rf dist
npx ncc build -m src/index.mjs
cat nyanpasu.js dist/index.mjs > dist/nyanpasu.mjs
chmod +x dist/nyanpasu.mjs
