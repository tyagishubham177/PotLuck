import type { HandTranscript } from "@potluck/contracts";

function formatSeat(seatIndex: number) {
  return `Seat ${seatIndex + 1}`;
}

export function formatHandTranscriptText(transcript: HandTranscript) {
  const lines: string[] = [
    `PotLuck Hand Transcript`,
    `Room: ${transcript.roomId}`,
    `Hand: #${transcript.handNumber} (${transcript.handId})`,
    `Started: ${transcript.startedAt}`,
    `Ended: ${transcript.endedAt}`,
    `Button: ${
      transcript.buttonSeatIndex === undefined ? "n/a" : formatSeat(transcript.buttonSeatIndex)
    }`,
    `Blinds: ${
      transcript.smallBlindSeatIndex === undefined ? "n/a" : formatSeat(transcript.smallBlindSeatIndex)
    } / ${
      transcript.bigBlindSeatIndex === undefined ? "n/a" : formatSeat(transcript.bigBlindSeatIndex)
    }`,
    `Board: ${transcript.board.join(" ") || "(none)"}`,
    `Deck commitment: ${transcript.deckCommitmentHash}`,
    ``,
    `Actions`
  ];

  if (transcript.actions.length === 0) {
    lines.push(`- No player actions were recorded.`);
  } else {
    for (const action of transcript.actions) {
      lines.push(
        `- #${action.seq} ${formatSeat(action.seatIndex)} ${action.participantId} ${action.actionType}` +
          (action.normalizedAmount !== undefined ? ` to ${action.normalizedAmount}` : "") +
          ` (street ${action.street}, committed ${action.contributedAmount})`
      );
    }
  }

  lines.push("", "Contributions");

  for (const contribution of transcript.contributions) {
    lines.push(
      `- ${formatSeat(contribution.seatIndex)} ${contribution.participantId}: total ${contribution.totalCommitted} ` +
        `[pre ${contribution.contributedByStreet.PREFLOP}, flop ${contribution.contributedByStreet.FLOP}, turn ${contribution.contributedByStreet.TURN}, river ${contribution.contributedByStreet.RIVER}]`
    );
  }

  lines.push("", "Settlement");
  lines.push(
    `- Total pot ${transcript.settlement.totalPot}, rake ${transcript.settlement.totalRake}, odd-chip rule ${transcript.settlement.oddChipRule}`
  );

  for (const pot of transcript.settlement.pots) {
    const awardSummary = pot.awards
      .map((award) => `${formatSeat(award.seatIndex)} ${award.participantId}: ${award.amount}`)
      .join(", ");

    lines.push(
      `- ${pot.potType} pot ${pot.potIndex}: amount ${pot.amount}, rake ${pot.rakeApplied}, winners [${pot.winnerSeatIndexes
        .map(formatSeat)
        .join(", ")}], odd chips [${pot.oddChipSeatIndexes.map(formatSeat).join(", ") || "none"}], awards ${awardSummary}`
    );
  }

  if (transcript.settlement.showdownResults.length > 0) {
    lines.push("", "Showdown");

    for (const result of transcript.settlement.showdownResults) {
      lines.push(
        `- ${formatSeat(result.seatIndex)} ${result.participantId}: ${result.rank.label} (${result.holeCards.join(
          " "
        )})`
      );
    }
  }

  lines.push("", "Final Stacks");

  for (const player of transcript.settlement.playerResults) {
    lines.push(
      `- ${formatSeat(player.seatIndex)} ${player.participantId}: won ${player.won}, final ${player.finalStack}, net ${player.netResult}`
    );
  }

  lines.push("", "Audit");

  for (const event of transcript.auditEvents) {
    lines.push(`- ${event.occurredAt} ${event.type}: ${event.detail}`);
  }

  return lines.join("\n");
}
