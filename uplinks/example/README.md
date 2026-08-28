# Example Uplink

The smallest Uplink that is still a real one: one channel, one widget, no
third-party mod. Copy this directory, rename it, and replace the payload.

- `uplink.json` is what CI reads: id, author, and which mod (if any) this wraps
- `client/` is the web half, an npm package that may use `@ksp-gonogo/sitrep-sdk` and `@ksp-gonogo/ui-kit`
- `mod/` is the KSP plugin

To release, `node tooling/release-uplink.mjs example` bundles the client, hashes
it, bakes the hash into the plugin, and packages both halves.
