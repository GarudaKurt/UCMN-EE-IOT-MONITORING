"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/page-header/PageHeader";
import FormField from "@/components/form-field/FormFields";
import BottomNav from "@/components/bottom-nav/BottomNav";
import DateCalendarField from "@/components/monthcalendar-field/DateCalendarField";
import { createClient } from "@/lib/supabase/client";

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function EnergyTargetSetup() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [targetStartDate, setTargetStartDate] = useState(todayIso());
  const [targetEndDate, setTargetEndDate] = useState(todayIso());
  const [targetKwh, setTargetKwh] = useState("");
  const [ratePerKwh, setRatePerKwh] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadTarget = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("Could not load your info. Please log in again.");
        setLoading(false);
        return;
      }

      const { data: row, error: rowError } = await supabase
        .from("setup_energy")
        .select("target_start_date, target_end_date, target_kwh, rate_per_kwh")
        .eq("user_id", user.id)
        .single();

      if (rowError) {
        console.warn("No existing setup_energy row yet:", rowError.message);
      } else {
        setTargetStartDate(row?.target_start_date ?? todayIso());
        setTargetEndDate(row?.target_end_date ?? todayIso());
        setTargetKwh(row?.target_kwh != null ? String(row.target_kwh) : "");
        setRatePerKwh(
          row?.rate_per_kwh != null ? String(row.rate_per_kwh) : "",
        );
      }

      setLoading(false);
    };

    loadTarget();
  }, [supabase]);

  const totalKwh = toNumber(targetKwh);
  const totalPeso = totalKwh * toNumber(ratePerKwh);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (targetEndDate < targetStartDate) {
      setError("End date can't be before the start date.");
      return;
    }

    setSaving(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Your session expired. Please log in again.");
      setSaving(false);
      return;
    }

    const { error: upsertError } = await supabase.from("setup_energy").upsert(
      {
        user_id: user.id,
        target_start_date: targetStartDate,
        target_end_date: targetEndDate,
        target_kwh: toNumber(targetKwh),
        rate_per_kwh: toNumber(ratePerKwh),
      },
      { onConflict: "user_id" },
    );

    setSaving(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    router.push("/home");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EEF1EC]">
        <p className="text-sm text-[#6B7A70]">Loading energy target...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#EEF1EC]">
      <PageHeader title="Setup Energy Target" showBack />

      <form onSubmit={handleSave} className="flex flex-1 flex-col px-4 pt-2">
        <div className="flex flex-1 flex-col gap-3">
          {/* Target period */}
          <section className="rounded-3xl border border-[#E1E6DF] bg-white p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DateCalendarField
                label="Start Date"
                name="targetStartDate"
                value={targetStartDate}
                onChange={setTargetStartDate}
              />
              <DateCalendarField
                label="End Date"
                name="targetEndDate"
                value={targetEndDate}
                onChange={setTargetEndDate}
              />
            </div>
          </section>

          {/* Target and rate */}
          <section className="rounded-3xl border border-[#E1E6DF] bg-white p-4">
            <FormField
              label="Rental House Target (kWh)"
              name="targetKwh"
              type="text"
              inputMode="decimal"
              value={targetKwh}
              onChange={(e) => setTargetKwh(e.target.value)}
            />
            <FormField
              label="Rate (₱ per kWh)"
              name="ratePerKwh"
              type="text"
              inputMode="decimal"
              value={ratePerKwh}
              onChange={(e) => setRatePerKwh(e.target.value)}
            />
          </section>

          {/* Summary */}
          <section
            className="rounded-3xl bg-[#2c2c2c] p-5 text-[#E9EFE9]"
            aria-label="Target summary"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-[#9DB0A5]">Estimated cost</span>
              <span className="text-3xl font-semibold tracking-tight tabular-nums">
                ₱
                {totalPeso.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#9DB0A5]">Total target</span>
                <span className="text-sm font-semibold tabular-nums">
                  {totalKwh.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{" "}
                  kWh
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#9DB0A5]">Start date</span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatDate(targetStartDate)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#9DB0A5]">End date</span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatDate(targetEndDate)}
                </span>
              </div>
            </div>
          </section>

          {error && (
            <p
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-4 pb-[100px] sm:pb-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded-2xl border border-[#CBD3CA] py-3.5 text-sm font-semibold text-[#14201B] transition-colors hover:bg-[#E8ECE6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14201B] focus-visible:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-2xl bg-[#14201B] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#22332B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14201B] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
      <BottomNav />
    </div>
  );
}
