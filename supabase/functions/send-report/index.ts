import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ClauseEntry {
  location?: string
  name: string
  counter?: string
}

interface SendReportPayload {
  to_email: string
  to_name?: string
  personal_message?: string
  property_name: string
  client_name?: string
  from_name?: string
  neg_id?: string
  countering: ClauseEntry[]
  agreed: ClauseEntry[]
}

function esc(s: string | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildHtml(p: SendReportPayload): string {
  const font = "'IBM Plex Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif"
  const logoUrl = 'https://leaseroom.com.au/leaseroom-logo-light.png'
  const appUrl = Deno.env.get('APP_URL') ?? 'https://leaseroom.com.au'
  const viewUrl = p.neg_id ? `${appUrl}/negotiation/${p.neg_id}` : appUrl

  const counterRows = p.countering.map(c => `
    <tr>
      <td style="padding:14px 0 10px;border-bottom:1px solid rgba(14,24,48,0.06);">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            ${c.location ? `<td style="width:56px;vertical-align:top;padding-top:2px;"><span style="font-family:${font};font-size:9.5px;font-weight:700;color:#8A93A4;text-transform:uppercase;letter-spacing:0.06em;">${esc(c.location)}</span></td>` : ''}
            <td><span style="font-family:${font};font-size:14px;font-weight:600;color:#0E1830;">${esc(c.name)}</span></td>
          </tr>
        </table>
        ${c.counter ? `
        <div style="margin-top:10px;background:#F8F9FB;border-left:3px solid #7FA0D6;padding:12px 14px;border-radius:0 4px 4px 0;">
          <div style="font-family:${font};font-size:9.5px;font-weight:700;color:#7FA0D6;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Proposed wording</div>
          <div style="font-family:${font};font-size:13px;color:#56627A;line-height:1.65;">${esc(c.counter).replace(/\n/g, '<br>')}</div>
        </div>` : ''}
      </td>
    </tr>`).join('')

  const agreedRows = p.agreed.map(c => `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid rgba(14,24,48,0.05);">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            ${c.location ? `<td style="width:56px;"><span style="font-family:${font};font-size:9.5px;font-weight:700;color:#8A93A4;text-transform:uppercase;letter-spacing:0.06em;">${esc(c.location)}</span></td>` : ''}
            <td><span style="font-family:${font};font-size:13px;color:#56627A;">${esc(c.name)}</span></td>
          </tr>
        </table>
      </td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:0;background-color:#F8F9FB;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#F8F9FB;">
  <tr>
    <td align="center" style="padding:48px 16px 56px;">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;">

        <!-- HEADER -->
        <tr>
          <td style="background-color:#0E1830;padding:20px 36px;border-radius:8px 8px 0 0;">
            <img src="${logoUrl}" alt="LeaseRoom" width="140" height="auto" style="display:block;border:0;max-width:140px;">
          </td>
        </tr>

        <!-- ACCENT RULE -->
        <tr>
          <td style="background-color:#7FA0D6;height:2px;line-height:2px;font-size:2px;mso-line-height-rule:exactly;">&nbsp;</td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="background-color:#FFFFFF;padding:40px 36px 36px;border-radius:0 0 8px 8px;border-left:1px solid rgba(14,24,48,0.08);border-right:1px solid rgba(14,24,48,0.08);border-bottom:1px solid rgba(14,24,48,0.08);">

            <div style="font-family:${font};font-size:10px;font-weight:700;color:#7FA0D6;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">Lease negotiation response</div>

            <h1 style="margin:0 0 6px;font-family:${font};font-size:22px;font-weight:700;color:#0E1830;letter-spacing:-0.025em;line-height:1.3;">${esc(p.property_name)}</h1>

            ${p.client_name
              ? `<p style="margin:0 0 28px;font-family:${font};font-size:14px;color:#8A93A4;">Tenant: ${esc(p.client_name)}</p>`
              : '<div style="margin-bottom:28px;"></div>'}

            ${p.personal_message ? `
            <div style="margin-bottom:28px;background:#F8F9FB;border:1px solid rgba(14,24,48,0.08);border-radius:6px;padding:16px 18px;">
              <p style="margin:0;font-family:${font};font-size:14px;color:#56627A;line-height:1.65;white-space:pre-wrap;">${esc(p.personal_message)}</p>
            </div>` : ''}

            ${p.countering.length ? `
            <div style="margin-bottom:${p.agreed.length ? '28px' : '32px'};">
              <div style="font-family:${font};font-size:11px;font-weight:700;color:#0E1830;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:12px;border-bottom:2px solid #0E1830;">Proposed changes &middot; ${p.countering.length}</div>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${counterRows}</table>
            </div>` : ''}

            ${p.agreed.length ? `
            <div style="margin-bottom:32px;">
              <div style="font-family:${font};font-size:11px;font-weight:700;color:#0E1830;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:12px;border-bottom:1px solid rgba(14,24,48,0.12);">Accepted as drafted &middot; ${p.agreed.length}</div>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${agreedRows}</table>
            </div>` : ''}

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background-color:#1E3A66;border-radius:6px;">
                  <a href="${viewUrl}" style="display:inline-block;padding:13px 28px;font-family:${font};font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;letter-spacing:-0.01em;mso-padding-alt:13px 28px;">View full analysis in LeaseRoom</a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding:22px 36px 0;text-align:center;">
            <p style="margin:0;font-family:${font};font-size:12px;color:#8A93A4;line-height:1.7;">
              ${p.from_name ? `Prepared by ${esc(p.from_name)} using ` : 'Prepared using '}
              <a href="https://leaseroom.com.au" style="color:#7FA0D6;text-decoration:none;">LeaseRoom</a>
              &middot; Lease analysis for retail tenants<br>
              LeaseRoom provides informational analysis and does not constitute legal advice.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const payload: SendReportPayload = await req.json()
    const { to_email, property_name } = payload

    if (!to_email || !property_name) {
      return json({ error: 'to_email and property_name are required' }, 400)
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) throw new Error('RESEND_API_KEY not configured')

    const html = buildHtml(payload)
    const subject = `Lease negotiation response — ${property_name}`
    const toField = payload.to_name ? `${payload.to_name} <${to_email}>` : to_email

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'LeaseRoom <noreply@leaseroom.com.au>',
        to: [toField],
        reply_to: user.email,
        subject,
        html,
      }),
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      throw new Error(`Resend error ${emailRes.status}: ${errText}`)
    }

    return json({ ok: true })
  } catch (e) {
    console.error('send-report:', e)
    return json({ error: (e as Error).message }, 500)
  }
})
