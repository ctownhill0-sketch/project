/** "(917) 555-0125" for US numbers; anything else is returned as typed. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const us = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (us.length !== 10 || (digits.length === 11 && !digits.startsWith("1"))) return phone;
  if (phone.trim().startsWith("+") && !phone.trim().startsWith("+1")) return phone;
  return `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}`;
}

/** tel: link (calls happen on the founder's phone; never auto-dialled). */
export function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const e164 = digits.length === 10 ? `+1${digits}` : `+${digits}`;
  return `tel:${e164}`;
}
