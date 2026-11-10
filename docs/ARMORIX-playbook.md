# ARMORIX visual identity and frontend playbook

**Version 0.2 · Implementation draft · Site and VK**

Use **ARMORIX** as the working name for design and staging. Confirm the final name with Egor before public release. The supplied kit defines the shield silhouette, industrial wordmark, five core colors, Montserrat, and the visual direction. This playbook adds a flat vector redraw, Forest, typography options, and proposed UI rules. Implement the recommended baseline unless Egor selects a different direction. Keep public-facing copy in Russian.

## Product and audience

ARMORIX makes front and rear bumper protection for SUVs and pickups, with a focus on Chinese vehicles. The brief specifies mirror-polished AISI 304 stainless steel and black metal with powder coating as materials in the product range. Attribute a finish to a particular model or kit only when its product data confirms it.

- Ready kits exist for **JAC T9** and **Haval H3**. The brief specifies installation without drilling or body modifications, standalone kit purchase or turnkey installation, and delivery across Russia. Confirm per-kit compatibility and availability before publishing model-specific claims.
- For other vehicles, invite an individual request and explain that feasibility is assessed case by case.
- The primary audience is SUV and pickup owners, mainly men aged 30–60. Lead with compatibility, materials, installation and real photos. Use outdoor imagery as context for the product.
- The site is an informational showcase that leads to a conversation. Contact and product inquiry are the conversion paths. Shopping cart and online checkout are outside this release.

## Logo files

The SVGs are hand-redrawn from the supplied raster board. The paths preserve the shield, the asymmetrical left opening, the central counter, and the geometry of the wordmark. The original bevel, perspective and highlights belong to the 3D art direction. Each SVG contains vector paths and can be used as an ordinary image without a font dependency. `light` uses Steel on dark surfaces, `dark` uses Obsidian on light surfaces. See the [visual preview](ARMORIX-preview.html) for all variants.

| Variant | Files | Use | Minimum rendered width |
| --- | --- | --- | --- |
| Horizontal | [Light](logos/armorix-horizontal-light.svg) · [Dark](logos/armorix-horizontal-dark.svg) | Site header, footer and horizontal signatures | 120 px. Use 148–168 px in the header when space allows. |
| Stacked | [Light](logos/armorix-stacked-light.svg) · [Dark](logos/armorix-stacked-dark.svg) | Centered covers, large title graphics and presentation slides | 88 px |
| Shield | [Light](logos/armorix-mark-light.svg) · [Dark](logos/armorix-mark-dark.svg) | Compact header, VK avatar and branded detail | 24 px |
| Wordmark | [Light](logos/armorix-wordmark-light.svg) · [Dark](logos/armorix-wordmark-dark.svg) | Standalone brand name for wide, shallow spaces | 96 px |
| Favicon | [SVG](logos/armorix-favicon.svg) | Browser tab. Solid Obsidian tile with a Sand mark and a slightly widened opening. | 16 px |

- Keep external clear space around each SVG of at least one eighth of its displayed height. Maintain aspect ratio. On photos, place the logo over a solid backing or a quiet area with reliable contrast.
- Keep the shield and wordmark proportions as exported. Use the supplied SVG wordmark in every lockup. The typefaces below are for copy and interface text.
- The source line **ENGINEERED TO PROTECT** is optional campaign copy. Place it separately below the lockup in larger formats. Use the uncaptioned SVG for navigation and small applications.
- For a home link, use the accessible name `ARMORIX — на главную`. If the link already has this label, use `alt=""` on its logo image. If the name changes, update the name-bearing SVG paths, titles, alt text, and page metadata together. Revisit the shield with Egor if the new name changes its interpretation.

## Color and UI tokens

| Brand color | Hex | Role |
| --- | --- | --- |
| Obsidian | `#0B0B0D` | Main background and dark logo |
| Graphite | `#4A4F56` | Decorative rules, patterns and dividers |
| Steel | `#A9AEB4` | Secondary text, informative icons and light logo |
| Bronze | `#7A6A4A` | Secondary decorative accent in photography, diagrams or print |
| Sand | `#D6D2C8` | Main text, primary action label and focus outline on dark surfaces |
| Forest | `#244638` | New dark-green accent for primary actions and an occasional feature panel |

Map these names onto the site's existing token conventions. Keep brand values and UI state values centralized.

```css
:root {
  color-scheme: dark;
  --color-bg: #0B0B0D;
  --color-surface: #15171A;
  --color-decoration: #4A4F56;
  --color-text: #D6D2C8;
  --color-text-muted: #A9AEB4;
  --color-bronze: #7A6A4A;
  --color-accent: #244638;
  --color-accent-hover: #2E5544;
  --color-accent-pressed: #1C352B;
  --color-control-border: #696F76;
  --color-action-border: #A9AEB4;
  --color-focus: #D6D2C8;
  --color-error: #F2A69D;
  --font-heading: Montserrat, Arial, sans-serif;
  --font-body: "Golos Text", Arial, sans-serif;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --space-9: 96px;
  --radius-control: 4px;
  --radius-panel: 6px;
  --duration-ui: 160ms;
}
```

Use a Steel outline on Forest buttons because the green fill has a 1.88:1 contrast ratio against Obsidian. Sand as a button label achieves 6.93:1 on Forest, 5.57:1 on hover and 8.73:1 on press. Keep Bronze and Graphite decorative on Obsidian. Use a visible 2 px focus outline with 3 px offset, Sand on dark surfaces and Obsidian on light ones. Field borders use `--color-control-border` or a stronger color. Check final foreground/background pairs, including text over photos and control states. Target at least 4.5:1 for normal text, 3:1 for large text and 3:1 for visual cues needed to identify controls and their states. [Text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [Control contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)

## Typography

| Direction | Headings | Body and UI | Application |
| --- | --- | --- | --- |
| **Recommended** | Montserrat 700, 600 for small headings | Golos Text 400 and 600 | Keeps the kit's geometric voice and gives longer Russian copy a calmer text face. |
| Industrial | Oswald 600 | Golos Text 400 and 600 | Taller, narrower headlines. Use for a more industrial look and check line breaks in Russian. |
| Technical | Unbounded 600 for short display headings | Manrope 400 and 600, including subheads | Wider, more distinctive headlines. Use the display face sparingly on narrow screens. |

Load one heading/body pair, with Latin and Cyrillic subsets, `font-display: swap`, and local WOFF2 where the project supports it. Keep model names in Latin script. Preview `Ёё Йй Щщ Ъъ`, `JAC T9`, `Haval H3` and `AISI 304` in the chosen fonts. Keep headings in sentence case. Reserve spaced uppercase for short labels, and keep letter spacing near zero in body text.

| Role | Small screens | Large screens | Weight |
| --- | --- | --- | --- |
| H1 | 36 px / 1.08 | 64 px / 1.02 | 700 |
| H2 | 28 px / 1.12 | 44 px / 1.10 | 700 |
| H3 | 20 px / 1.25 | 24 px / 1.20 | 600 |
| Body | 16 px / 1.55 | 17 px / 1.55 | 400 |
| Control label | 16 px / 1.25 | 16 px / 1.25 | 600 |
| Caption and eyebrow | 14 px / 1.4 | 14 px / 1.4 | 400–600 |

These sizes are the Montserrat baseline. Use `rem` for type and let the H1 and H2 scale between endpoints. Start with 32–48 px for Unbounded H1 and verify wrapping. The visual preview uses the actual Latin and Cyrillic webfont files for all three options. [Montserrat](https://fonts.google.com/specimen/Montserrat) · [Golos Text](https://fonts.google.com/specimen/Golos+Text) · [Oswald](https://fonts.google.com/specimen/Oswald) · [Unbounded](https://fonts.google.com/specimen/Unbounded) · [Manrope](https://fonts.google.com/specimen/Manrope)

## Art direction

Show the installed part first. Prefer a three-quarter view that identifies the car and protection, a close-up of the material or mounting point, and a plain technical view when available. Keep steel highlights controlled and the mounting hardware visible. Use forest, rock, or gravel as occasional context for the product. The pickup photo and packaging in the kit are visual references. Use actual model photos for catalog claims, and label interim images `Иллюстрация` or `Фото комплекта готовится` as appropriate.

Use the shield, slanted bars or thin contour lines as one recurring framing device per composition. Keep quiet space around product data and use flat surfaces in controls. Use text labels alongside icons for compatibility, finishes, mounting or delivery.

### Steel assets

The [visual preview](ARMORIX-preview.html#steel) shows a brushed-steel hero and all three downloadable graphics. The graphics are original vector treatments of the reference board. Their highlights are material colors, separate from the interface palette.

| Asset | Use on the site |
| --- | --- |
| [Layered plates](steel/armorix-steel-plate.svg) | Crop to the right side of a desktop hero or use in a full-width feature. Add an Obsidian gradient behind copy. On mobile, start the artwork below the main copy and let the top edge fade in. |
| [Brushed steel shield](steel/armorix-steel-shield.svg) | Large hero or section artwork on a dark surface. Start around 160 px wide on mobile and 280 px on desktop. The shield uses the same vector outline as the flat mark. Use the flat asset for navigation and small sizes. |
| [Steel slashes](steel/armorix-steel-slashes.svg) | Use as a divider or a corner detail on a large card. Start at 72–120 px wide and keep it clear of labels and controls. |

Keep the light direction consistent and use one steel composition per viewport. For the launch site, use real product photography wherever the visitor is evaluating a specific kit. Use the illustrated steel plates as background art and mark decorative images with empty alt text. Keep bevel, grain and fasteners static. If a large filtered SVG delays the first render on target devices, export the plate as a compressed WebP at the site's actual breakpoints.

## Website composition

Suggested architecture for a first pass. Keep the same hierarchy if sections become separate pages later.

| Order | Section | Content and action |
| --- | --- | --- |
| 1 | Header and hero | Horizontal logo, compact navigation, one contact action. Suggested H1 `Защита бамперов для внедорожников и пикапов`. Primary `Смотреть комплекты` scrolls to the catalog, secondary `Обсудить свою модель` reaches the inquiry section. |
| 2 | Ready kits | Two model cards named `JAC T9` and `Haval H3`. Show model, kit content, finish and mounting only where verified. Action `Уточнить комплектацию` opens the contact flow with the model carried through. |
| 3 | Benefits and company | Explain materials, mounting approach, turnkey installation and delivery across Russia. Add workshop, installed product and material details when the photos are available. |
| 4 | Individual fabrication | Explain what the customer should provide and that the team reviews feasibility. Suggested action `Обсудить свою модель`. |
| 5 | Contacts | Show confirmed contact channels and an optional inquiry form. Publish addresses, phone, VK links and lead times only after Egor provides them. |

- Use a content container up to 1200 px. Side gutters are 16 px below 768 px, 24 px from 768 px and 32 px from 1024 px. Section spacing moves from 48 px to 64 px to 96 px at the same breakpoints.
- Below 768 px, stack hero copy above the image and use one catalog column. From 768 px, use two product columns if both remain readable. From 1024 px, use a split hero when verified imagery supports it. Product card photos use a consistent 4:3 frame. Keep the protection in the crop.
- Give controls at least a 44 × 44 px target. Let long Russian labels wrap. Check 320, 390, 768, 1024 and 1440 px widths. Check 200% zoom, keyboard navigation and reduced motion. Prevent layout shift with image dimensions or reserved aspect ratios.
- For the extract team workflow, include the shared metadata, branded preloader and scrollbar rules from the team's frontend instructions. Keep preloading tied to real work and respect reduced motion.

## Components and states

| Component | Implementation rule |
| --- | --- |
| Primary action | Forest fill, Sand label, Steel border. Hover and pressed use the accent state tokens. Keep the keyboard focus outline distinct from the border. |
| Secondary action | Transparent surface, Steel border, Sand text. Use a light surface change on hover and an underline for text links. Use an anchor for navigation and a button for an action. |
| Product card | Show the model name as a heading, then photo, verified details and a clearly labeled action. Use a labeled placeholder if a photo is missing. Preserve the user's model choice in an inquiry. |
| Inquiry | Keep a visible label for each field. If a form is used, start with vehicle model, contact and an optional note. Collect only fields supported by the actual contact workflow. Show inline errors, preserve input on failure, and announce success only after delivery is confirmed. |
| Loading, disabled and empty | Disable submit only while submission is pending or an action is genuinely unavailable. Show `Отправляем…` during submission and announce the result. When details are unavailable, use `Уточнить комплектацию` with a working contact route. |
| Navigation | The mobile menu button has an accessible name and expanded state. Keep focus visible. If the menu opens as a modal, close on Escape and return focus to the trigger. |
| Motion | Use brief state transitions around 160 ms and avoid motion as the sole state cue. Remove nonessential movement when `prefers-reduced-motion` is enabled. |

## VK applications

- **Avatar.** Center the shield on an Obsidian tile. Use roughly 52% of the square width for the mark and check the actual circular crop. Use the shield SVG as the production source and export a raster avatar at the platform's required size.
- **Cover.** Keep the logo and essential message in a central safe area, with a side crop of a real car or material detail. Validate both desktop and mobile crops in VK before publishing.
- **Post templates.** Build three templates for a model kit, a material or mounting detail, and individual work. Use the model name, one visible detail and a single action. Keep Bronze in decorative accents. Use Forest to signal the action, with Sand copy.

## Handoff checks

- [ ] Choose one type pair and verify Russian copy, Latin model names and numerals at mobile and desktop sizes.
- [ ] Use the right SVG for each background. Review the 16 px favicon, 24 px shield and 120 px horizontal mark at actual size.
- [ ] Verify both named models, the individual inquiry route and model carry-through into contact. Check mobile menu, keyboard focus and form outcomes where present.
- [ ] Replace illustrative product images with verified photography when available. Obtain approved contact details and confirmed model and finish data before launch.
- [ ] Confirm the public name, the final wordmark and the exact public copy. Update all name-dependent assets and metadata together.

**Project sources.** The supplied ARMORIX identity board and the project brief `Задание 10.11.docx`. The board establishes appearance. The brief establishes product facts, audience and site scope.
