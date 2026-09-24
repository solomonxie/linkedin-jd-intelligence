# UI/UX mockups — LinkedIn JD Intelligence

Three surfaces: a side panel, an options page (Settings + History), and a
print page. Drawn as built today. `../DESIGN.md` carries the architecture,
prompts and algorithms.

Glyphs follow the `uiux` skill (`references/notation.md` + `text-figma.md`):
`[[ x ]]` primary · `[ x ]` secondary · `▾` collapsible / select · `›`
opens · `⟳` working · `←` annotation · `·` disabled · `ⓘ` hover explainer.

## Surface map

```
 Any HTTP(S) page ─▶ extension icon ─▶ side panel
   │ current visible page text is read; user starts analysis explicitly
   │  header: title · classified-as · company · location
   │  Resume ▾            [[ Analyze ]] / [[ Re-analyze ]]
   │  ▾ Company & Role Brief        (editable in place)
   │  ▾ Day-to-day work
   │  ▾ Skill / Experience Match    (requirement tree)
   │  ▾ Interview Process           (editable, reorderable)
   │  footer: Settings · History · Export as PDF · Export entire DB ·
   │          Block this job · Block this company
   ├─▶ options page ?tab=settings     → settings.md
   ├─▶ options page ?tab=history      → history.md
   └─▶ sidepanel/index.html?printJobId=… (a normal tab, so printing works)
```

## Files

| File | Covers |
|---|---|
| `panel.md` | the side panel: every state, every section |
| `settings.md` | options page — keys, model, resumes, block lists |
| `history.md` | history table and the print page |
