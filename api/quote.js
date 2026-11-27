// Vercel serverless function: receives a quote request and emails it with Resend.
// Needs two environment variables in Vercel: RESEND_API_KEY and QUOTE_TO.
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
function clip(s, n) { return String(s == null ? '' : s).slice(0, n); }

module.exports = async function (req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  var b = req.body || {};
  if (b.website) { res.status(200).json({ ok: true }); return; } // honeypot: bots fill this
  var name = clip(b.name, 120), contact = clip(b.contact, 160), details = clip(b.details, 2000);
  var items = Array.isArray(b.items) ? b.items.slice(0, 60) : [];
  if (!name || !contact || (!items.length && !details)) { res.status(400).json({ error: 'invalid' }); return; }

  var key = process.env.RESEND_API_KEY, to = process.env.QUOTE_TO;
  if (!key || !to) { res.status(501).json({ error: 'not_configured' }); return; }

  var rows = items.map(function (i) {
    var price = typeof i.price === 'number' ? '$' + i.price.toFixed(2) : 'Quote';
    return '<tr><td>' + esc(clip(i.name, 200)) + '</td><td>' + esc(Number(i.qty) || 1) + '</td><td>' + esc(price) + '</td></tr>';
  }).join('');
  var html = '<h2>' + (items.length ? 'New quote request' : 'New contact message') + ' (concept demo)</h2>' +
    '<p><b>Name:</b> ' + esc(name) + '<br><b>Contact:</b> ' + esc(contact) + '</p>' +
    (items.length ? '<table border="1" cellpadding="6" cellspacing="0"><tr><th>Item</th><th>Qty</th><th>Price</th></tr>' + rows + '</table>' +
    '<p><b>Estimated total (priced items):</b> $' + (Number(b.total) || 0).toFixed(2) + '</p>' : '') +
    '<p><b>Boat / engine details:</b><br>' + esc(details).replace(/\n/g, '<br>') + '</p>';

  try {
    var r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Quote demo <onboarding@resend.dev>',
        to: [to],
        reply_to: contact.indexOf('@') > 0 ? contact : undefined,
        subject: (items.length ? 'Quote request from ' : 'Message from ') + name,
        html: html
      })
    });
    if (!r.ok) { res.status(502).json({ error: 'send_failed' }); return; }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: 'send_failed' });
  }
};
