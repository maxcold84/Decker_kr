# Decker UI Design Baseline

This file records the current Decker application UI as a guardrail for the
Korean app-chrome work. It is not a redesign brief.

## Visual Identity

Decker's UI is a compact monochrome bitmap workspace. The visible identity is
made from pixel fonts, 1 px rules, patterned fills, simple boxed controls, and
small inverted selections. The app should continue to feel like the existing
canvas/native tool: direct, dense, and utilitarian rather than illustrative or
marketing-styled.

Deck content is the primary surface. App chrome should stay lightweight around
the deck: menu bar, modal boxes, toolbars, inspectors, prompts, and status text.
Korean app labels should inherit this bitmap attitude through DungGeunMo-derived
UI glyphs, not through a smoother system-font layer.

## Layout Rhythm

The current rhythm is pixel-exact and tight. Menu heads start at x=10, sit at
y=2, add about 5 px horizontal padding on each side, and advance with a 5 px
gap. Menu entries add 8 px leading room for checkmarks, about 2 px vertical
offset, and 4 px extra row height. Dialog content commonly uses 5 px insets,
15-20 px row steps, and small fixed label columns.

Keep geometry stable. Text changes may widen fixed Korean app chrome, but should
not introduce card-like panels, oversized spacing, rounded modern surfaces, or
viewport-scaled typography. When labels grow, prefer measured menu/dialog widths
and the existing fit/ellipsis behavior over changing the overall UI rhythm.

## Menus And Dialogs

Menus are immediate-mode UI. `menu_bar()` measures the label, records a text rect
and hit rect, handles click/drag stickiness, and `menu_finish()` draws the bar,
drop shadow, item labels, separators, check icons, shortcuts, and inverted hover
state. The canonical web anchors are `js/decker.js:555-592` for geometry/drawing
and `js/decker.js:3266-3573` for the app menu inventory. Native menu inventory
mirrors this shape in `c/decker.c:3772-4128`.

Dialogs use centered modal boxes with dense content. Modal message layout is
anchored by `c/decker.c:1260-1269`: rich messages use rich text layout, plain
messages use plaintext layout, both draw into `draw_modalbox()` output. Preserve
the modal silhouette: square pixel boxes, nested outlines, compact controls, and
centered headings where the existing UI centers headings.

## Palette And Depth

The current UI depth model is shallow: flat pattern fills, 1 px outlines, nested
modal borders, menu drop shadows, separator lines, and inverted hover/selection
rectangles. Disabled text uses a lighter pattern index rather than opacity.
Selected, active, or hovered controls invert the existing pixels instead of
adding new colors.

Do not add a new palette for Korean. DungGeunMo glyph pixels should draw through
the same pattern indices and inversion rules as existing menu/body text so web
and native chrome remain visually equivalent.

## Interaction States

States are visible through small pixel changes:

- Hovered menu heads and items invert their hit rect.
- Sticky/open menus keep the active head inverted.
- Disabled items still lay out, but draw with the disabled pattern.
- Checked menu items reserve the leading checkmark slot and draw the check icon.
- Separators are 1 px horizontal rules inside the menu width.
- Modal buttons and inline controls use existing boxed, radio, check, and invert
  styles rather than new visual components.

Korean labels must preserve hit rects, shortcut columns, check columns, disabled
states, and hover/invert behavior. Text rendering changes should not change
event handling.

## Typography And Font Constraints

Existing Decker UI text is measured and drawn with bitmap fonts such as
`FONT_MENU` and `FONT_BODY`. Web text helpers are anchored at
`js/decker.js:151-173`: centered/right/fit drawing uses `font_textsize()`,
`font_gw()`, `font_sw()`, and ellipsis insertion. Native byte-oriented sizing is
anchored at `c/dom.h:824-827`; native fit/center drawing is anchored at
`c/dom.h:1221-1243`.

Those paths assume DeckRoman-compatible single-byte glyph indexing. Deck and
script text, user field text, grid text, card/widget/resource names, filenames,
URLs, and runtime messages from user code must remain on the existing
DeckRoman/deck text paths and keep their current behavior.

## Korean CJK Rendering Constraints

Korean CJK app chrome is UI-only. Fixed Korean labels for menus, dialogs,
toolbar/status chrome, and app-owned prompts must bypass DeckRoman and
`drom_to_ord`; they must also avoid feeding Hangul directly into
`font_textsize`, `draw_text`, `draw_text_fit`, `draw_textc`, or native `font_g*`
byte-indexed paths unless first mapped through a separate UI-only Korean glyph
mechanism.

Use DungGeunMo as the Korean UI font source so Hangul remains pixel-shaped and
consistent with Decker's bitmap identity. Measure CJK labels with the generated
UI glyph metrics, verify no tofu or missing glyph cells, and watch compact menu
and dialog titles for clipping, baseline drift, and awkward one-syllable wrapping.

App chrome Korean UI must bypass DeckRoman/`drom_to_ord`; deck/user/script text
remains unchanged.

## Source Anchors And Guardrails

- `js/decker.js:151-173`: current web text outline, center/right, fit, ellipsis,
  and glyph loop behavior.
- `js/decker.js:555-592`: current web menu geometry, hit rects, separators,
  checks, shortcuts, shadows, and invert states.
- `js/decker.js:3266-3573`: current web menu inventory and mode gating.
- `c/dom.h:824-827`: native `font_textsize()` byte-oriented measurement.
- `c/dom.h:1221-1243`: native `draw_text_fit()` and `draw_textc()` behavior.
- `c/decker.c:1260-1269`: native modal rich/plain message box layout.
- `c/decker.c:3772-4128`: native menu inventory and mode gating.

Guardrails:

- Do not redesign the UI, palette, spacing system, or interaction model.
- Do not translate deck data, user-authored content, scripts, API names, internal
  tokens, file format values, or dynamic names.
- Do not change DeckRoman conversion, storage, font records, or renderer
  behavior for existing deck/user/script surfaces.
- Add any Korean glyph path as app-chrome-only infrastructure with explicit
  source anchors and parity between web canvas and native UI.
