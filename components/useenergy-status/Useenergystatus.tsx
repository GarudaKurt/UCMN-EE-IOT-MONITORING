"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ENERGY_GROUP_DEFS,
  EnergyGroup,
  GroupId,
  SENSOR_TO_GROUP,
} from "../energy/Energy";

const LIVE_TABLE = "live_sensor_readings";
const TOGGLE_TABLE = "pzem_status";
const DEVICE_ID = "esp32-iot-meter";

interface LiveSensorRow {
  device_id?: string;
  sensor?: string;
  voltage_v?: number | string | null;
  current_a?: number | string | null;
  voltage?: number | string | null;
  current?: number | string | null;
  power_w?: number | string | null;
  energy_kwh?: number | string | null;
  recorded_at?: string | null;
  updated_at?: string | null;
}

interface ToggleRow {
  group_id?: string;
  is_on?: boolean | null;
}

function toGroups(
  liveRows: LiveSensorRow[],
  toggleRows: ToggleRow[],
): EnergyGroup[] {
  return ENERGY_GROUP_DEFS.map((def) => {
    const matchingRows = liveRows.filter(
      (row) => SENSOR_TO_GROUP[row.sensor ?? ""] === def.id,
    );
    const liveRow = matchingRows.sort(
      (a, b) =>
        new Date(b.updated_at ?? b.recorded_at ?? 0).getTime() -
        new Date(a.updated_at ?? a.recorded_at ?? 0).getTime(),
    )[0];
    const toggleRow = toggleRows.find((row) => row.group_id === def.id);

    return {
      id: def.id,
      name: def.name,
      color: def.color,
      isOn: toggleRow?.is_on ?? false,
      reading: {
        voltage: Number(liveRow?.voltage_v ?? liveRow?.voltage ?? 0),
        ampere: Number(liveRow?.current_a ?? liveRow?.current ?? 0),
        power: Number(liveRow?.power_w ?? 0),
        energy: Number(liveRow?.energy_kwh ?? 0),
      },
      updatedAt: liveRow?.updated_at ?? liveRow?.recorded_at ?? undefined,
    };
  });
}

export function useEnergyStatus() {
  const supabase = useMemo(() => createClient(), []);
  const [groups, setGroups] = useState<EnergyGroup[]>(toGroups([], []));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const togglingRef = useRef<Set<GroupId>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let liveChannel: ReturnType<typeof supabase.channel> | null = null;
    let toggleChannel: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      const [
        { data: liveRows, error: liveError },
        { data: toggleRows, error: toggleError },
      ] = await Promise.all([
        supabase
          .from(LIVE_TABLE)
          .select(
            "device_id, sensor, voltage_v, current_a, voltage, current, power_w, energy_kwh, recorded_at, updated_at",
          )
          .eq("device_id", DEVICE_ID),
        supabase.from(TOGGLE_TABLE).select("group_id, is_on"),
      ]);

      if (cancelled) return;

      if (liveError || toggleError) {
        setError("Could not load live readings.");
      } else {
        setGroups(
          toGroups(
            (liveRows ?? []) as LiveSensorRow[],
            (toggleRows ?? []) as ToggleRow[],
          ),
        );
      }
      setLoading(false);
    };

    load();

    liveChannel = supabase
      .channel("live_sensor_readings_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: LIVE_TABLE },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const row = payload.new as LiveSensorRow | null;
          const groupId = SENSOR_TO_GROUP[row?.sensor ?? ""];
          if (!groupId) return;

          setGroups((prev) =>
            prev.map((group) => {
              if (group.id !== groupId) return group;
              const incomingAt =
                row?.updated_at ?? row?.recorded_at ?? undefined;
              if (
                incomingAt &&
                group.updatedAt &&
                new Date(incomingAt).getTime() <
                  new Date(group.updatedAt).getTime()
              ) {
                return group;
              }
              return {
                ...group,
                updatedAt: incomingAt ?? group.updatedAt,
                reading: {
                  voltage: Number(
                    row?.voltage_v ?? row?.voltage ?? group.reading.voltage,
                  ),
                  ampere: Number(
                    row?.current_a ?? row?.current ?? group.reading.ampere,
                  ),
                  power: Number(row?.power_w ?? group.reading.power),
                  energy: Number(row?.energy_kwh ?? group.reading.energy),
                },
              };
            }),
          );
        },
      )
      .subscribe();

    toggleChannel = supabase
      .channel("pzem_status_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TOGGLE_TABLE },
        (payload) => {
          const row = (payload.new ?? payload.old) as ToggleRow | null;
          if (
            !row?.group_id ||
            !ENERGY_GROUP_DEFS.some((def) => def.id === row.group_id)
          )
            return;
          const groupId = row.group_id as GroupId;
          togglingRef.current.delete(groupId);
          setGroups((prev) =>
            prev.map((group) =>
              group.id === groupId
                ? { ...group, isOn: row.is_on ?? group.isOn }
                : group,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (liveChannel) supabase.removeChannel(liveChannel);
      if (toggleChannel) supabase.removeChannel(toggleChannel);
    };
  }, [supabase]);

  const toggleGroup = async (id: GroupId) => {
    const current = groups.find((group) => group.id === id);
    if (!current || togglingRef.current.has(id)) return;

    const nextOn = !current.isOn;
    togglingRef.current.add(id);
    setGroups((prev) =>
      prev.map((group) =>
        group.id === id ? { ...group, isOn: nextOn } : group,
      ),
    );
    setError(null);

    // Use the secured RPC rather than a direct table update. The RPC validates
    // the authenticated caller and only permits the known relay group/state.
    const { error: updateError } = await supabase.rpc("set_pzem_ssr_state", {
      p_group_id: id,
      p_is_on: nextOn,
    });

    if (updateError) {
      setError(`Could not switch ${current.name}. Please try again.`);
      setGroups((prev) =>
        prev.map((group) =>
          group.id === id ? { ...group, isOn: !nextOn } : group,
        ),
      );
      togglingRef.current.delete(id);
    }
  };

  return { groups, loading, error, toggleGroup };
}
