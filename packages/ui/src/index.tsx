import type { CSSProperties, ReactNode } from "react";

type AppShellCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
  tone?: "default" | "critical";
};

export function AppShellCard({
  eyebrow,
  title,
  description,
  children,
  tone = "default"
}: AppShellCardProps) {
  const cardStyle: CSSProperties = {
    ...styles.card,
    borderColor:
      tone === "critical"
        ? "rgba(255, 142, 128, 0.35)"
        : "var(--border, rgba(255, 255, 255, 0.12))",
    background:
      tone === "critical"
        ? "linear-gradient(145deg, rgba(255, 154, 141, 0.16), rgba(9, 25, 19, 0.94) 40%)"
        : "linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(9, 25, 19, 0.94) 60%)"
  };

  return (
    <section style={cardStyle}>
      <p style={styles.eyebrow}>{eyebrow}</p>
      <h1 style={styles.title}>{title}</h1>
      <p style={styles.description}>{description}</p>
      {children ? <div style={styles.children}>{children}</div> : null}
    </section>
  );
}

const styles = {
  card: {
    width: "min(720px, calc(100vw - 2rem))",
    padding: "2rem",
    borderRadius: "2rem",
    borderStyle: "solid",
    borderWidth: "1px",
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.34)",
    color: "var(--text, #f2efe5)",
    backdropFilter: "blur(18px)"
  },
  eyebrow: {
    margin: 0,
    color: "var(--accent, #d9b15d)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.18em",
    fontSize: "0.78rem"
  },
  title: {
    margin: "0.75rem 0 0.9rem",
    fontSize: "clamp(2rem, 5vw, 3.6rem)",
    lineHeight: 0.96,
    fontFamily: "var(--font-display, Georgia), serif"
  },
  description: {
    margin: 0,
    maxWidth: "52ch",
    color: "var(--muted, #bac7be)",
    fontSize: "1rem",
    lineHeight: 1.6,
    fontFamily: "var(--font-sans, 'Segoe UI'), sans-serif"
  },
  children: {
    marginTop: "1.25rem"
  }
} satisfies Record<string, CSSProperties>;
