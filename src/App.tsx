import { Route, Routes } from "react-router"
import { UploadPage } from "@/routes/UploadPage"
import { DownloadPage } from "@/routes/DownloadPage"

export function App() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6">
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/f/:id" element={<DownloadPage />} />
      </Routes>
    </div>
  )
}

export default App
