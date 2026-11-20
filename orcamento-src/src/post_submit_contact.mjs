export function postSubmitWhatsAppHref(pricingStatus, submissionId) {
  if (pricingStatus === 'CALCULATED' ||
      typeof submissionId !== 'string' || !/^SITE-SUB-[0-9a-f]{12}$/.test(submissionId)) {
    return null;
  }
  const message = `Olá, Marcos. Acabei de enviar meu caso pelo site e queria adiantar a conversa. (${submissionId})`;
  return `https://wa.me/5544998202552?text=${encodeURIComponent(message)}`;
}
