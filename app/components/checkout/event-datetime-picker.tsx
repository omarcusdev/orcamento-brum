"use client"

import { motion } from "framer-motion"
import { MESES, DAY_OPTIONS, HORAS, MINUTOS } from "@/lib/checkout-datetime"

const selectClassName =
  "w-full px-4 py-3 rounded-md border border-white/10 bg-brand-surface text-white text-sm focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow/50 outline-none transition-colors duration-200 appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%20stroke%3D%22%23B5AFA6%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m2%204%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_12px_center] bg-no-repeat"
const labelClassName = "block text-sm font-medium text-brand-gray-light mb-1.5"

type Props = {
  dia: string; mes: string; ano: string; hora: string; minuto: string
  onDia: (v: string) => void; onMes: (v: string) => void; onAno: (v: string) => void
  onHora: (v: string) => void; onMinuto: (v: string) => void
  maxDays: number; diaInvalida: boolean | ""; selectedMonth: number
  yearOptions: number[]
  bookedSlots: Record<number, number>
}

export const EventDateTimePicker = ({
  dia, mes, ano, hora, minuto, onDia, onMes, onAno, onHora, onMinuto,
  maxDays, diaInvalida, selectedMonth, yearOptions, bookedSlots,
}: Props) => (
  <>
    <div>
      <label className={labelClassName}>Data do evento *</label>
      <div className="grid grid-cols-3 gap-3">
        <select required value={dia} onChange={(e) => onDia(e.target.value)} className={selectClassName}>
          <option value="" disabled>Dia</option>
          {DAY_OPTIONS.map((d) => <option key={d} value={String(d)}>{d}</option>)}
        </select>
        <select required value={mes} onChange={(e) => onMes(e.target.value)} className={selectClassName}>
          <option value="" disabled>Mes</option>
          {MESES.map((nome, idx) => <option key={nome} value={String(idx + 1)}>{nome}</option>)}
        </select>
        <select required value={ano} onChange={(e) => onAno(e.target.value)} className={selectClassName}>
          {yearOptions.map((y) => <option key={y} value={String(y)}>{y}</option>)}
        </select>
      </div>
      {diaInvalida && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-red-400 text-sm mt-2">
          O mes de {MESES[selectedMonth - 1]} nao tem dia {dia} — selecione um dia ate {maxDays}
        </motion.p>
      )}
    </div>

    <div>
      <label className={labelClassName}>Horario do evento *</label>
      <div className="grid grid-cols-2 gap-3">
        <select
          required value={hora}
          onChange={(e) => { onHora(e.target.value); if (minuto === "") onMinuto("0") }}
          className={selectClassName}
        >
          <option value="" disabled>Hora</option>
          {HORAS.map((h) => {
            const full = (bookedSlots[h] ?? 0) >= 2
            return <option key={h} value={String(h)} disabled={full}>{String(h).padStart(2, "0")}h{full ? " (indisponivel)" : ""}</option>
          })}
        </select>
        <select required value={minuto} onChange={(e) => onMinuto(e.target.value)} className={selectClassName}>
          <option value="" disabled>Minuto</option>
          {MINUTOS.map((m) => <option key={m} value={String(m)}>{String(m).padStart(2, "0")}min</option>)}
        </select>
      </div>
    </div>
  </>
)
