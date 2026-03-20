import { memo, type ReactNode } from "react";

type InfoRowProps = {
  label: ReactNode;
  value: ReactNode;
};

function InfoRowComponent({ label, value }: InfoRowProps) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export const InfoRow = memo(InfoRowComponent);
