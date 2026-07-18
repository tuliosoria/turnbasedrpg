export function PrivatePanel({ title, text }: { title: string; text: string }) {
  return (
    <section className="card private-panel" aria-label={title}>
      <h3>{title}</h3>
      <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
        Informação privada da sua Casa
      </p>
      {text.split("\n\n").map((para, i) => (
        <p key={i}>{para}</p>
      ))}
    </section>
  );
}
