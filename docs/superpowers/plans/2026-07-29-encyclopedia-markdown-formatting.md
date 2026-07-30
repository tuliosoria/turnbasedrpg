# Encyclopedia Markdown Formatting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the public Valdren encyclopedia body as safe, readable Markdown instead of showing raw `**`, `-`, `>`, and heading markers.

**Architecture:** Add a focused frontend Markdown renderer component and wire `WikiPage` to use it. Keep Wiki storage unchanged: backend and DynamoDB continue returning `body` as Markdown text, while the frontend renders that text safely with Material UI styling.

**Tech Stack:** React 18, TypeScript, Material UI, Vitest, Testing Library, `react-markdown`.

---

## File Structure

- Create `frontend/src/components/WikiMarkdown.tsx`
  - Single responsibility: render a Wiki entry body from Markdown into safe, styled React elements.
  - Exports `WikiMarkdown`.
  - Does not render entry images; those remain in `WikiPage`.
- Create `frontend/src/components/WikiMarkdown.test.tsx`
  - Unit tests for Markdown rendering and unsafe link/HTML behavior.
- Modify `frontend/src/pages/WikiPage.tsx`
  - Replace raw `Typography` body rendering with `WikiMarkdown`.
- Modify `frontend/src/pages/WikiPage.test.tsx`
  - Integration test proving Wiki entries render Markdown formatting on the public page and keep images.
- Modify `frontend/package.json` and `package-lock.json`
  - Add `react-markdown`.

No backend files should change for this feature.

---

### Task 1: Add Markdown Renderer Component

**Files:**
- Create: `frontend/src/components/WikiMarkdown.tsx`
- Create: `frontend/src/components/WikiMarkdown.test.tsx`
- Modify: `frontend/package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Add the Markdown dependency**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm install react-markdown --workspace frontend
```

Expected:

- `frontend/package.json` includes `react-markdown`.
- `package-lock.json` is updated.
- No source code is changed by this command.

- [ ] **Step 2: Write the failing renderer test**

Create `frontend/src/components/WikiMarkdown.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WikiMarkdown } from "./WikiMarkdown";

describe("WikiMarkdown", () => {
  it("renders emphasis, headings, blockquotes and lists without raw markdown markers", () => {
    render(
      <WikiMarkdown
        body={`> **Lema:** O céu observa.

### Cultura

O **valdreno comum** preserva *juramentos* antigos.

- Vale da Coroa
- Campos Dourados`}
      />,
    );

    expect(screen.getByText("Lema:").tagName.toLowerCase()).toBe("strong");
    expect(screen.getByRole("heading", { name: "Cultura", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("valdreno comum").tagName.toLowerCase()).toBe("strong");
    expect(screen.getByText("juramentos").tagName.toLowerCase()).toBe("em");
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Vale da Coroa",
      "Campos Dourados",
    ]);
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^- /)).not.toBeInTheDocument();
  });

  it("renders safe links and disables unsafe links", () => {
    render(
      <WikiMarkdown
        body={`[Porto seguro](https://example.com/porto) e [armadilha](javascript:alert(1)).`}
      />,
    );

    expect(screen.getByRole("link", { name: "Porto seguro" })).toHaveAttribute(
      "href",
      "https://example.com/porto",
    );
    expect(screen.getByText("armadilha").closest("a")).toBeNull();
  });

  it("does not render embedded HTML as executable HTML", () => {
    const { container } = render(<WikiMarkdown body={`Texto <script>alert("x")</script>`} />);

    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText(/<script>alert/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the renderer test to verify RED**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run test --workspace frontend -- src/components/WikiMarkdown.test.tsx
```

Expected:

- FAIL because `frontend/src/components/WikiMarkdown.tsx` does not exist.

- [ ] **Step 4: Implement the minimal renderer**

Create `frontend/src/components/WikiMarkdown.tsx`:

```tsx
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import ReactMarkdown, { type Components } from "react-markdown";

function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("#") || trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
    return true;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

const components: Components = {
  p: ({ children }) => (
    <Typography component="p" variant="body1" sx={{ mb: 1.5, lineHeight: 1.75 }}>
      {children}
    </Typography>
  ),
  h1: ({ children }) => (
    <Typography component="h3" variant="h3" sx={{ mt: 2.5, mb: 1, fontSize: "1.15rem" }}>
      {children}
    </Typography>
  ),
  h2: ({ children }) => (
    <Typography component="h3" variant="h3" sx={{ mt: 2.5, mb: 1, fontSize: "1.15rem" }}>
      {children}
    </Typography>
  ),
  h3: ({ children }) => (
    <Typography component="h3" variant="h3" sx={{ mt: 2.5, mb: 1, fontSize: "1.05rem" }}>
      {children}
    </Typography>
  ),
  h4: ({ children }) => (
    <Typography component="h4" variant="h4" sx={{ mt: 2, mb: 1, fontSize: "1rem" }}>
      {children}
    </Typography>
  ),
  ul: ({ children }) => (
    <Box component="ul" sx={{ my: 1.5, pl: 3 }}>
      {children}
    </Box>
  ),
  ol: ({ children }) => (
    <Box component="ol" sx={{ my: 1.5, pl: 3 }}>
      {children}
    </Box>
  ),
  li: ({ children }) => (
    <Typography component="li" variant="body1" sx={{ mb: 0.75, lineHeight: 1.7 }}>
      {children}
    </Typography>
  ),
  blockquote: ({ children }) => (
    <Box
      component="blockquote"
      sx={{
        my: 2,
        mx: 0,
        pl: 2,
        borderLeft: 3,
        borderColor: "primary.main",
        color: "text.secondary",
      }}
    >
      {children}
    </Box>
  ),
  a: ({ href, children }) => {
    if (!href || !isSafeHref(href)) return <>{children}</>;
    const external = href.startsWith("http://") || href.startsWith("https://");
    return (
      <Link href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer noopener" : undefined}>
        {children}
      </Link>
    );
  },
};

export function WikiMarkdown({ body }: { body: string }) {
  return (
    <Box data-wiki-markdown="true" sx={{ "& > :last-child": { mb: 0 } }}>
      <ReactMarkdown components={components}>{body}</ReactMarkdown>
    </Box>
  );
}
```

- [ ] **Step 5: Run the renderer test to verify GREEN**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run test --workspace frontend -- src/components/WikiMarkdown.test.tsx
```

Expected:

- PASS.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
git add package-lock.json frontend/package.json frontend/src/components/WikiMarkdown.tsx frontend/src/components/WikiMarkdown.test.tsx
git commit -m "feat: add safe wiki markdown renderer" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Use Markdown Renderer on WikiPage

**Files:**
- Modify: `frontend/src/pages/WikiPage.tsx`
- Modify: `frontend/src/pages/WikiPage.test.tsx`

- [ ] **Step 1: Write the failing WikiPage integration test**

Add this test to `frontend/src/pages/WikiPage.test.tsx` inside the existing `describe("WikiPage", ...)` block:

```tsx
  it("renders markdown body formatting instead of raw markdown text", async () => {
    const client = new MockApiClient();
    const { adminToken } = await client.adminLogin("admin-test");
    await client.adminCreateWikiEntry(adminToken, {
      section: "casas",
      title: "Casa Karasoy",
      body: `> **Lema:** As estrelas lembram.

### Cultura

A Casa protege **rotas antigas**.

- Caminhos sob o deserto
- Guardiãs da estrela`,
      order: 0,
      imageUrls: ["/houses/karasoy.jpg"],
    });

    await setup(client, "/valdren/casas");

    expect(await screen.findByAltText("Imagem de Casa Karasoy")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cultura", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("rotas antigas").tagName.toLowerCase()).toBe("strong");
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Caminhos sob o deserto",
      "Guardiãs da estrela",
    ]);
    expect(screen.queryByText(/\*\*rotas antigas\*\*/)).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the WikiPage test to verify RED**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run test --workspace frontend -- src/pages/WikiPage.test.tsx
```

Expected:

- FAIL because `WikiPage` still renders Markdown as plain text.

- [ ] **Step 3: Replace raw body rendering with `WikiMarkdown`**

Modify `frontend/src/pages/WikiPage.tsx`.

Add this import:

```tsx
import { WikiMarkdown } from "../components/WikiMarkdown";
```

Remove the raw body block:

```tsx
              <Typography component="div" sx={{ whiteSpace: "pre-wrap" }}>
                {entry.body}
              </Typography>
```

Replace it with:

```tsx
              <WikiMarkdown body={entry.body} />
```

- [ ] **Step 4: Run the WikiPage test to verify GREEN**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run test --workspace frontend -- src/pages/WikiPage.test.tsx
```

Expected:

- PASS.

- [ ] **Step 5: Run focused frontend tests**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run test --workspace frontend -- src/components/WikiMarkdown.test.tsx src/pages/WikiPage.test.tsx
```

Expected:

- PASS.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
git add frontend/src/pages/WikiPage.tsx frontend/src/pages/WikiPage.test.tsx
git commit -m "feat: render wiki markdown on public page" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Final Verification and Deployment

**Files:**
- No source files should be edited in this task.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm test
```

Expected:

- Shared typecheck passes.
- Backend tests pass.
- Frontend tests pass.

- [ ] **Step 2: Build the frontend**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
npm run build
```

Expected:

- `@ravenloft/content` builds.
- `@ravenloft/frontend` TypeScript build passes.
- Vite outputs `frontend/dist`.

- [ ] **Step 3: Push `main`**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
git push origin main
```

Expected:

- `main` pushes to `https://github.com/tuliosoria/turnbasedrpg.git`.

- [ ] **Step 4: Manually deploy the frontend to Amplify**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
rm -f frontend/dist.zip
cd frontend/dist
zip -qr ../dist.zip .
cd ../..
DEPLOY_JSON=$(aws amplify create-deployment --app-id d1emmrcvmpw55g --branch-name main --region us-east-1)
echo "$DEPLOY_JSON" > /tmp/turnbasedrpg-amplify-deploy.json
UPLOAD_URL=$(node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync("/tmp/turnbasedrpg-amplify-deploy.json","utf8")); console.log(d.zipUploadUrl)')
JOB_ID=$(node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync("/tmp/turnbasedrpg-amplify-deploy.json","utf8")); console.log(d.jobId)')
curl -sS -X PUT -H 'Content-Type: application/zip' --data-binary @frontend/dist.zip "$UPLOAD_URL" >/dev/null
aws amplify start-deployment --app-id d1emmrcvmpw55g --branch-name main --job-id "$JOB_ID" --region us-east-1
echo "JOB_ID=$JOB_ID"
```

Expected:

- Amplify starts a deployment job for app `d1emmrcvmpw55g`, branch `main`.

- [ ] **Step 5: Wait for Amplify deployment to succeed**

Run:

```bash
JOB_ID=$(node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync("/tmp/turnbasedrpg-amplify-deploy.json","utf8")); console.log(d.jobId)')
for i in {1..60}; do
  STATUS=$(aws amplify get-job --app-id d1emmrcvmpw55g --branch-name main --job-id "$JOB_ID" --region us-east-1 --query 'job.summary.status' --output text)
  echo "status=$STATUS"
  if [ "$STATUS" = "SUCCEED" ]; then exit 0; fi
  if [ "$STATUS" = "FAILED" ] || [ "$STATUS" = "CANCELLED" ]; then exit 1; fi
  sleep 5
done
exit 1
```

Expected:

- Prints `status=SUCCEED`.

- [ ] **Step 6: Smoke test the live frontend bundle**

Run:

```bash
HTML=$(curl -fsS https://main.d1emmrcvmpw55g.amplifyapp.com/valdren/casas)
JS=$(printf '%s' "$HTML" | sed -n 's/.*src="\([^"]*index-[^"]*\.js\)".*/\1/p' | head -1)
echo "$JS"
curl -fsS "https://main.d1emmrcvmpw55g.amplifyapp.com$JS" | grep 'data-wiki-markdown' >/dev/null
```

Expected:

- Prints the live bundle path.
- `grep` exits 0, proving the live bundle contains the Markdown renderer marker.

- [ ] **Step 7: Clean temporary deployment files**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
rm -f frontend/dist.zip /tmp/turnbasedrpg-amplify-deploy.json
```

- [ ] **Step 8: Commit any missed generated metadata**

Run:

```bash
cd /Users/jessicarosa/turnbasedrpg
git status --short
```

Expected:

- Only pre-existing untracked `backups/` may remain.
- If any Markdown feature files are modified, inspect them and commit before reporting completion.

---

## Self-Review

- Spec coverage:
  - Rich Markdown rendering: Task 1 and Task 2.
  - Safe links and no executable HTML: Task 1 tests and renderer implementation.
  - Existing image rendering: Task 2 integration test.
  - Backend data unchanged: File structure and Task 3 state no backend edits.
  - Testing and deployment: Task 3.
- Placeholder scan:
  - No placeholder markers remain.
  - Commands include exact paths.
  - Code steps include complete snippets.
- Type consistency:
  - Component name is consistently `WikiMarkdown`.
  - Prop is consistently `body: string`.
  - Tests import from `./WikiMarkdown` and `../components/WikiMarkdown` consistently with file locations.
