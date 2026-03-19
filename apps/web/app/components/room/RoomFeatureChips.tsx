import type { RoomConfig } from "@potluck/contracts";

type ToggleKey =
  | "spectatorsAllowed"
  | "waitingListEnabled"
  | "straddleAllowed"
  | "rebuyEnabled"
  | "topUpEnabled";

type RoomFeatureChipsProps = {
  roomForm: RoomConfig;
  updateRoomForm: <K extends keyof RoomConfig>(key: K, value: RoomConfig[K]) => void;
  keys?: ToggleKey[];
};

const defaultKeys: ToggleKey[] = [
  "spectatorsAllowed",
  "waitingListEnabled",
  "straddleAllowed",
  "rebuyEnabled",
  "topUpEnabled"
];

const labels: Record<ToggleKey, string> = {
  spectatorsAllowed: "Spectators",
  waitingListEnabled: "Waiting list",
  straddleAllowed: "Straddle",
  rebuyEnabled: "Rebuy",
  topUpEnabled: "Top-up"
};

export function RoomFeatureChips({
  roomForm,
  updateRoomForm,
  keys = defaultKeys
}: RoomFeatureChipsProps) {
  return (
    <div className="toggle-row">
      {keys.map((key) => (
        <button
          aria-pressed={roomForm[key]}
          className={roomForm[key] ? "mode-chip active" : "mode-chip"}
          key={key}
          onClick={() => updateRoomForm(key, !roomForm[key])}
          type="button"
        >
          {labels[key]} {roomForm[key] ? "On" : "Off"}
        </button>
      ))}
    </div>
  );
}
