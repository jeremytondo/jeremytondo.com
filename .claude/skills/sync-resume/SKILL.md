---
name: sync-resume
description: Replace resume.md with the current "Resume (Markdown)" tab of the Resume doc artifact on claude.ai. Use when the user asks to sync, pull, or update the resume from the artifact/doc.
---

# Sync resume.md from the Resume doc

The source of truth for `resume.md` is the **"Resume (Markdown)"** tab of the user's Resume doc
(a Claude Docs artifact). The site (`src/`) renders `resume.md` into `/resume/` and the PDF.

| Thing | Value |
| --- | --- |
| Doc link | https://claude.ai/artifact/TzsK91KfZwhHzsDzrUWkqr |
| Doc id (container) | `daa201a1-53ee-4d10-970c-52f4de2d9935` |
| "Resume (Markdown)" tab (file id) | `4a213ebd-d48d` |
| That tab's body (prose node id) | `9c458942-dc5a` |

If any id stops working, re-read the doc
(`read( ref = {"object":"project","id":"TzsK91KfZwhHzsDzrUWkqr"} )`) and find the tab by name.
Don't use the other tabs ("Resume Content", "Career Story"). Those are drafting material.

## Steps

1. **Load the docs tools.** Use ToolSearch for `select:mcp__claude_ai_Claude_Docs__export,mcp__claude_ai_Claude_Docs__read`
   (plus the `anthropic-skills:docs` skill if the connector asks for it).
2. **Export the tab as markdown:**
   `export( container = {"kind":"project","id":"daa201a1-53ee-4d10-970c-52f4de2d9935"}, file = "4a213ebd-d48d", format = "markdown" )`.
   The text comes back base64-encoded in `data.bytes_b64`.
3. **Write it to `resume.md`.** Decode it with a quoted heredoc so nothing gets mangled:
   ```sh
   base64 -d > resume.md <<'EOF'
   <bytes_b64>
   EOF
   ```
4. **Clean up export quirks.** The markdown export is lossy. Check for and fix these:
   - **Escaped brackets on the contact line:** `&#91;Chicago, IL\] | \[email\] | ...` → use plain `[` and `]`.
   - **Broken emphasis:** stray `**` with no partner, or a space before a closing `*` (e.g. `*text. *`).
     These show up as literal asterisks on the page. When unsure what was meant, search the tab
     (`read( ref = {"object":"node","id":"9c458942-dc5a"}, engine = "prose", container = {…}, payload = {"kind":"search","text":"<words>"} )`)
     and copy its `<italic>`/`<bold>` marks exactly.
   - Other backslash escapes (`\-`, `\*`, `\_`) that aren't in the doc's text.
   Fix only these export problems. Wording changes go in the doc, not here.

   **Better: fix the cause in the doc.** These quirks usually come from messy formatting in the doc,
   such as a trailing space inside italics or emphasis split across fragments. Rewrite the
   affected paragraph in the doc as clean markdown: a whole-block `replace` with `ifHash`/`ifRev` from a
   search read, `"as":"markdown"`. Then export again. When the raw export needs no hand fixes, `resume.md`
   and the doc stay in sync with no manual edits.
5. **Build and check:** `npx astro build` (this skips the PDF step; run `npm run build` if the PDF
   should be regenerated too). Then search `dist/resume/index.html` for literal `*`, `\`, or `&amp;#`
   left in the rendered text.
6. **Show the diff** with `jj diff --git resume.md`. Don't commit unless the user asks. This is a jj repo,
   so use `jj`, not state-changing git commands.
7. **Report back:** summarize what changed in the content, which export quirks you fixed, and anything
   in the doc itself that looks off (typos, double spaces, leftover placeholders) for the user to decide on.
   If the user asks for a fix like that, make it in **both** `resume.md` and the doc tab, so the next sync
   doesn't undo it.
