"use client";

import { useMemo } from "react";
import { Zap } from "lucide-react";
import type { EnergyTargetStatus } from "@/hooks/useEnergyTargetStatus";
import type { GroupId } from "@/components/energy/Energy";

const ROOM_NAMES: Record<GroupId, string> = {
  sala: "Sala",
  "living-room": "Living Room",
  "master-bedroom": "Master Bedroom",
};

interface EnergyTargetAlertProps {
  statuses: EnergyTargetStatus[];
  onDecision: (
    roomId: GroupId,
    decision: "continue" | "pause",
  ) => Promise<boolean>;
}

export default function EnergyTargetAlert({
  statuses,
  onDecision,
}: EnergyTargetAlertProps) {
  const pending = useMemo(
    () =>
      statuses.find(
        (item) =>
          item.status === "target_reached" && item.decision === "pending",
      ),
    [statuses],
  );

  if (!pending) return null;
  const roomName = ROOM_NAMES[pending.room_id];
  const target = pending.target_kwh.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#14201B]/55 backdrop-blur-[2px] sm:items-center sm:px-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="energy-target-title"
        className="w-full max-w-md rounded-t-3xl bg-white px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:pt-6"
      >
        {/* grab handle (mobile sheet affordance) */}
        <div
          className="mx-auto mb-5 h-1 w-10 rounded-full bg-[#DDE3DC] sm:hidden"
          aria-hidden="true"
        />

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFE9B8] text-[#8A5A00]">
          <Zap className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
        </div>

        <h2
          id="energy-target-title"
          className="mt-4 text-xl font-semibold tracking-tight text-[#14201B]"
        >
          Monthly Energy Target Reached!
        </h2>

        <p className="mt-2 text-[15px] leading-6 text-[#56655C]">
          <span className="font-semibold text-[#14201B]">{roomName}</span> has
          reached{" "}
          <span className="font-semibold tabular-nums text-[#14201B]">
            {target} kWh
          </span>{" "}
          this month. Would you like to continue monitoring or pause this room?
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onDecision(pending.room_id, "continue")}
            className="rounded-2xl border border-[#CBD3CA] px-3 py-3.5 text-sm font-semibold text-[#14201B] transition-colors hover:bg-[#F2F4F0] active:bg-[#E8ECE6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14201B] focus-visible:ring-offset-2"
          >
            Continue Monitoring
          </button>
          <button
            type="button"
            onClick={() => onDecision(pending.room_id, "pause")}
            className="rounded-2xl bg-[#14201B] px-3 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#22332B] active:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14201B] focus-visible:ring-offset-2"
          >
            Pause Power
          </button>
        </div>
      </section>
    </div>
  );
}
