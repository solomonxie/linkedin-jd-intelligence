.PHONY: install dev build test test-watch typecheck clean extensions package icons assets check-assets

install:
	npm install

dev:
	npm run dev

build:
	npm run build

test:
	npm run test

test-watch:
	npx vitest

typecheck:
	npx tsc --noEmit

clean:
	rm -rf extension node_modules/.vite

# Builds and zips extension/ into release-v<version>.zip, ready to upload to the
# Chrome Web Store Developer Dashboard.
package:
	npm run package

extensions:
	open -a "Google Chrome" "chrome://extensions"

# Regenerates public/icons/*.png, docs/logo-*.svg and docs/store-icon-128.png.
icons:
	python3 scripts/gen_icons.py

# Regenerates the Chrome Web Store promo tiles in docs/.
assets:
	python3 scripts/gen_store_assets.py

# Verifies every store PNG is an accepted size and 24-bit RGB (no alpha).
check-assets:
	python3 scripts/store_png.py check docs/store-*.png
