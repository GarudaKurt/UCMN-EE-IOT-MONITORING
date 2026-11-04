"use client";

import { useState } from "react";
import { House } from "lucide-react";
import BottomNav from "@/components/bottom-nav/BottomNav";
import RoomEnergyCard from "@/components/romeenergy-card/RomeenergyCard";
import { useDailyEnergyReadings } from "@/hooks/useDailyEnergyReadings";
import { useEnergyTargetStatus } from "@/hooks/useEnergyTargetStatus";
import type { GroupId } from "@/components/energy/Energy";

// The single metered room. `id` must match GroupId and the room_id stored in
// energy_target_status. `deviceId` must match the device_id your Node-RED flow
// writes, if RoomEnergyCard uses it.
const ROOMS: {
  id: GroupId;
  label: string;
  deviceId: string;
  icon: typeof House;
  accent: { chipBg: string; chipText: string; ring: string; dot: string };
}[] = [
  {
    id: "rental-house",
    label: "Rental House",
    deviceId: "PZEM-RENTAL",
    icon: House,
    accent: {
      chipBg: "bg-amber-50",
      chipText: "text-amber-700",
      ring: "ring-amber-300",
      dot: "bg-amber-500",
    },
  },
];

const fmt = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function EnergyHistoryPage() {
  const { readings, loading, error } = useDailyEnergyReadings();
  const { statuses, error: targetError, decide } = useEnergyTargetStatus();
  const [savingRoom, setSavingRoom] = useState<GroupId | null>(null);

  // Switch ON = continue monitoring, OFF = pause power.
  const handleToggle = async (roomId: GroupId, shouldContinue: boolean) => {
    setSavingRoom(roomId);
    await decide(roomId, shouldContinue ? "continue" : "pause");
    setSavingRoom(null);
  };

  const roomTotals = ROOMS.map((room) => ({
    ...room,
    total: readings.reduce((sum, reading) => sum + reading.rental_kwh, 0),
  }));
  const overallTotal = readings.reduce(
    (sum, reading) => sum + reading.rental_kwh,
    0,
  );

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <main className="flex flex-1 flex-col gap-4 px-4 pb-6 pt-4">
        {(error || targetError) && (
          <p
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {error ?? targetError}
          </p>
        )}

        <section
          className="rounded-3xl bg-[#14201B] p-5 text-[#E9EFE9]"
          aria-label="Overall total"
        >
          <p className="text-sm text-[#9DB0A5]">Overall total</p>
          <p className="mt-2 text-4xl font-semibold leading-none tracking-tight tabular-nums">
            {fmt(overallTotal)}
            <span className="ml-2 text-base font-normal tracking-normal text-[#9DB0A5]">
              kWh
            </span>
          </p>

          <ul className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-4">
            {roomTotals.map((room) => (
              <li
                key={room.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-[#B7C5BC]">{room.label}</span>
                <span className="font-semibold tabular-nums">
                  {fmt(room.total)} kWh
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-[#E1E6DF] bg-white p-4">
          <h2 className="text-base font-semibold tracking-tight text-[#14201B]">
            Monthly target status
          </h2>
          <div className="mt-3 grid gap-2">
            {ROOMS.map((room) => {
              const target = statuses.find((item) => item.room_id === room.id);
              const targetKwh = target?.target_kwh ?? 0;
              const consumedKwh = target?.consumed_kwh ?? 0;
              const remaining = Math.max(0, targetKwh - consumedKwh);
              const progress =
                targetKwh > 0
                  ? Math.min(100, (consumedKwh / targetKwh) * 100)
                  : 0;
              const label =
                target?.status === "paused"
                  ? "Paused"
                  : target?.status === "target_reached"
                    ? "Target Reached"
                    : "Within Target";
              const reached = target?.status === "target_reached";
              // The toggle appears once the target has been reached. Pause is
              // the default: it only reads "Continue" after the user chose it.
              const canDecide =
                target?.status === "target_reached" ||
                target?.status === "paused";
              const isContinuing = target?.decision === "continue";
              const isSaving = savingRoom === room.id;
              return (
                <div key={room.id} className="rounded-2xl bg-[#F4F6F2] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#56655C]">
                      {room.label}
                    </p>
                    <p
                      className={`text-sm font-semibold ${
                        reached ? "text-[#B45309]" : "text-[#14201B]"
                      }`}
                    >
                      {label}
                    </p>
                  </div>

                  <div
                    className="mt-3 h-2 overflow-hidden rounded-full bg-[#DDE3DC]"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress)}
                    aria-label={`${room.label} target progress`}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: reached ? "#D97706" : "#2F9E6B",
                      }}
                    />
                  </div>

                  <p className="mt-3 text-sm tabular-nums text-[#14201B]">
                    {consumedKwh.toFixed(2)} / {targetKwh.toFixed(2)} kWh
                  </p>
                  <p className="text-xs tabular-nums text-[#6B7A70]">
                    {remaining.toFixed(2)} kWh remaining
                  </p>

                  {canDecide && (
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#DDE3DC] pt-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#14201B]">
                          {isContinuing ? "Continue monitoring" : "Pause power"}
                        </p>
                        <p className="text-xs text-[#6B7A70]">
                          {isContinuing
                            ? "Power stays on past your target. Switch off to pause."
                            : target?.decision === "pause"
                              ? "Power is paused. Switch on to continue."
                              : "Paused automatically when the target was reached. Switch on to continue."}
                        </p>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={isContinuing}
                        aria-label={
                          isContinuing
                            ? `Pause ${room.label}`
                            : `Continue monitoring ${room.label}`
                        }
                        onClick={() => handleToggle(room.id, !isContinuing)}
                        disabled={isSaving}
                        className="relative flex h-7 w-12 shrink-0 items-center overflow-hidden rounded-full p-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14201B] focus-visible:ring-offset-2 disabled:opacity-50"
                        style={{
                          backgroundColor: isContinuing ? "#2F9E6B" : "#C5CCC3",
                        }}
                      >
                        <span
                          className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform"
                          style={{
                            transform: isContinuing
                              ? "translateX(20px)"
                              : "translateX(0)",
                          }}
                        />
                      </button>
                    </div>
                  )}
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
