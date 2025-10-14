import { Resend } from 'resend';

/**
 * Lightweight email notification utility using Resend.
 * This is guarded by env and will no-op if RESEND_API_KEY is not set.
 */
export type EmailPayload = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string; // default used if not provided
};

let resend: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resend) {
    resend = new Resend(apiKey);
  }
  return resend;
}

export async function sendEmailNotification(payload: EmailPayload): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const client = getResend();
    if (!client) {
      // Not configured: treat as success in dev to avoid throwing
      return { ok: true };
    }
    const from = payload.from ?? (process.env.RESEND_FROM ?? 'notifications@matchday-pulse.dev');
    const res = await client.emails.send({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html
    });
    if (res?.error) {
      return { ok: false, error: String(res.error) };
    }
    return { ok: true, id: (res as any)?.data?.id };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'unknown_error' };
  }
}
