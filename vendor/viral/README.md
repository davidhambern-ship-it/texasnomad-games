# VIRAL human-test source

This directory stores the exact ZIP supplied for the VIRAL human-test build.

- Source ZIP SHA-256: 05b5fd5f5f3465446b1add020d42e8275e4b2239287457b3fbc46d44e6cf87ac
- Extracted viral/index.html SHA-256: 6c3fada443222bf6b8927236df9bace2075a018c3144a66f446e5468d1a6120b
- Extracted HTML size: 701748 bytes

Do not edit the generated public/viral/index.html by hand. scripts/restore-viral.mjs extracts the exact tested HTML during every production build and fails the build if either checksum changes.

The first TNG human-test integration intentionally does not rewrite VIRAL in React or replace its internal game engine.
