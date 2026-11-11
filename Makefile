# Build tasks for the Tasks desktop app.
#
# Linux needs -tags webkit2_41 on hosts that ship webkit2gtk-4.1 instead of
# 4.0. If yours has 4.0, run `make TAGS= linux`.

WAILS        ?= $(shell command -v wails 2>/dev/null || echo $(HOME)/go/bin/wails)
TAGS         ?= webkit2_41
APP          ?= tasks
PLATFORM_WIN ?= windows/amd64

.PHONY: all linux windows dev deps clean tidy

all: linux windows

# Only needed once, or after package.json changes.
deps:
	cd frontend && npm install

linux:
	$(WAILS) build -tags "$(TAGS)" -o $(APP)

windows:
	$(WAILS) build -tags "$(TAGS)" -o $(APP).exe -platform $(PLATFORM_WIN)

dev:
	$(WAILS) dev -tags "$(TAGS)"

clean:
	rm -rf build/bin

tidy:
	go mod tidy
