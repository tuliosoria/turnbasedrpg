import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { Component, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";

function isSafeHref(href: string): boolean {
  const trimmed = href.trim();

  if (!trimmed) {
    return false;
  }

  if (
    trimmed.startsWith("#") ||
    (trimmed.startsWith("/") && !trimmed.startsWith("//")) ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../")
  ) {
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
  // WikiPage renders entry titles as h2, so body content starts below that.
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
    <Typography component="h4" variant="h3" sx={{ mt: 2.5, mb: 1, fontSize: "1.05rem" }}>
      {children}
    </Typography>
  ),
  h4: ({ children }) => (
    <Typography component="h4" variant="h4" sx={{ mt: 2, mb: 1, fontSize: "1rem" }}>
      {children}
    </Typography>
  ),
  h5: ({ children }) => (
    <Typography component="h4" variant="h4" sx={{ mt: 2, mb: 1, fontSize: "1rem" }}>
      {children}
    </Typography>
  ),
  h6: ({ children }) => (
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
    const safeHref = href?.trim();

    if (!safeHref || !isSafeHref(safeHref)) {
      return <span>{children}</span>;
    }

    const external = safeHref.toLowerCase().startsWith("http://") || safeHref.toLowerCase().startsWith("https://");

    return (
      <Link
        href={safeHref}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer noopener" : undefined}
      >
        {children}
      </Link>
    );
  },
};

class WikiMarkdownErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export function WikiMarkdown({ body }: { body: string }) {
  return (
    <Box data-wiki-markdown="true" sx={{ "& > :last-child": { mb: 0 } }}>
      <WikiMarkdownErrorBoundary
        fallback={
          <Typography component="div" variant="body1" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.75 }}>
            {body}
          </Typography>
        }
      >
        <ReactMarkdown components={components}>{body}</ReactMarkdown>
      </WikiMarkdownErrorBoundary>
    </Box>
  );
}
