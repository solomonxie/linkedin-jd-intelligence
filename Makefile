.PHONY: install dev build test test-watch typecheck clean extensions

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

extensions:
	open -a "Google Chrome" "chrome://extensions"
