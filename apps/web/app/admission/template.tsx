/** Re-mounts on every admission navigation, giving each page a short, quiet entrance. */
export default function AdmissionTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page">{children}</div>
}
