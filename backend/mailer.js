const { RESEND_API_KEY, MAIL_FROM, MAIL_TO } = process.env;

exports.mailEnabled = () => Boolean(RESEND_API_KEY && MAIL_FROM && MAIL_TO);

exports.mailProgram = async (program) => {
  const divisions = Array.isArray(program.divisions) ? program.divisions : [];
  const steps = divisions.reduce((n, d) => n + (d.sequence?.length || 0), 0);
  const json = JSON.stringify(program, null, 2);
  const sentAt = new Date().toLocaleString();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: MAIL_TO.split(",").map((s) => s.trim()),
      subject: `Robokido SEND: ${divisions.length} division(s), ${steps} step(s)`,
      text: `Program sent from the Robokido IDE at ${sentAt}.\n\n${json}`,
      attachments: [
        {
          filename: "robokido-program.json",
          content: Buffer.from(json).toString("base64"),
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Resend ${res.status}: ${body.message || res.statusText}`);
  }
};
