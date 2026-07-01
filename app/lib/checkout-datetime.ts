export const MESES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

export const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1)

export const HORAS = Array.from({ length: 15 }, (_, i) => i + 8)

export const MINUTOS = [0, 15, 30, 45]

export const getDaysInMonth = (month: number, year: number) => new Date(year, month, 0).getDate()

export const buildYearOptions = (currentYear: number) => [currentYear, currentYear + 1]
