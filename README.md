# [callmegreg.github.io](https://callmegreg.github.io/)

My personal site: projects, published work, and a playground of small games and
tools. Built with React and Vite.

## Card Studio

The playground's [Card Studio](https://callmegreg.github.io/card-studio) is a
local-first workshop for custom 2.5 × 3.5-inch trading cards and paper booster
wrappers. It includes classic, full-art, trainer, and energy layouts; adjustable
artwork crops; a multi-card collection; shared card backs; Letter/A4 print sheets;
and dimensioned pack templates.
Full-art cards are borderless, with artwork across the entire trim and outlined
text over transparent areas. Bleed extends the artwork edges without changing
the trimmed composition; other templates retain their selectable frames.

**Randomize cards**, just below **New card**, asks for confirmation before replacing
every card's element, HP, stage, ability name and text, moves (including names,
damage, energy costs, and descriptions), and flavor text with locally generated
options. It includes cards hidden by search and keeps names, uploaded artwork,
layouts, and all other settings. Results save automatically like other edits.
Download a project backup first if you want to keep the previous designs.

After Hours is the default page theme. Alternate visual previews remain available
at `/card-studio?theme=blueprint` and `/card-studio?theme=press` (Print Shop).
The explicit After Hours preview is `/card-studio?theme=neon`. Each supports the
existing light/dark toggle without changing page content, card artwork, project
files, or print output.

Projects save to this browser's `localStorage` under `cardStudio.project`.
**Download project** saves a portable JSON backup with embedded artwork, card
quantities, and print/pack settings. Import can replace a project or add its cards
to the current collection. Browser storage has a limited quota and is not a
backup: download projects before clearing site data or moving to another device.
Storage and import failures are shown in the app rather than silently discarding
work. Reset asks for confirmation before clearing only Card Studio's saved project.

Artwork stays on the device. PNG, JPEG, and WebP uploads are optimized to at most
2,200 pixels on the longest side and 2 MB per image; portable projects are limited
to 20 MB, 100 card designs, and 300 printed copies per job. Changes that would
exceed the project-file limit are rejected without losing the previous work.
Individual cards export as SVG or
300/600-DPI PNG, with optional 1/8-inch bleed. PNGs carry physical-resolution
metadata; SVG artwork and text remain vector where possible.

Print sheets at **100% / Actual size**, with browser headers/footers off and the
selected paper size and orientation. Do not use Fit to page. Duplex sheets are
imposed for the selected flip edge; test one sheet first and use the back-offset
controls to calibrate a printer. The Print and Pack tabs include alignment and
paper-pack assembly instructions. Browser printing also supports saving the
imposed sheets as a PDF. Pack templates never scale to fit:
their dimensions account for the card stack, clearance, glue tab, and end seals.

Starter illustrations and the studio back are original. Choose the studio back
or upload custom artwork; no official card images or logos are bundled. Older
back presets restore as custom artwork, preserving their images and framing.
Use artwork you own or have permission to reproduce, and label custom cards/packs
so they cannot be mistaken for official products.

Run locally with `npm ci` and `npm run dev`. `npm test` includes project
validation, SVG layout, physical print geometry, and export-metadata checks.
