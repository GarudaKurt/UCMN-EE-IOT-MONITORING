"use client";

import { Activity, Zap, Gauge, PlugZap } from "lucide-react";
import MetricCard from "@/components/metric-card/MetricCard";
import { EnergyGroup } from "../energy/Energy";

interface EnergyGroupCardProps {
  group: EnergyGroup;
  onToggle: () => void;
  disabled?: boolean;
}

export default function EnergyGroupCard({ group, onToggle, disabled }: EnergyGroupCardProps) {
  const { name, color, reading, isOn } = group;

  return (
    <section
      className="rounded-2xl bg-neutral-50 p-3"
      style={{ boxShadow: `inset 3px 0 0 0 ${color}` }}
    >
      <div className="flex items-center justify-between px-1 pb-3">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: isOn ? color : "#D4D4D4" }}
          />
          <h3 className="text-sm font-semibold text-neutral-900">{name}</h3>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          aria-label={`Turn ${name} ${isOn ? "off" : "on"}`}
          onClick={onToggle}
          disabled={disabled}
          className="relative flex h-6 w-11 shrink-0 items-center overflow-hidden rounded-full p-0 transition-colors disabled:opacity-50"
          style={{ backgroundColor: isOn ? color : "#D4D4D4" }}
        >
          <span
            className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
            style={{ transform: isOn ? "translateX(20px)" : "translateX(0)" }}
          />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <MetricCard icon={Activity} label="Current" value={reading.ampere} unit="A" accent={color} dim={!isOn} />
        <MetricCard icon={PlugZap} label="Voltage" value={reading.voltage} unit="V" accent={color} dim={!isOn} />
        <MetricCard icon={Zap} label="Power" value={reading.power} unit="W" accent={color} dim={!isOn} />
        <MetricCard icon={Gauge} label="Energy" value={reading.energy} unit="kWh" accent={color} dim={!isOn} />
      </div>
    </section>
  );
}
