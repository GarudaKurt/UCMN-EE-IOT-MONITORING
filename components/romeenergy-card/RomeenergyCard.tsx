"use client";

import { useMemo, useState, useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import type { DailyEnergyReading } from "@/hooks/useDailyEnergyReadings";

export interface RoomConfig {
  id: string;
  label: string;
  /** value stored in sensors.device_id for this PZEM meter */
  deviceId: string;
  icon: LucideIcon;
  /** muted accent used for this room's icon chip + calendar highlights */
  accent: {
    chipBg: string;
    chipText: string;
    ring: string;
    dot: string;
  };
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function manilaDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatKwh(value: number) {
  return (Object.is(value, -0) ? 0 : value).toFixed(3);
}

/** Sunday-first, blank-padded grid of the given month, nulls outside the month */
function buildMonthGrid(viewMonth: Date): (Date | null)[][] {
  const first = startOfMonth(viewMonth);
  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0,
  ).getDate();
  const leadingBlanks = first.getDay(); // 0 = Sunday

  const cells: (Date | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

interface RoomEnergyCardProps {
  room: RoomConfig;
  readings: DailyEnergyReading[];
  loading: boolean;
  error: string | null;
}

export default function RoomEnergyCard({
  room,
  readings,
  loading,
  error,
}: RoomEnergyCardProps) {
  const Icon = room.icon;

  const [expanded, setExpanded] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const todayKey = manilaDateKey();

  // One entry per day. The rental house is the only meter, so every row in
  // current_kwh_readings belongs to this card.
  const dailyReadings = useMemo(
    () =>
      readings.map((reading) => ({
        kWh: reading.rental_kwh,
        date: reading.reading_date,
      })),
    [readings],
  );

  const monthPrefix = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, "0")}`;

  // Totals for the month being viewed (drives the calendar cells and month total).
  const dailyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const reading of dailyReadings) {
      if (!reading.date.startsWith(monthPrefix)) continue;
      totals.set(reading.date, (totals.get(reading.date) ?? 0) + reading.kWh);
    }
    return totals;
  }, [dailyReadings, monthPrefix]);

  // Today's usage must not depend on which month the calendar is showing.
  const todayTotal = useMemo(
    () =>
      dailyReadings
        .filter((reading) => reading.date === todayKey)
        .reduce((sum, reading) => sum + reading.kWh, 0),
    [dailyReadings, todayKey],
  );

  const monthTotal = useMemo(
    () => Array.from(dailyTotals.values()).reduce((sum, v) => sum + v, 0),
    [dailyTotals],
  );

  // Table lists only the month being viewed, newest first.
  const tableRows = useMemo(
    () =>
      dailyReadings
        .filter((reading) => reading.date.startsWith(monthPrefix))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [dailyReadings, monthPrefix],
  );

  const weeks = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

  const goToMonth = useCallback((offset: number) => {
    setViewMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1),
    );
    setSelectedDay(null);
  }, []);

  return (
    <div className="overflow-hidden rounded-3xl border border-[#E1E6DF] bg-white">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#14201B]"
      >
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${room.accent.chipBg}`}
        >
          <Icon
            className={`h-5 w-5 ${room.accent.chipText}`}
            strokeWidth={1.75}
          />
        </span>

        <span className="flex-1">
          <span className="block text-base font-semibold tracking-tight text-[#14201B]">
            {room.label}
          </span>
          <span className="block text-xs text-[#6B7A70]">
            Today&apos;s usage
          </span>
        </span>

        <span className="text-right">
          <span className="block text-2xl font-semibold tracking-tight tabular-nums text-[#14201B]">
            {formatKwh(todayTotal)}
            <span className="ml-1 text-xs font-normal tracking-normal text-[#6B7A70]">
              kWh
            </span>
          </span>
        </span>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#8A988F] transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className="border-t border-[#E8ECE6] px-4 pb-4 pt-3">
          {error ? (
            <p role="alert" className="py-4 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => goToMonth(-1)}
                  aria-label="Previous month"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-[#56655C] hover:bg-[#F2F4F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14201B]"
                >
                  ‹
                </button>
                <span className="text-sm font-semibold text-[#14201B]">
                  {monthLabel(viewMonth)}
                </span>
                <button
                  type="button"
                  onClick={() => goToMonth(1)}
                  aria-label="Next month"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-[#56655C] hover:bg-[#F2F4F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14201B]"
                >
                  ›
                </button>
              </div>

              {/* Calendar — each cell shows only the day's kWh total */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAY_LABELS.map((w, i) => (
                  <div key={i} className="pb-1 text-[11px] text-[#8A988F]">
                    {w}
                  </div>
                ))}

                {weeks.flatMap((week, wi) =>
                  week.map((day, di) => {
                    if (!day) return <div key={`${wi}-${di}`} />;
                    const key = dateKey(day);
                    const kwh = dailyTotals.get(key);
                    const isToday = key === todayKey;
                    const isSelected = key === selectedDay;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          setSelectedDay(key === selectedDay ? null : key)
                        }
                        aria-pressed={isSelected}
                        className={`flex flex-col items-center rounded-xl py-1.5 text-[11px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14201B] ${
                          isSelected
                            ? `${room.accent.chipBg} ${room.accent.chipText}`
                            : "text-[#2A3A32] hover:bg-[#F2F4F0]"
                        } ${isToday && !isSelected ? `ring-1 ${room.accent.ring}` : ""}`}
                      >
                        <span>{day.getDate()}</span>
                        <span
                          className={`mt-0.5 tabular-nums ${kwh !== undefined ? "font-medium" : "text-[#C5CCC3]"}`}
                        >
                          {kwh !== undefined ? formatKwh(kwh) : "–"}
                        </span>
                      </button>
                    );
                  }),
                )}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#F4F6F2] px-4 py-3 text-sm">
                <span className="text-[#56655C]">Month total</span>
                <span className="font-semibold tabular-nums text-[#14201B]">
                  {formatKwh(monthTotal)}{" "}
                  kWh
                </span>
              </div>

              <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-[#E8ECE6]">
                {loading ? (
                  <p className="px-3 py-6 text-center text-sm text-[#6B7A70]">
                    Loading…
                  </p>
                ) : tableRows.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-[#6B7A70]">
                    No readings recorded this month.
                  </p>
                ) : (
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#E8ECE6] text-[#8A988F]">
                        <th className="px-3 py-2 text-xs font-medium">Date</th>
                        <th className="px-3 py-2 text-right text-xs font-medium">
                          kWh
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((reading) => {
                        // Daily totals have no time of day, so only the date is shown.
                        const d = new Date(`${reading.date}T12:00:00+08:00`);
                        const isSelected = reading.date === selectedDay;
                        return (
                          <tr
                            key={reading.date}
                            className={`border-b border-[#F0F3EE] last:border-0 ${
                              isSelected ? room.accent.chipBg : ""
                            }`}
                          >
                            <td className="px-3 py-2.5 text-[#2A3A32]">
                              {d.toLocaleDateString(undefined, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium tabular-nums text-[#14201B]">
                              {formatKwh(reading.kWh)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
