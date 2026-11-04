import "server-only";

/** WhatsApp settings, or null while not configured (the worker then does nothing). */
export function whatsappConfig() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_TEMPLATE_NAME;
  if (!token || !phoneNumberId || !template) return null;
  return { token, phoneNumberId, template, language: process.env.WHATSAPP_TEMPLATE_LANG || "ar" };
}
