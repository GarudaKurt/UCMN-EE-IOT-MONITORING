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

  const totalPower = groups.reduce((sum, g) => sum + (g.isOn ? g.reading.power : 0), 0);
  const totalEnergy = groups.reduce((sum, g) => sum + g.reading.energy, 0);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100">
        <p className="text-sm text-neutral-500">Loading meters...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-100">
      <HomeHeader name="Energy Monitor" hasNotification={false} />

      <main className="flex flex-1 flex-col gap-4 px-4 pb-6 pt-4">
        <div className="rounded-2xl bg-neutral-900 px-4 py-4 text-white">
          <p className="text-xs text-neutral-400">Right now, across 3 rooms</p>
          <p className="mt-1 text-2xl font-semibold">
            {totalPower.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            <span className="ml-1 text-sm font-normal text-neutral-400">W</span>
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            {totalEnergy.toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh consumed total
          </p>
        </div>

        {(error || targetError) && <p className="text-sm font-medium text-red-600">{error ?? targetError}</p>}

        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <EnergyGroupCard key={group.id} group={group} onToggle={() => toggleGroup(group.id)} />
          ))}
        </div>
      </main>

      <BottomNav />
      <EnergyTargetAlert statuses={statuses} onDecision={decide} />
    </div>
  );
}
