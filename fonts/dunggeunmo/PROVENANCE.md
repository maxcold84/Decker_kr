# DungGeunMo Provenance

Vendored files:

- `DungGeunMo.ttf`
- `DungGeunMo.woff2`
- `DungGeunMo.woff`

Source page:

- https://cactus.tistory.com/193

Local source artifacts copied from the already-inspected extraction under
`C:/tmp/decker-font-check`:

- `C:/tmp/decker-font-check/extracted/ttf/DungGeunMo.ttf`
- `C:/tmp/decker-font-check/extracted/web/DungGeunMo.woff2`
- `C:/tmp/decker-font-check/extracted/web/DungGeunMo.woff`

Inspected metadata:

- License metadata: Public Domain
- Version metadata: 1.301
- OS/2 `fsType`: `00000000 00000000` (zero; no embedding restriction bits set)
- Glyph count: 17,651 glyphs
- Outline format: TrueType outlines, with `glyf`/`loca` outline tables present
- Bitmap tables: no `CBDT`, `CBLC`, `EBDT`, `EBLC`, or `sbix` bitmap tables were found
- Sample Hangul coverage:
  - `U+AC00` / `uniAC00` / HANGUL SYLLABLE GA
  - `U+AC01` / `uniAC01` / HANGUL SYLLABLE GAG
  - `U+D7A3` / `uniD7A3` / HANGUL SYLLABLE HIH

Build dependency note:

The user-provided Kakao CDN URLs include `expires=1782831599`, which resolves
to `2026-06-30 14:59:59 UTC`. Those signed, expiring
`blog.kakaocdn.net` URLs are not used as build dependencies. Builds must use
the vendored local files above.
