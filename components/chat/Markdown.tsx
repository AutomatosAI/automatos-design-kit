// Model output as markdown. The text is untrusted: raw HTML in it is dropped (skipHtml,
// and no rehype-raw), react-markdown's default URL check strips javascript: links, and
// images show as their alt text: an image URL is fetched with no click, so injected
// instructions could use one to send chat content to any host.

import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";

import styles from "./chat.module.css";

const REMARK_PLUGINS = [remarkGfm];

/** Links leave Play in a new tab, without handing it this window. */
function ExternalLink({ href, title, children }: ComponentPropsWithoutRef<"a"> & ExtraProps) {
  return (
    <a href={href} title={title} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function ImageAsText({ alt }: ComponentPropsWithoutRef<"img"> & ExtraProps) {
  return alt ? <span className={styles.imageAlt}>{alt}</span> : null;
}

const COMPONENTS: Components = { a: ExternalLink, img: ImageAsText };

export interface MarkdownProps {
  readonly text: string;
  /** Extra styles on top of the chat's (a Deliverable reads as a document). */
  readonly className?: string;
}

export function Markdown({ text, className }: MarkdownProps) {
  return (
    <div className={className ? `${styles.markdown} ${className}` : styles.markdown}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} skipHtml components={COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
