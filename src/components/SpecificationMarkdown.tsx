import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SpecificationMarkdownProps {
  children?: string;
}

export function SpecificationMarkdown({ children }: SpecificationMarkdownProps) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>;
}
