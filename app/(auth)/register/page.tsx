"use client";

import Link from "next/link";
import { User, Mail, Lock, Phone } from "lucide-react";
import AuthField from "@/components/authfield/Authentication";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { z } from "zod";

const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password is too long"),
});

export default function SignUpPage() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    // 1. Validate on the client first, before making any network request
    const result = registerSchema.safeParse({ email, password });

    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setLoading(true);

    // 2. Send only the validated, trimmed data
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.data),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }

    router.push("/login?registered=true");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-extrabold leading-tight text-orange-500">
          Let&apos;s sign you up.
        </h1>
        <p className="mt-2 text-sm text-neutral-400">Welcome.</p>

        <form onSubmit={handleSubmit} className="mt-8">
          <AuthField
            label="Email"
            icon={Mail}
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email"
            autoComplete="email"
            required
          />
          <AuthField
            label="Password"
            icon={Lock}
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoComplete="new-password"
            required
          />
          {error && <p className="text-sm text-orange-500">{error}</p>}
          <button
            type="submit"
            className="mt-2 w-full rounded-full bg-orange-500 py-4 text-sm font-semibold text-white shadow-md shadow-orange-200 transition hover:bg-orange-600 active:scale-[0.99]"
          >
            {loading ? "Creating account..." : <>Sign Up</>}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Already a member?{" "}
          <Link
            href="/login"
            className="font-semibold text-orange-500 hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
