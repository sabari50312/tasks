# Build tasks for the Tasks desktop app.
#
# Linux needs -tags webkit2_41 on hosts that ship webkit2gtk-4.1 instead of
# 4.0. If yours has 4.0, run `make TAGS= linux`.
#
# Artifact names are the nearest git tag: tasks-1.0.0-linux-amd64, and so on.
# Override with `make VERSION=1.0.0 linux` when building an untagged tree.

WAILS        ?= $(shell command -v wails 2>/dev/null || echo $(HOME)/go/bin/wails)
TAGS         ?= webkit2_41
APP          ?= tasks
VERSION      ?= $(or $(shell git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//'),dev)
PLATFORM_WIN ?= windows/amd64

.PHONY: all linux windows dev deps tidy

all: linux windows

# Only needed once, or after package.json changes.
deps:
	cd frontend && npm install

linux:
	$(WAILS) build -tags "$(TAGS)" -o $(APP)-$(VERSION)-linux-$(shell go env GOARCH)

windows:
	$(WAILS) build -tags "$(TAGS)" -o $(APP)-$(VERSION)-windows-amd64.exe -platform $(PLATFORM_WIN)

dev:
	$(WAILS) dev -tags "$(TAGS)"

tidy:
	go mod tidy
