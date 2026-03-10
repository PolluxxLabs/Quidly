export function CodeBlock({
  code,
  language,
  title,
}: {
  code: string;
  language: string;
  title?: string;
}) {
  return (
    <section className="code-block">
      <div className="code-head">
        <strong>{title ?? 'Example'}</strong>
        <span>{language}</span>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </section>
  );
}
