"use client";

import { useMemo } from "react";
import type { EnergyTargetStatus } from "@/hooks/useEnergyTargetStatus";
import type { GroupId } from "@/components/energy/Energy";

const ROOM_NAMES: Record<GroupId, string> = {
  sala: "Sala",
  "living-room": "Living Room",
  "master-bedroom": "Master Bedroom",
};

interface EnergyTargetAlertProps {
  statuses: EnergyTargetStatus[];
  onDecision: (roomId: GroupId, decision: "continue" | "pause") => Promise<boolean>;
}

export default function EnergyTargetAlert({ statuses, onDecision }: EnergyTargetAlertProps) {
  const pending = useMemo(
    () => statuses.find((item) => item.status === "target_reached" && item.decision === "pending"),
    [statuses]
  );

  if (!pending) return null;
  const roomName = ROOM_NAMES[pending.room_id];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <section role="dialog" aria-modal="true" aria-labelledby="energy-target-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="energy-target-title" className="text-lg font-semibold text-neutral-900">Monthly Energy Target Reached!</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          {roomName} has reached {pending.target_kwh.toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh this month.
          Would you like to continue monitoring or pause this room?
        </p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => onDecision(pending.room_id, "continue")} className="flex-1 rounded-full border border-neutral-300 px-3 py-2.5 text-sm font-semibold text-neutral-700">
            Continue Monitoring
          </button>
          <button type="button" onClick={() => onDecision(pending.room_id, "pause")} className="flex-1 rounded-full bg-neutral-900 px-3 py-2.5 text-sm font-semibold text-white">
            Pause Power
          </button>
        </div>
      </section>
    </div>
  );
}
