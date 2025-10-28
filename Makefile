.PHONY: dev
dev:
	npm run tauri dev

.PHONY: build
build:
	npm run tauri build

.PHONY: test
test:
	cd src-tauri && cargo test

.PHONY: icons
icons:
	 npm run tauri icon logo.svg

