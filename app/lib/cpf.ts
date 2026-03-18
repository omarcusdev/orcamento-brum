export const validateCpf = (cpf: string): boolean => {
  const digits = cpf.replace(/\D/g, "")
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false

  const calcDigit = (slice: string, factor: number): number => {
    const sum = slice.split("").reduce((acc, d, i) => acc + parseInt(d) * (factor - i), 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  const first = calcDigit(digits.slice(0, 9), 10)
  if (first !== parseInt(digits[9])) return false

  const second = calcDigit(digits.slice(0, 10), 11)
  return second === parseInt(digits[10])
}

export const formatCpf = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}
