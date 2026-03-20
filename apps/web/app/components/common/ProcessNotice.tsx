import { memo } from "react";

import type { ProcessFeedback } from "../../lib/phase-two-types";

type ProcessNoticeProps = {
  feedback: ProcessFeedback | null;
};

function ProcessNoticeComponent({ feedback }: ProcessNoticeProps) {
  if (!feedback) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className={`process-notice process-${feedback.tone}`}
      role="status"
    >
      {feedback.message}
    </div>
  );
}

export const ProcessNotice = memo(ProcessNoticeComponent);
