# Blankbook

Turn PDFs from the official [SAT Suite Question Bank](https://satsuiteeducatorquestionbank.collegeboard.org/digital/search) into a practice test that looks and works like **Bluebook**, the digital SAT testing app.

No account, no name, no server: PDFs are parsed in your browser and never leave your device.

## How to use it

1. In the question bank, pick your questions and click **Export → "With correct answers and explanations" → Export PDF**.
2. Open Blankbook and drop the PDF in (you can add several; they're merged by question ID).
3. Choose your settings, then **Start practice**:
   - **Timing**: real SAT pace (32 min / 27 Reading and Writing, 35 min / 22 Math, scaled to your set), a total time, a time per question (optionally auto-advancing), or untimed.
   - **Show correct answers**: after every question (a *Check* button reveals the answer and explanation) or all together at the end.
   - Shuffle, split into Bluebook-sized modules, and an optional 10-minute break between sections.

## Bluebook tools included

- Section/module header, **Directions**, countdown **timer** you can hide until the 5-minute warning
- **Highlights & Notes** (Reading and Writing): highlight in 3 colors, underline, attach notes
- **Mark for Review** and the **option eliminator** (ABC cross-out with Undo)
- **Question menu** with Current / Unanswered / For Review legend, and the **Check Your Work** page
- **Desmos calculator** (the same College Board build Bluebook embeds, graphing + scientific) and the **reference sheet**, both draggable
- **Line reader**, split-pane passage layout with a draggable divider, grid-in answer preview
- Results with accuracy by skill and difficulty, per-question time, explanations, and "retry missed"

## How the parser works

College Board exports draw math as vector paths, not text, so a text-only parser would see "The measure of angle ___ is ___". Blankbook uses pdf.js to find the text anchors (`Question ID`, `Question`, `Answer`, `A.`–`D.`, `Correct Answer`, `Rationale`) and renders each page. Ink that isn't covered by a text glyph is math or a figure:

- ink inside a text line becomes an **inline image** set into real, reflowing text (so passages stay highlightable and math reads at body size);
- ink between lines (charts, tables, display equations) becomes a **figure** together with its labels.

## Development

```bash
npm install
npm run dev
```

Built with Vite, React, TypeScript, Tailwind CSS v4, and shadcn/ui.

## Deploying (free)

- **GitHub Pages**: push to `main`, then in *Settings → Pages* set *Source* to **GitHub Actions**. The included workflow builds and deploys automatically.
- **Vercel / Netlify / Cloudflare Pages**: import the repo; build command `npm run build`, output directory `dist`.

The build uses relative asset paths, so it works at any URL path.

---

Not affiliated with College Board. SAT and Bluebook are trademarks of College Board. Question content stays on your device and is never redistributed by this app.
