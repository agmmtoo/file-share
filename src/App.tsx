import { Route, Routes } from "react-router"
import { Share2 } from "lucide-react"
import { UploadPage } from "@/routes/UploadPage"
import { DownloadPage } from "@/routes/DownloadPage"

export function App() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
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
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/f/:id" element={<DownloadPage />} />
      </Routes>
    </div>
  )
}

export default App
