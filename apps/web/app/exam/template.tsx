/** Soft fade between exam screens (player ⇄ review). */
export default function ExamTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page">{children}</div>
}
