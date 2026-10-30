import { useState } from "react"
import { Loader2, LogIn, UserPlus } from "lucide-react"
import { Link, useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn, signUp } from "@/lib/auth"
import { TIERS } from "../../shared/types"
import { formatBytes } from "@/lib/format"

type Mode = "signin" | "signup"

const COPY = {
  signin: {
    title: "Sign in",
    blurb: "Bigger files, longer links, and download limits.",
    action: "Sign in",
    swapText: "No account yet?",
    swapLabel: "Create one",
    swapTo: "/signup",
  },
  signup: {
    title: "Create account",
    blurb: `Members get ${formatBytes(TIERS.member.maxFileSize)} uploads, links that last up to 30 days, and download limits.`,
    action: "Create account",
    swapText: "Already have an account?",
    swapLabel: "Sign in",
    swapTo: "/login",
  },
} as const

export function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const copy = COPY[mode]

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErrorMsg("")

    const { error } =
      mode === "signup"
        ? await signUp.email({ email, password, name: email.split("@")[0] })
        : await signIn.email({ email, password })

    setBusy(false)
    if (error) {
      setErrorMsg(error.message ?? "That did not work. Try again.")
      return
    }
    navigate("/")
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.blurb}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="email"
              className="font-bold tracking-widest uppercase"
            >
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onValueChange={setEmail}
              disabled={busy}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="password"
              className="font-bold tracking-widest uppercase"
            >
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              required
              minLength={8}
              value={password}
              onValueChange={setPassword}
              disabled={busy}
            />
            {mode === "signup" && (
              <p className="text-[10px] text-muted-foreground">
                At least 8 characters.
              </p>
            )}
          </div>

          {errorMsg && (
            <p
              role="alert"
              className="border-2 border-destructive bg-destructive/10 px-2.5 py-2 text-xs text-foreground"
            >
              {errorMsg}
            </p>
          )}

          <Button type="submit" size="lg" disabled={busy}>
            {busy ? (
              <Loader2 className="animate-spin" />
            ) : mode === "signup" ? (
              <UserPlus />
            ) : (
              <LogIn />
            )}
            {copy.action}
          </Button>

          <p className="text-center text-[10px] text-muted-foreground">
            {copy.swapText}{" "}
            <Link
              to={copy.swapTo}
              className="font-bold text-foreground underline decoration-2 underline-offset-2"
            >
              {copy.swapLabel}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
