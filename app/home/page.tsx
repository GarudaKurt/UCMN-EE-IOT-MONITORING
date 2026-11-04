"use client";

import HomeHeader from "@/components/home-header/HomeHeader";
import BottomNav from "@/components/bottom-nav/BottomNav";
import { useEnergyStatus } from "@/components/useenergy-status/Useenergystatus";
import EnergyGroupCard from "@/components/energygroup-card/Energygroupcard";
import EnergyTargetAlert from "@/components/energy-target-alert/EnergyTargetAlert";
import { useEnergyTargetStatus } from "@/hooks/useEnergyTargetStatus";

export default function EnergyPage() {
  const { groups, loading, error, toggleGroup } = useEnergyStatus();
  const { statuses, error: targetError, decide } = useEnergyTargetStatus();

  const totalPower = groups.reduce(
    (sum, g) => sum + (g.isOn ? g.reading.power : 0),
    0,
  );
  const totalEnergy = groups.reduce((sum, g) => sum + g.reading.energy, 0);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EEF1EC]">
        <p className="text-sm text-[#6B7A70]">Loading meters...</p>
      </div>
    );
  }

  const isLive = totalPower > 0;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <main className="flex flex-1 flex-col gap-4 px-4 pb-6 pt-4">
        {/* Live readings: total draw, with each room's share of it */}
        <section
          className="rounded-3xl bg-[#2C2C2C] p-5 text-[#E9EFE9]"
          aria-label="Live readings"
        >
          <div className="flex items-center gap-2 text-sm text-[#9DB0A5]">
            <span className="relative flex h-2 w-2">
              {isLive && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#7BE0A4] opacity-60 motion-safe:animate-ping" />
              )}
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ backgroundColor: isLive ? "#7BE0A4" : "#5C6F64" }}
              />
            </span>
            Live Readings
          </div>

          <p className="mt-3 flex items-baseline text-5xl font-semibold leading-none tracking-tight tabular-nums">
            {totalPower.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            <span className="ml-2 text-lg font-normal tracking-normal text-[#9DB0A5]">
              W
            </span>
          </p>

          {/* share of current draw per room */}
          <div
            className="mt-5 flex h-2 gap-0.5 overflow-hidden rounded-full bg-white/10"
            aria-hidden="true"
          >
            {isLive &&
              groups
                .filter((g) => g.isOn && g.reading.power > 0)
                .map((g) => (
                  <span
                    key={g.id}
                    className="h-full transition-all"
                    style={{
                      width: `${(g.reading.power / totalPower) * 100}%`,
                      backgroundColor: g.color,
                    }}
                  />
                ))}
          </div>

          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#B7C5BC]">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: g.isOn ? g.color : "#5C6F64" }}
                />
                {g.name}
              </li>
            ))}
          </ul>

          <p className="mt-5 border-t border-white/10 pt-4 text-sm text-[#9DB0A5]">
            <span className="font-semibold tabular-nums text-[#E9EFE9]">
              {totalEnergy.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </span>{" "}
            kWh consumed total
          </p>
        </section>

        {(error || targetError) && (
          <p
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {error ?? targetError}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <EnergyGroupCard
              key={group.id}
              group={group}
              onToggle={() => toggleGroup(group.id)}
            />
          ))}
        </div>
      </main>

      <BottomNav />
      <EnergyTargetAlert statuses={statuses} onDecision={decide} />
    </div>
  );
}
