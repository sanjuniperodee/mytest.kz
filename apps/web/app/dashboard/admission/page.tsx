import AdmissionPage from "../../admission/page"

/**
 * Dashboard wrapper for the public admission page.
 * The public page has its own `mx-auto max-w-7xl px-4 py-8 lg:py-12` container.
 * DashboardShell already wraps children in `mx-auto max-w-6xl p-4 sm:p-6 lg:p-8`.
 * Negative margins negate the shell padding so the admission page fills correctly.
 */
export default function DashboardAdmissionPage() {
  return (
    <div className="-m-4 sm:-m-6 lg:-m-8">
      <AdmissionPage />
    </div>
  )
}
