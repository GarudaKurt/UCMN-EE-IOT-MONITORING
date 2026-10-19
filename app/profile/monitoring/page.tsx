"use client";

import { BedDouble, Sofa, Armchair } from "lucide-react";
import HomeHeader from "@/components/home-header/HomeHeader";
import BottomNav from "@/components/bottom-nav/BottomNav";
import RoomEnergyCard from "@/components/romeenergy-card/RomeenergyCard";
import { useDailyEnergyReadings } from "@/hooks/useDailyEnergyReadings";
import { useEnergyTargetStatus } from "@/hooks/useEnergyTargetStatus";
import type { GroupId } from "@/components/energy/Energy";

// Map each PZEM meter's device_id (as stored in sensors.device_id) to a room.
// Update the deviceId values to match what your nodered flow writes.
const ROOMS = [
  {
    id: "master-bedroom",
    label: "Master Bedroom",
    deviceId: "PZEM-MASTER-BEDROOM",
    icon: BedDouble,
    accent: {
      chipBg: "bg-indigo-50",
      chipText: "text-indigo-600",
      ring: "ring-indigo-300",
      dot: "bg-indigo-500",
    },
  },
  {
    id: "sala",
    label: "Sala",
    deviceId: "PZEM-SALA",
    icon: Sofa,
    accent: {
      chipBg: "bg-amber-50",
      chipText: "text-amber-700",
      ring: "ring-amber-300",
      dot: "bg-amber-500",
    },
  },
  {
    id: "living-room",
    label: "Living Room",
    deviceId: "PZEM-LIVING-ROOM",
    icon: Armchair,
    accent: {
      chipBg: "bg-emerald-50",
      chipText: "text-emerald-700",
      ring: "ring-emerald-300",
      dot: "bg-emerald-500",
    },
  },
];

export default function EnergyHistoryPage() {
  const { readings, loading, error } = useDailyEnergyReadings();
  const { statuses, error: targetError } = useEnergyTargetStatus();
  const roomTotals = ROOMS.map((room) => ({
    ...room,
    total: readings.reduce((sum, reading) => {
      if (room.id === "sala") return sum + reading.sala_kwh;
      if (room.id === "living-room") return sum + reading.living_kwh;
      return sum + reading.master_kwh;
    }, 0),
  }));
  const overallTotal = readings.reduce((sum, reading) => sum + reading.total_kwh, 0);

  return (
    <div className="flex min-h-screen flex-col bg-neutral-100">
      <HomeHeader name="Energy History" hasNotification={false} />

      <main className="flex flex-1 flex-col gap-4 px-4 pb-6 pt-4">
        <p className="text-xs text-neutral-500">
          Sensor reading history and energy totals for each monitored room.
        </p>

        {(error || targetError) && <p className="text-sm font-medium text-red-600">{error ?? targetError}</p>}

        <section className="rounded-2xl bg-neutral-900 p-4 text-white">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-400">Overall total</p>
            <p className="text-lg font-semibold tabular-nums">
              {overallTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh
            </p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {roomTotals.map((room) => (
              <div key={room.id} className="rounded-xl bg-white/10 p-2">
                <p className="text-[11px] text-neutral-300">{room.label}</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">
                  {room.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Monthly target status</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {ROOMS.map((room) => {
              const target = statuses.find((item) => item.room_id === (room.id as GroupId));
              const remaining = Math.max(0, (target?.target_kwh ?? 0) - (target?.consumed_kwh ?? 0));
              const label = target?.status === "paused"
                ? "Paused"
                : target?.status === "target_reached"
                  ? "Target Reached"
                  : "Within Target";
              return (
                <div key={room.id} className="rounded-xl bg-neutral-50 p-3">
                  <p className="text-xs font-medium text-neutral-600">{room.label}</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">{label}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {target?.consumed_kwh.toFixed(2) ?? "0.00"} / {target?.target_kwh.toFixed(2) ?? "0.00"} kWh
                  </p>
                  <p className="text-xs text-neutral-500">{remaining.toFixed(2)} kWh remaining</p>
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex flex-col gap-3">
          {ROOMS.map((room) => (
            <RoomEnergyCard
              key={room.id}
              room={room}
              readings={readings}
              loading={loading}
              error={error}
            />
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
