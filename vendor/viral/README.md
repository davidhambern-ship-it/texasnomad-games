# VIRAL human-test source

This directory stores the exact ZIP for the VIRAL human-test build (Texas Nomad Games edition with online rooms).

- Source ZIP SHA-256: 448e9cd5a1cbcbdb993cea228572d43d878b5c937abc4e81d0a58871e207c295
- Extracted viral/index.html SHA-256: b863db6af0162f939a0c415d6ceb925f9de602f0219a31e6d1f4adc77db2ca02
- Extracted HTML size: 707298 bytes

Do not edit the generated public/viral/index.html by hand. scripts/restore-viral.mjs extracts the exact tested HTML during every production build and fails the build if either checksum changes.

Online rooms: the game connects to the WebSocket relay in server/viralLive.mjs (served by server.mjs at /viral-live on the Railway service, health check at /viral-live/health). The host's browser runs the game; the relay only passes messages between devices in the same room. The game engine itself is unchanged from the tested build.
