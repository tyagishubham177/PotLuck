import { ProcessButton } from "../common/ProcessButton";
import { ProcessNotice } from "../common/ProcessNotice";
import { InfoRow } from "../common/InfoRow";

import type { OtpRequestState, ProcessFeedback } from "../../lib/phase-two-types";

type AdminLoginPanelProps = {
  adminCode: string;
  adminEmail: string;
  otpRequestState: OtpRequestState;
  requestOtpFeedback: ProcessFeedback | null;
  verifyOtpFeedback: ProcessFeedback | null;
  onAdminCodeChange: (value: string) => void;
  onAdminEmailChange: (value: string) => void;
  onRequestOtp: () => void;
  onVerifyOtp: () => void;
};

export function AdminLoginPanel({
  adminCode,
  adminEmail,
  otpRequestState,
  requestOtpFeedback,
  verifyOtpFeedback,
  onAdminCodeChange,
  onAdminEmailChange,
  onRequestOtp,
  onVerifyOtp
}: AdminLoginPanelProps) {
  return (
    <article className="panel">
      <div className="panel-head">
        <p className="eyebrow">Host access</p>
        <h2>Authenticate as the room host</h2>
      </div>

      <label className="field">
        <span>Admin email</span>
        <input
          autoComplete="email"
          onChange={(event) => onAdminEmailChange(event.target.value)}
          type="email"
          value={adminEmail}
        />
      </label>

      <div className="action-row">
        <ProcessButton
          idleLabel="Send sign-in code"
          onClick={onRequestOtp}
          pendingLabel="Sending code"
          successLabel="Code sent"
          tone={requestOtpFeedback?.tone ?? "idle"}
          variant="primary"
        />
      </div>
      <ProcessNotice feedback={requestOtpFeedback} />

      {otpRequestState ? (
        <div className="info-block">
          <InfoRow label="Challenge" value={otpRequestState.challengeId} />
          <InfoRow label="Delivered to" value={otpRequestState.deliveryHint} />
          <InfoRow
            label="Expires at"
            value={new Date(otpRequestState.expiresAt).toLocaleString()}
          />
        </div>
      ) : null}

      <label className="field">
        <span>One-time code</span>
        <input
          inputMode="numeric"
          maxLength={6}
          onChange={(event) => onAdminCodeChange(event.target.value)}
          value={adminCode}
        />
      </label>

      <div className="action-row">
        <ProcessButton
          idleLabel="Verify code"
          onClick={onVerifyOtp}
          pendingLabel="Verifying OTP"
          successLabel="OTP verified"
          tone={verifyOtpFeedback?.tone ?? "idle"}
          variant="secondary"
        />
      </div>
      <ProcessNotice feedback={verifyOtpFeedback} />
    </article>
  );
}
