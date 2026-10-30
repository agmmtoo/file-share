import { Link, Route, Routes } from "react-router"
import { Files, LogOut, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UploadPage } from "@/routes/UploadPage"
import { DownloadPage } from "@/routes/DownloadPage"
import { AuthPage } from "@/routes/AuthPage"
import { SharesPage } from "@/routes/SharesPage"
import { authClient, useSession } from "@/lib/auth"

function AccountStrip() {
  const { data: session, isPending, refetch } = useSession()

  if (isPending) return <div className="h-6" />

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <Button
          render={<Link to="/login" />}
          nativeButton={false}
          variant="outline"
          size="xs"
        >
          Sign in
        </Button>
        <Button render={<Link to="/signup" />} nativeButton={false} size="xs">
          Sign up
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="max-w-[16rem] truncate border-2 border-brutal bg-card px-2 py-1 text-[10px] tracking-wide">
        {session.user.email}
      </span>
      <Button
        render={<Link to="/shares" />}
        nativeButton={false}
        variant="outline"
        size="xs"
      >
        <Files />
        Shares
      </Button>
      <Button
        variant="outline"
        size="icon-xs"
        aria-label="Sign out"
        onClick={async () => {
          await authClient.signOut()
          // Session is cached in the client; refetch so the header and the
          // upload form drop back to anonymous limits immediately.
          await refetch()
        }}
      >
        <LogOut />
      </Button>
    </div>
  )
}

export function App() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="flex w-full max-w-md flex-wrap items-center justify-between gap-3">
        <a
          href="/"
          className="group inline-flex items-center gap-2 border-2 border-brutal bg-card px-3 py-1.5 shadow-brutal-sm transition-all duration-150 ease-(--ease-brutal) hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brutal"
        >
          <span className="grid size-5 place-items-center border-2 border-brutal bg-brand text-brand-foreground transition-transform duration-200 ease-(--ease-brutal) group-hover:-rotate-6">
            <Share2 className="size-3" />
          </span>
          <span className="text-xs font-bold tracking-widest uppercase">
            file&#8203;share
          </span>
        </a>
        <AccountStrip />
      </div>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/f/:id" element={<DownloadPage />} />
        <Route path="/login" element={<AuthPage mode="signin" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/shares" element={<SharesPage />} />
      </Routes>
    </div>
  )
}

export default App
