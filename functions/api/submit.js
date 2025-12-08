// functions/api/submit.js
export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  const headers = { 'content-type': 'application/json' };

  try {
    const form = await request.formData();
    const get = (k) => {
      const v = form.get(k);
      return v ? String(v).trim() : '';
    };

    const lead = {
      first_name: get('first_name'),
      last_name: get('last_name'),
      org_name: get('org_name'),
      role: get('role'),
      email: get('email'),
      phone: get('phone'),
      city: get('city'),
      state: get('state'),
      zip: get('zip'),
      unit_count: get('unit_count'),
      notes: get('notes'),
      utm_source: get('utm_source'),
      utm_medium: get('utm_medium'),
      utm_campaign: get('utm_campaign')
    };

    // Basic validation
    if (!lead.first_name || !lead.last_name || !lead.org_name || !lead.email) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required fields.' }),
        { status: 400, headers }
      );
    }

    const ip =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for') ||
      '';
    const ua = request.headers.get('user-agent') || '';

    // Insert into D1
    const stmt = env.D1_LEADS.prepare(
      `INSERT INTO leads
        (first_name,last_name,org_name,role,email,phone,city,state,zip,unit_count,notes,
         utm_source,utm_medium,utm_campaign,ip,user_agent)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      lead.first_name,
      lead.last_name,
      lead.org_name,
      lead.role,
      lead.email,
      lead.phone,
      lead.city,
      lead.state,
      lead.zip,
      lead.unit_count || null,
      lead.notes,
      lead.utm_source,
      lead.utm_medium,
      lead.utm_campaign,
      ip,
      ua
    );

    const result = await stmt.run();
    const id = result.lastInsertRowId;

    // Send email via SendGrid
    if (env.SENDGRID_API_KEY && env.FROM_EMAIL && env.TO_EMAIL) {
      const toList = env.TO_EMAIL.split(',').map((e) => e.trim());

      const body = {
        personalizations: [
          {
            to: toList.map((email) => ({ email }))
          }
        ],
        from: { email: env.FROM_EMAIL },
        subject: `New MultiQuotePro lead: ${lead.org_name}`,
        content: [
          {
            type: 'text/plain',
            value: `New HOA / Condo association lead:
