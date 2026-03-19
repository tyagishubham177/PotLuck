import type { RoomConfig } from "@potluck/contracts";

type RoomConfigFieldsProps = {
  roomForm: RoomConfig;
  updateRoomForm: <K extends keyof RoomConfig>(key: K, value: RoomConfig[K]) => void;
  variant?: "create" | "admin";
};

export function RoomConfigFields({
  roomForm,
  updateRoomForm,
  variant = "create"
}: RoomConfigFieldsProps) {
  return (
    <div className={`field-grid${variant === "admin" ? " compact" : ""}`}>
      <label className="field">
        <span>Table name</span>
        <input
          onChange={(event) => updateRoomForm("tableName", event.target.value)}
          value={roomForm.tableName}
        />
      </label>

      {variant === "create" ? (
        <label className="field">
          <span>Seats</span>
          <input
            max={9}
            min={2}
            onChange={(event) => updateRoomForm("maxSeats", Number(event.target.value))}
            type="number"
            value={roomForm.maxSeats}
          />
        </label>
      ) : null}

      <label className="field">
        <span>Small blind</span>
        <input
          min={1}
          onChange={(event) => updateRoomForm("smallBlind", Number(event.target.value))}
          type="number"
          value={roomForm.smallBlind}
        />
      </label>

      <label className="field">
        <span>Big blind</span>
        <input
          min={1}
          onChange={(event) => updateRoomForm("bigBlind", Number(event.target.value))}
          type="number"
          value={roomForm.bigBlind}
        />
      </label>

      <label className="field">
        <span>Ante</span>
        <input
          min={0}
          onChange={(event) => updateRoomForm("ante", Number(event.target.value))}
          type="number"
          value={roomForm.ante}
        />
      </label>

      {variant === "create" ? (
        <label className="field">
          <span>Buy-in mode</span>
          <select
            onChange={(event) =>
              updateRoomForm("buyInMode", event.target.value as RoomConfig["buyInMode"])
            }
            value={roomForm.buyInMode}
          >
            <option value="BB_MULTIPLE">Big blind multiple</option>
          </select>
        </label>
      ) : null}

      <label className="field">
        <span>Min buy-in</span>
        <input
          min={1}
          onChange={(event) => updateRoomForm("minBuyIn", Number(event.target.value))}
          type="number"
          value={roomForm.minBuyIn}
        />
      </label>

      <label className="field">
        <span>Max buy-in</span>
        <input
          min={1}
          onChange={(event) => updateRoomForm("maxBuyIn", Number(event.target.value))}
          type="number"
          value={roomForm.maxBuyIn}
        />
      </label>
    </div>
  );
}
