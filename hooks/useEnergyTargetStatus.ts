"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GroupId } from "@/components/energy/Energy";

export type TargetStatus = "within_target" | "target_reached" | "paused";
export type TargetDecision = "pending" | "continue" | "pause";

export interface EnergyTargetStatus {
  id: number;
  user_id: string;
  room_id: GroupId;
  month_start: string;
  target_kwh: number;
  consumed_kwh: number;
  status: TargetStatus;
  decision: TargetDecision;
  reached_at: string | null;
  notified_at: string | null;
  decided_at: string | null;
  paused_at: string | null;
}

const TABLE = "energy_target_status";

function monthStartInManila(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}-01`;
}

function normalize(row: Record<string, unknown>): EnergyTargetStatus {
  return {
    id: Number(row.id),
    user_id: String(row.user_id),
    room_id: row.room_id as GroupId,
    month_start: String(row.month_start),
    target_kwh: Number(row.target_kwh ?? 0),
    consumed_kwh: Number(row.consumed_kwh ?? 0),
    status: row.status as TargetStatus,
    decision: row.decision as TargetDecision,
    reached_at: (row.reached_at as string | null) ?? null,
    notified_at: (row.notified_at as string | null) ?? null,
    decided_at: (row.decided_at as string | null) ?? null,
    paused_at: (row.paused_at as string | null) ?? null,
  };
}

export function useEnergyTargetStatus() {
  const supabase = useMemo(() => createClient(), []);
  const [statuses, setStatuses] = useState<EnergyTargetStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (cancelled) return;
      if (authError || !authData.user) {
        setError("Could not load energy target status.");
        setLoading(false);
        return;
      }

      const monthStart = monthStartInManila();
      await supabase.rpc("refresh_energy_target_status", { p_month_start: monthStart });
      const { data, error: statusError } = await supabase
        .from(TABLE)
        .select("id, user_id, room_id, month_start, target_kwh, consumed_kwh, status, decision, reached_at, notified_at, decided_at, paused_at")
        .eq("user_id", authData.user.id)
        .eq("month_start", monthStart)
        .order("room_id");

      if (cancelled) return;
      if (statusError) setError("Could not load energy target status.");
      else setStatuses(((data ?? []) as Record<string, unknown>[]).map(normalize));
      setLoading(false);

      channel = supabase
        .channel("energy_target_status_changes")
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: TABLE,
          filter: `user_id=eq.${authData.user.id}`,
        }, (payload) => {
          if (payload.eventType === "DELETE") {
            setStatuses((current) => current.filter((item) => item.id !== Number(payload.old?.id)));
            return;
          }
          const next = normalize(payload.new as Record<string, unknown>);
          if (next.month_start !== monthStart) return;
          setStatuses((current) => [...current.filter((item) => item.id !== next.id), next].sort((a, b) => a.room_id.localeCompare(b.room_id)));
        })
        .subscribe();
    };

    load();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase]);

  const decide = useCallback(async (roomId: GroupId, decision: Exclude<TargetDecision, "pending">) => {
    setError(null);
    const status = decision === "pause" ? "paused" : "target_reached";

    if (decision === "pause") {
      const { error: toggleError } = await supabase
        .from("pzem_status")
        .update({ is_on: false })
        .eq("group_id", roomId);
      if (toggleError) {
        setError("The room could not be paused.");
        return false;
      }
    }

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setError("Your session expired. Please log in again.");
      return false;
    }

    const { error: updateError } = await supabase
      .from(TABLE)
      .update({
        decision,
        status,
        decided_at: new Date().toISOString(),
        paused_at: decision === "pause" ? new Date().toISOString() : null,
      })
      .eq("user_id", authData.user.id)
      .eq("room_id", roomId)
      .eq("month_start", monthStartInManila());

    if (updateError) {
      setError("Could not save your energy target decision.");
      return false;
    }
    return true;
  }, [supabase]);

  return { statuses, loading, error, decide };
}
