"use client";

import type { LucideIcon } from "lucide-react";
import { Activity, Zap, Gauge, PlugZap } from "lucide-react";
import { EnergyGroup } from "../energy/Energy";

interface EnergyGroupCardProps {
  group: EnergyGroup;
  onToggle: () => void;
  disabled?: boolean;
}

const fmt = (value: number, digits: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: digits });

interface SecondaryProps {
  icon: LucideIcon;
  label: string;
  value: string;
  unit: string;
}

function Secondary({ icon: Icon, label, value, unit }: SecondaryProps) {
  return (
    <div className="min-w-0 px-3 first:pl-0 last:pr-0">
      <div className="flex items-center gap-1.5 text-xs text-[#6B7A70]">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 truncate text-base font-semibold tabular-nums text-[#14201B]">
        {value}
        <span className="ml-0.5 text-xs font-normal text-[#6B7A70]">
          {unit}
        </span>
      </p>
    </div>
  );
}

export default function EnergyGroupCard({
  group,
  onToggle,
  disabled,
}: EnergyGroupCardProps) {
  const { name, color, reading, isOn } = group;

  return (
    <section className="overflow-hidden rounded-3xl border border-[#E1E6DF] bg-white">
      {/* room colour band: the card's identity at a glance */}
      <div
        className="h-1 transition-colors"
        style={{ backgroundColor: isOn ? color : "#D4DAD2" }}
        aria-hidden="true"
      />

      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 rounded-full transition-colors"
              style={{ backgroundColor: isOn ? color : "#C5CCC3" }}
            />
            <h3 className="text-base font-semibold tracking-tight text-[#14201B]">
              {name}
            </h3>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isOn}
            aria-label={`Turn ${name} ${isOn ? "off" : "on"}`}
            onClick={onToggle}
            disabled={disabled}
            className="relative flex h-7 w-12 shrink-0 items-center overflow-hidden rounded-full p-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14201B] focus-visible:ring-offset-2 disabled:opacity-50"
            style={{ backgroundColor: isOn ? color : "#C5CCC3" }}
          >
            <span
              className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform"
              style={{ transform: isOn ? "translateX(20px)" : "translateX(0)" }}
            />
          </button>
        </div>

        <div
          className={`transition-opacity ${isOn ? "opacity-100" : "opacity-45"}`}
        >
          {/* primary reading */}
          <div className="mt-5 flex items-end justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-[#6B7A70]">
                <Zap
                  className="h-3.5 w-3.5"
                  style={{ color }}
                  aria-hidden="true"
                />
                Power
              </div>
              <p className="mt-1 text-4xl font-semibold leading-none tracking-tight tabular-nums text-[#14201B]">
                {fmt(reading.power, 1)}
                <span className="ml-1.5 text-base font-normal tracking-normal text-[#6B7A70]">
                  W
                </span>
              </p>
            </div>
          </div>

          {/* supporting readings */}
          <div className="mt-5 grid grid-cols-3 divide-x divide-[#E8ECE6] border-t border-[#E8ECE6] pt-4">
            <Secondary
              icon={Activity}
              label="Current"
              value={fmt(reading.ampere, 2)}
              unit="A"
            />
            <Secondary
              icon={PlugZap}
              label="Voltage"
              value={fmt(reading.voltage, 1)}
              unit="V"
            />
            <Secondary
              icon={Gauge}
              label="Energy"
              value={fmt(reading.energy, 2)}
              unit="kWh"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
