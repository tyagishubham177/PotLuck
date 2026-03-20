import { memo } from "react";

import type { ProcessTone } from "../../lib/phase-two-types";

export type ProcessButtonProps = {
  variant: "primary" | "secondary" | "ghost";
  tone: ProcessTone;
  idleLabel: string;
  pendingLabel: string;
  successLabel: string;
  errorLabel?: string;
  onClick: () => void;
  disabled?: boolean;
};

function getButtonLabel(props: Omit<ProcessButtonProps, "variant" | "onClick" | "disabled">) {
  if (props.tone === "pending") {
    return props.pendingLabel;
  }

  if (props.tone === "success") {
    return props.successLabel;
  }

  if (props.tone === "error") {
    return props.errorLabel ?? props.idleLabel;
  }

  return props.idleLabel;
}

function ProcessButtonComponent({
  variant,
  tone,
  idleLabel,
  pendingLabel,
  successLabel,
  errorLabel,
  onClick,
  disabled
}: ProcessButtonProps) {
  const toneClass = tone === "idle" ? "" : ` process-${tone}`;

  return (
    <button
      className={`${variant}-button process-button${toneClass}`}
      disabled={disabled || tone === "pending"}
      onClick={onClick}
      type="button"
    >
      <span className="process-indicator" aria-hidden="true" />
      {getButtonLabel({ tone, idleLabel, pendingLabel, successLabel, errorLabel })}
    </button>
  );
}

export const ProcessButton = memo(ProcessButtonComponent);
