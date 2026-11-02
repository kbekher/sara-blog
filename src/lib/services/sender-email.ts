/**
 * Reads BREVO_SENDER_EMAIL tolerantly: values pasted as `<name@x.com>`, `"name@x.com"`, `Сара <name@x.com>`
 * or with trailing commas/spaces are reduced to the bare address.
 */
export function readSenderEmail(raw: string | undefined = process.env.BREVO_SENDER_EMAIL): string {
  if (!raw) return "";
  const match = raw.match(/[^\s<>"',;]+@[^\s<>"',;]+/);
  return (match?.[0] ?? "").toLowerCase();
}
