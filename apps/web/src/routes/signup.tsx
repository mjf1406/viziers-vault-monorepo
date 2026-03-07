// TODO: Schema and auth flow must remain compatible with restricting signup later
// (e.g. first user becomes owner/GM, subsequent users invite-only or approval-based).
import { createFileRoute, Link } from "@tanstack/react-router"
import { signUp } from "@/lib/auth-client"
import { useState } from "react"

export const Route = createFileRoute("/signup")({ component: SignupPage })

function SignupPage() {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const res = await signUp.email({ email, password, name })
    if (res.error) {
      setError(res.error.message ?? "Sign up failed")
      return
    }
    window.location.href = "/"
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-lg font-medium">Sign up</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded border px-3 py-2"
        />
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="rounded border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          Sign up
        </button>
        <p className="text-sm">
          Already have an account? <Link to="/login" className="underline">Log in</Link>
        </p>
      </form>
    </div>
  )
}
