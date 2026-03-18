import type { ReactNode } from "react";

type AppShellCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function AppShellCard({
  eyebrow,
  title,
  description,
  children
}: AppShellCardProps) {
  return (
    <section style={styles.card}>
      <p style={styles.eyebrow}>{eyebrow}</p>
      <h1 style={styles.title}>{title}</h1>
      <p style={styles.description}>{description}</p>
      {children}
    </section>
  );
}

const styles = {
  card: {
    padding: "28px",
    borderRadius: "28px",
    border: "1px solid rgba(31, 26, 23, 0.12)",
    background: "rgba(255, 250, 242, 0.86)",
    boxShadow: "0 20px 60px rgba(73, 57, 44, 0.1)"
  },
  eyebrow: {
    margin: 0,
    color: "#6d5d55",
    textTransform: "uppercase" as const,
    letterSpacing: "0.12em",
    fontSize: "0.85rem"
  },
  title: {
    margin: "10px 0 12px",
    fontSize: "clamp(2.2rem, 6vw, 4.5rem)",
    lineHeight: 0.95
  },
  description: {
    margin: 0,
    maxWidth: "52ch",
    color: "#3d3028",
    fontSize: "1.1rem",
    lineHeight: 1.6
  }
};
