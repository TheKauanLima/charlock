import 'server-only'

import { Resend } from 'resend'

export type AuthEmailType = 'verify_email' | 'reset_password'

interface AuthEmailTemplateInput {
  type: AuthEmailType
  title: string
  preview: string
  body: string
}

function getResendApiKey() {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  return apiKey
}

function getAuthEmailTemplate(type: AuthEmailType): AuthEmailTemplateInput {
  if (type === 'reset_password') {
    return {
      type,
      title: 'PASSWORD RESET',
      preview: 'Your Charlock password reset code is on the way.',
      body: 'A password reset was requested for your Charlock account. Enter the 6-digit code from Clerk to set a new password.',
    }
  }

  return {
    type,
    title: 'VERIFY EMAIL',
    preview: 'Your Charlock verification code is on the way.',
    body: 'Welcome to Charlock. Enter the 6-digit code from Clerk to activate your account and return to the Hero Grid.',
  }
}

function renderAuthEmail({ title, preview, body }: AuthEmailTemplateInput) {
  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${preview}</title>
  </head>
  <body style="margin:0;background:#10130d;color:#ffefd7;font-family:Radiance,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#10130d;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #2292af;background:linear-gradient(135deg,#1a1a1a,#102f38);">
            <tr>
              <td style="padding:28px 30px;border-bottom:1px solid rgba(254,52,53,.45);">
                <div style="font-family:VALVEPulp,Arial,sans-serif;font-size:28px;letter-spacing:2px;color:#ffefd6;text-transform:uppercase;">${title}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 30px;font-size:16px;line-height:1.6;color:#fef2d8;">
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 30px;color:#80eeff;font-size:13px;text-transform:uppercase;letter-spacing:1px;">
                Charlock Account Security
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export async function sendAuthEmail(to: string, type: AuthEmailType) {
  const resend = new Resend(getResendApiKey())
  const template = getAuthEmailTemplate(type)

  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'Charlock <onboarding@resend.dev>',
    to,
    subject: template.preview,
    html: renderAuthEmail(template),
  })
}
