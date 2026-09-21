interface SpecificationFallbackProps {
  children?: string;
}

export function SpecificationFallback({ children }: SpecificationFallbackProps) {
  return (
    <div className="spec-fallback">
      <div className="alert" role="alert">
        <div>
          <strong>Formatted specification couldn’t load.</strong>
          <p>Your results and downloads are still available. This view shows the original text without formatting.</p>
        </div>
      </div>
      <pre className="spec-plain" role="region" aria-label="Plain-text specification">
        {children || "No specification text was returned."}
      </pre>
    </div>
  );
}
