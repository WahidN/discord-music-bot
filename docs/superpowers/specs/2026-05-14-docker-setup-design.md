# Docker Setup Design

**Date:** 2026-05-14  
**Target platform:** Raspberry Pi (ARM)

## Overview

Add a multi-stage Dockerfile and docker-compose.yml to containerize the Discord music bot for deployment on a Raspberry Pi. The container handles its own build process — no need to install Node or pnpm on the Pi.

## Dockerfile

Two-stage build using `node:20-alpine` (ARM-compatible via Docker's multi-platform manifest).

**Stage 1 — builder:**
- Copy `package.json` and `pnpm-lock.yaml`
- Install pnpm and all dependencies (including dev)
- Copy `index.ts` and `tsconfig.json`
- Run `tsc` to compile TypeScript to `dist/`

**Stage 2 — runner:**
- Fresh `node:20-alpine` base
- Copy `dist/` from builder stage
- Copy `package.json` and `pnpm-lock.yaml`, install production deps only (`--prod`)
- Entrypoint: `node dist/index.js`

Result: a slim image (~150MB) containing only the compiled output and production dependencies.

## docker-compose.yml

Single service `bot`:
- Built from the local `Dockerfile`
- `restart: unless-stopped` — auto-restarts on crash or reboot, stops only on explicit `docker compose down`
- `env_file: .env` — reads `BOT_TOKEN` and `MUSIC_CHANNEL_ID` from a `.env` file in the same directory on the Pi
- No ports exposed (bot is outbound-only: Discord API + Reddit API)

## Deployment Flow

1. On the Pi: `git clone` (or `git pull`) the repo
2. Create a `.env` file with `BOT_TOKEN` and `MUSIC_CHANNEL_ID`
3. Run `docker compose up -d --build` to build and start
4. Bot runs in the background, restarts automatically

## Files to Create

- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore` — exclude `node_modules/`, `dist/`, `.env`, `.git/`
