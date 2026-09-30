/** Re-mounts on every dashboard navigation, giving each page a short, quiet entrance. */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page">{children}</div>
}
