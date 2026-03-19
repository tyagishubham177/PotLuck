type DurationSummary = {
  count: number;
  averageMs: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
};

type OperationalSnapshot = {
  activeRooms: number;
  pausedRoomCount: number;
  seatedPlayers: number;
  handsCompleted: number;
  ledgerBalanceMismatchCount: number;
};

type SettlementResult = {
  durationMs: number;
  outcome: "committed" | "paused";
};

type RealtimeActionResult = {
  durationMs: number;
  outcome: "accepted" | "rejected";
  errorCode?: string;
};

function summarizeDurations(values: number[]): DurationSummary {
  if (values.length === 0) {
    return {
      count: 0,
      averageMs: 0,
      minMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      maxMs: 0
    };
  }

  const sorted = [...values].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  const percentile = (ratio: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))] ?? 0;

  return {
    count: sorted.length,
    averageMs: Number((total / sorted.length).toFixed(2)),
    minMs: sorted[0] ?? 0,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: sorted.at(-1) ?? 0
  };
}

export function createObservability(getOperationalSnapshot: () => OperationalSnapshot) {
  const startedAt = new Date();
  const healthLatencyMs: number[] = [];
  const actionAckLatencyMs: number[] = [];
  const settlementLatencyMs: number[] = [];
  let totalHttpRequests = 0;
  let reconnectSuccesses = 0;
  let reconnectFailures = 0;
  let roomPauseCount = 0;
  let duplicateIntentRejectionCount = 0;

  return {
    recordHttpRequest(url: string, durationMs: number) {
      totalHttpRequests += 1;

      if (url === "/health" || url === "/api/health") {
        healthLatencyMs.push(durationMs);
      }
    },
    recordRealtimeAction(result: RealtimeActionResult) {
      actionAckLatencyMs.push(result.durationMs);

      if (result.outcome === "rejected" && result.errorCode === "ERR_STALE_SEQUENCE") {
        duplicateIntentRejectionCount += 1;
      }
    },
    recordReconnectFailure() {
      reconnectFailures += 1;
    },
    recordRoomEvent(event: { type: string }) {
      if (event.type === "PLAYER_RECONNECTED") {
        reconnectSuccesses += 1;
      }

      if (event.type === "ROOM_PAUSED") {
        roomPauseCount += 1;
      }
    },
    recordSettlement(result: SettlementResult) {
      settlementLatencyMs.push(result.durationMs);

      if (result.outcome === "paused") {
        roomPauseCount += 1;
      }
    },
    getSnapshot() {
      const operations = getOperationalSnapshot();
      const uptimeHours = Math.max(
        1 / 3600,
        (Date.now() - startedAt.getTime()) / (1000 * 60 * 60)
      );

      return {
        startedAt: startedAt.toISOString(),
        totalHttpRequests,
        reconnectSuccesses,
        reconnectFailures,
        roomPauseCount,
        duplicateIntentRejectionCount,
        activeRooms: operations.activeRooms,
        pausedRoomCount: operations.pausedRoomCount,
        seatedPlayers: operations.seatedPlayers,
        handsCompleted: operations.handsCompleted,
        handsPerHour: Number((operations.handsCompleted / uptimeHours).toFixed(2)),
        ledgerBalanceMismatchCount: operations.ledgerBalanceMismatchCount,
        healthLatency: summarizeDurations(healthLatencyMs),
        actionAcknowledgementLatency: summarizeDurations(actionAckLatencyMs),
        settlementLatency: summarizeDurations(settlementLatencyMs)
      };
    },
    renderPrometheus() {
      const snapshot = this.getSnapshot();

      return [
        "# HELP potluck_active_rooms Current active room count.",
        "# TYPE potluck_active_rooms gauge",
        `potluck_active_rooms ${snapshot.activeRooms}`,
        "# HELP potluck_paused_rooms Current paused room count.",
        "# TYPE potluck_paused_rooms gauge",
        `potluck_paused_rooms ${snapshot.pausedRoomCount}`,
        "# HELP potluck_seated_players Current occupied seat count.",
        "# TYPE potluck_seated_players gauge",
        `potluck_seated_players ${snapshot.seatedPlayers}`,
        "# HELP potluck_hands_completed_total Completed hands observed by the server.",
        "# TYPE potluck_hands_completed_total counter",
        `potluck_hands_completed_total ${snapshot.handsCompleted}`,
        "# HELP potluck_hands_per_hour Estimated completed hands per hour since boot.",
        "# TYPE potluck_hands_per_hour gauge",
        `potluck_hands_per_hour ${snapshot.handsPerHour}`,
        "# HELP potluck_health_latency_p95_ms P95 health check latency in milliseconds.",
        "# TYPE potluck_health_latency_p95_ms gauge",
        `potluck_health_latency_p95_ms ${snapshot.healthLatency.p95Ms}`,
        "# HELP potluck_action_ack_latency_p95_ms P95 realtime action acknowledgement latency in milliseconds.",
        "# TYPE potluck_action_ack_latency_p95_ms gauge",
        `potluck_action_ack_latency_p95_ms ${snapshot.actionAcknowledgementLatency.p95Ms}`,
        "# HELP potluck_settlement_latency_p95_ms P95 settlement latency in milliseconds.",
        "# TYPE potluck_settlement_latency_p95_ms gauge",
        `potluck_settlement_latency_p95_ms ${snapshot.settlementLatency.p95Ms}`,
        "# HELP potluck_reconnect_successes_total Successful reconnect events.",
        "# TYPE potluck_reconnect_successes_total counter",
        `potluck_reconnect_successes_total ${snapshot.reconnectSuccesses}`,
        "# HELP potluck_reconnect_failures_total Failed reconnect attempts.",
        "# TYPE potluck_reconnect_failures_total counter",
        `potluck_reconnect_failures_total ${snapshot.reconnectFailures}`,
        "# HELP potluck_room_pauses_total Total room pauses seen since boot.",
        "# TYPE potluck_room_pauses_total counter",
        `potluck_room_pauses_total ${snapshot.roomPauseCount}`,
        "# HELP potluck_duplicate_intent_rejections_total Duplicate or stale intent rejections.",
        "# TYPE potluck_duplicate_intent_rejections_total counter",
        `potluck_duplicate_intent_rejections_total ${snapshot.duplicateIntentRejectionCount}`,
        "# HELP potluck_ledger_balance_mismatch_total Occupied seats whose stack diverges from ledger balance.",
        "# TYPE potluck_ledger_balance_mismatch_total gauge",
        `potluck_ledger_balance_mismatch_total ${snapshot.ledgerBalanceMismatchCount}`
      ].join("\n");
    }
  };
}
