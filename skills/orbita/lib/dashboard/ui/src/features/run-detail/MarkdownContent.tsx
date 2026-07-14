import { ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Local managed-Markdown renderer. Raw HTML stays disabled and external links are disclosed. */
export function MarkdownContent({ children }: Readonly<{ children: string }>) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        components={{
          a: ({ children: linkChildren, href }) => {
            const external = href?.startsWith("http://") || href?.startsWith("https://");
            return (
              <a
                href={href}
                rel={external ? "noreferrer" : undefined}
                target={external ? "_blank" : undefined}
              >
                {linkChildren}
                {external ? (
                  <>
                    <ExternalLink aria-hidden="true" size={12} />
                    <span className="sr-only"> (opens an external site)</span>
                  </>
                ) : null}
              </a>
            );
          },
        }}
        remarkPlugins={[remarkGfm]}
        skipHtml
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
