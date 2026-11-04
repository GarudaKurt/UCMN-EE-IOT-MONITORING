// Adjust these to match your actual Supabase schema.
// Assumed table: "pzem_status"
//   id          uuid / bigint (pk)
//   group_id    text            -- 'sala' | 'living-room' | 'master-bedroom'
//   ampere      numeric         -- live current reading, in Amps
//   power       numeric         -- live power reading, in Watts
//   energy      numeric         -- accumulated energy, in kWh
//   is_on       boolean         -- relay/output state for that room
//   updated_at  timestamptz

export type GroupId = "sala" | "living-room" | "master-bedroom";

export interface PzemReading {
  voltage: number; // V
  ampere: number; // A
  power: number; // W
  energy: number; // kWh
}

export interface EnergyGroup {
  id: GroupId;
  name: string;
  color: string;
  reading: PzemReading;
  isOn: boolean;
  updatedAt?: string;
}

export const ENERGY_GROUP_DEFS: { id: GroupId; name: string; color: string }[] =
  [{ id: "Rental house", name: "Rental House", color: "#e2ac36" }];

export const SENSOR_TO_GROUP: Record<string, GroupId> = {
  Rental: "Rental House",
};
