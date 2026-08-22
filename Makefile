.PHONY: install dev build test test-watch typecheck clean extensions package

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
	rm -rf dist node_modules/.vite

# Builds and zips dist/ into release-v<version>.zip, ready to upload to the
# Chrome Web Store Developer Dashboard.
package:
	npm run package

extensions:
	open -a "Google Chrome" "chrome://extensions"
