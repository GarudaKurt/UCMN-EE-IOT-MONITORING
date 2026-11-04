"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Mail, Lock } from "lucide-react";
import AuthField from "@/components/authfield/Authentication";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function LoginPage() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: result.data.email,
      password: result.data.password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    console.log("Logged-in user id:", user?.id);
    router.push("/home");
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-extrabold leading-tight text-orange-500">
          Let&apos;s sign you in.
        </h1>
        <p className="mt-2 text-sm text-neutral-400">Welcome back.</p>

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
            autoComplete="current-password"
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="-mt-2 mb-6 text-right">
            <Link
              href="/forgot-password"
              className="text-sm font-semibold text-orange-500 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-orange-500 py-4 text-sm font-semibold text-white shadow-md shadow-red-200 transition hover:bg-red-600 active:scale-[0.99]"
          >
            {loading ? "Signing in..." : <>Login</>}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Are you new here?{" "}
          <Link
            href="/register"
            className="font-semibold text-orange-500 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
