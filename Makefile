# Build tasks for the Tasks desktop app.
#
# Linux needs -tags webkit2_41 on hosts that ship webkit2gtk-4.1 instead of
# 4.0. If yours has 4.0, run `make TAGS= linux`.
#
# Artifact names follow the git tag: tasks-1.0.0-linux-amd64, and so on.
# Override with `make VERSION=1.0.0 linux` when building an untagged tree.

WAILS        ?= $(shell command -v wails 2>/dev/null || echo $(HOME)/go/bin/wails)
TAGS         ?= webkit2_41
APP          ?= tasks
VERSION      ?= $(shell git describe --tags --always --dirty 2>/dev/null | sed 's/^v//')
PLATFORM_WIN ?= windows/amd64

.PHONY: all linux windows dev deps clean tidy

all: linux windows

# Only needed once, or after package.json changes.
deps:
	cd frontend && npm install

linux:
	$(WAILS) build -clean -tags "$(TAGS)" -o $(APP)-$(VERSION)-linux-$(shell go env GOARCH)

windows:
	$(WAILS) build -clean -tags "$(TAGS)" -o $(APP)-$(VERSION)-windows-amd64.exe -platform $(PLATFORM_WIN)

dev:
	$(WAILS) dev -tags "$(TAGS)"

clean:
	rm -rf build/bin

tidy:
	go mod tidy
