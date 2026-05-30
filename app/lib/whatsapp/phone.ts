export const toBrazilE164 = (raw: string): string => {
  const digits = raw.replace(/\D/g, "")
  if (digits.length <= 11) return `55${digits}`
  return digits
}
