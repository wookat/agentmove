# GAP-ROUND-88: plugin archive export (--plugin -o <file>.zip)

## Signal

- ROUND-87 added archive *import* (release assets, Download ZIP links) on the
  observation that Agent Plugins 1.0.0 leaves distribution to clients and
  archives are the dominant artifact.
- The publishing side of that loop was still manual: `export --plugin` wrote a
  directory the user had to zip themselves before attaching it to a release.

## Decision

- When `--plugin` is set and `-o` ends in `.zip` / `.tgz` / `.tar.gz`
  (`isArchiveInput`), the plugin is staged in a temp directory named after the
  filename minus the suffix (that name becomes the plugin name / top-level
  archive entry) and packaged with the new `createArchive()`.
- `createArchive()` mirrors `extractArchive()`'s zero-dependency approach:
  `tar -czf` for tarballs; for zip, `zip -r` first then `tar -a -cf` fallback
  (bsdtar on Windows 10+ and macOS creates zip natively).
- Contents are byte-identical to the directory form and round-trip through the
  ROUND-87 archive import. Failure → exit 3 `archive creation failed`.

## Deferred

- Checksums/signing of the produced archive — release-tooling concern.
- Archive output for plain bundles (`export -o bundle.zip` without
  `--plugin`) — `pack` already covers encrypted transport; add on demand.
