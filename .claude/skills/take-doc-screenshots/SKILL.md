---
name: take-doc-screenshots
description: Take screenshots of the running pgconsole app for documentation. Use when updating docs with screenshots or adding images to .mdx files.
disable-model-invocation: false
argument-hint: [page-or-feature]
---

# Take Documentation Screenshots

Capture screenshots of the running pgconsole app at `http://localhost:5173` for use in documentation.

## Prerequisites

- The dev server must be running (`pnpm dev`)
- `shot-scraper` must be installed (`pipx install shot-scraper && shot-scraper install`)
- `cwebp` must be installed (`brew install webp`)

## Authentication

Login credentials are in `pgconsole.toml` under `[[users]]`. Use the first user entry.

1. Read `pgconsole.toml` to find the email and password from the first `[[users]]` entry
2. Call the login API to get a session token:
   ```
   curl -s -c cookies.txt -X POST http://localhost:5173/api/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"<email>","password":"<password>"}'
   ```
3. Extract the `pgconsole_token` cookie value from cookies.txt
4. Create a Playwright auth state JSON file:
   ```json
   {
     "cookies": [{
       "name": "pgconsole_token",
       "value": "<token>",
       "domain": "localhost",
       "path": "/",
       "httpOnly": true,
       "secure": false,
       "sameSite": "Lax"
     }],
     "origins": []
   }
   ```

## Taking Screenshots

Write a Playwright script (`.mjs` file in the scratchpad directory) that:

1. Launches Chromium with `viewport: { width: 1440, height: 900 }` (no `deviceScaleFactor` — use 1x)
2. Sets the auth cookie via `context.addCookies()`
3. Navigates to `http://localhost:5173`
4. Uses Playwright actions (click, type, keyboard) to navigate to the desired state
5. Saves screenshots as PNG

### CodeMirror Interaction

The SQL editor uses CodeMirror 6. To type into it:
- Click `.cm-content` to focus
- Use `page.keyboard.type('SQL here', { delay: 5 })` to type
- Use `page.keyboard.press('Control+Space')` for autocomplete
- Use `page.keyboard.press('Meta+a')` to select all before replacing content
- Do NOT try to access `cmView` from the DOM — it's not exposed

### UI Navigation

Key buttons to interact with:
- `button` with text `SQL` — opens a new query tab
- `button` with text `Run` — executes the query
- `button` with text `Format` — opens format dropdown
- `button` with text `Quick SQL` — opens quick SQL dropdown
- `button` with text `Processes` — opens processes modal
- Right-click on `.cm-content` for context menu

### Dismissing Overlays

After capturing dropdown/modal screenshots, always dismiss with:
```js
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
```
An open overlay blocks clicks on other elements.

## Image Processing

1. Convert PNGs to WebP: `cwebp -q 90 input.png -o output.webp`
2. Store in `docs/images/features/<feature-name>/` (matching `docs/features/<feature-name>.mdx`)
3. Reference in MDX as `![Alt text](/images/features/<feature-name>/<image>.webp)`
4. Clean up temporary PNG files after conversion

## Image Convention

- Format: WebP (`.webp`), quality 90
- Dimensions: 1440x900 (1x resolution)
- Location: `docs/images/` mirroring the `docs/` structure
- Naming: `<feature>-<description>.webp` (e.g., `sql-editor-autocomplete.webp`)
- Alt text: brief description of what the screenshot shows
