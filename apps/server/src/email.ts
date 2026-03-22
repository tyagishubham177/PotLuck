export type OtpEmailPayload = {
  email: string;
  code: string;
  challengeId: string;
  expiresAt: string;
};

export type EmailAdapter = {
  sendAdminOtp(payload: OtpEmailPayload): Promise<void>;
};

type CreateEmailAdapterOptions = {
  apiKey: string;
  fromEmail: string;
  fetchImpl?: typeof fetch;
};

export function createResendEmailAdapter({
  apiKey,
  fromEmail,
  fetchImpl = fetch
}: CreateEmailAdapterOptions): EmailAdapter {
  return {
    async sendAdminOtp(payload) {
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [payload.email],
          subject: "Your PotLuck admin sign-in code",
          text: [
            "Your PotLuck admin sign-in code is:",
            payload.code,
            "",
            `Challenge: ${payload.challengeId}`,
            `Expires at: ${payload.expiresAt}`
          ].join("\n"),
          html: [
            "<div style=\"font-family:Arial,sans-serif;line-height:1.5\">",
            "<h1>PotLuck admin sign-in</h1>",
            `<p>Your one-time code is <strong>${payload.code}</strong>.</p>`,
            `<p>Challenge: <code>${payload.challengeId}</code></p>`,
            `<p>This code expires at ${payload.expiresAt}.</p>`,
            "</div>"
          ].join("")
        })
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend delivery failed (${response.status}): ${body}`);
      }
    }
  };
}
