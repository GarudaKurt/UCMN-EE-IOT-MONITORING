"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface DailyEnergyReading {
  id: number;
  reading_date: string;
  rental_kwh: number;
  total_kwh: number; // kept equal to rental_kwh by the database
}

const TABLE = "current_kwh_readings";

function normalize(row: Record<string, unknown>): DailyEnergyReading {
  const rental = Number(row.rental_kwh ?? row.total_kwh ?? 0);
  return {
    id: Number(row.id),
    reading_date: String(row.reading_date),
    rental_kwh: rental,
    total_kwh: Number(row.total_kwh ?? rental),
  };
}

export function useDailyEnergyReadings() {
  const supabase = useMemo(() => createClient(), []);
  const [readings, setReadings] = useState<DailyEnergyReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error: fetchError } = await supabase
        .from(TABLE)
        .select("id, reading_date, rental_kwh, total_kwh")
        .order("reading_date", { ascending: true });

      if (cancelled) return;
      if (fetchError) {
        setError("Couldn’t load daily energy totals.");
      } else {
        setReadings(((data ?? []) as Record<string, unknown>[]).map(normalize));
      }
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel("current_kwh_readings_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLE },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (!row?.reading_date) return;
          setReadings((previous) => {
            const next = normalize(row);
            const withoutCurrent = previous.filter(
              (item) =>
                item.id !== next.id && item.reading_date !== next.reading_date,
            );
            return [...withoutCurrent, next].sort((a, b) =>
              a.reading_date.localeCompare(b.reading_date),
            );
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return { readings, loading, error };
}
