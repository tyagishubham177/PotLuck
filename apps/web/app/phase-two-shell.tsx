"use client";

import { AdminLoginPanel } from "./components/auth/AdminLoginPanel";
import { AdminConsole } from "./components/admin/AdminConsole";
import { AdminRoomListPanel } from "./components/admin/AdminRoomListPanel";
import { PlayerListPanel } from "./components/admin/PlayerListPanel";
import { HandHistoryPanel } from "./components/history/HandHistoryPanel";
import { HandTranscriptPanel } from "./components/history/HandTranscriptPanel";
import { BootSplash } from "./components/layout/BootSplash";
import { HeroPanel } from "./components/layout/HeroPanel";
import { GuestJoinPanel } from "./components/room/GuestJoinPanel";
import { LobbyPanel } from "./components/room/LobbyPanel";
import { RoomCreatePanel } from "./components/room/RoomCreatePanel";
import { InfoRow } from "./components/common/InfoRow";
import { StackControlPanel } from "./components/table/StackControlPanel";
import { ShowdownPanel } from "./components/table/ShowdownPanel";
import { TablePanel } from "./components/table/TablePanel";
import { usePhaseTwoController } from "./hooks/usePhaseTwoController";
import type { PhaseTwoShellProps } from "./lib/phase-two-types";
import { formatChips } from "./table-state";

export function PhaseTwoShell({
  appName,
  appOrigin,
  serverOrigin,
  envName,
  statusLabel
}: PhaseTwoShellProps) {
  const controller = usePhaseTwoController({ serverOrigin });

  if (controller.session.isBooting) {
    return <BootSplash appName={appName} />;
  }

  const { session, forms, feedbacks, derived, actions } = controller;
  const showAdminSetup = !session.authState || derived.isAdmin;
  const showGuestEntry =
    !session.authState ||
    session.authState.actor.role === "GUEST" ||
    Boolean(session.roomPreview);
  const showTableShell = derived.flowStage !== "entry";

  return (
    <main className="phase-shell">
      <a className="skip-link" href="#table-stage">
        Skip to table
      </a>

      <HeroPanel
        appName={appName}
        appOrigin={appOrigin}
        envName={envName}
        hasAuthState={Boolean(session.authState)}
        logoutFeedback={feedbacks.logout}
        onLogout={actions.handleLogout}
        onRefreshSession={actions.handleRefreshSession}
        refreshFeedback={feedbacks.refresh}
        roomCode={session.roomPreview?.code}
        statusCopy={derived.statusCopy}
        statusLabel={statusLabel}
      />

      {showAdminSetup ? (
        <section className="panel-grid">
          <AdminLoginPanel
            adminCode={forms.adminCode}
            adminEmail={forms.adminEmail}
            onAdminCodeChange={forms.setAdminCode}
            onAdminEmailChange={forms.setAdminEmail}
            onRequestOtp={actions.handleRequestOtp}
            onVerifyOtp={actions.handleVerifyOtp}
            otpRequestState={session.otpRequestState}
            requestOtpFeedback={feedbacks.requestOtp}
            verifyOtpFeedback={feedbacks.verifyOtp}
          />
          <RoomCreatePanel
            canCreateRoom={session.authState?.actor.role === "ADMIN"}
            createRoomFeedback={feedbacks.createRoom}
            derivedBuyInExample={derived.derivedBuyInExample}
            onCreateRoom={actions.handleCreateRoom}
            roomForm={forms.roomForm}
            updateRoomForm={forms.updateRoomForm}
          />
        </section>
      ) : null}

      {derived.isAdmin ? (
        <AdminRoomListPanel
          adminFeedback={feedbacks.admin}
          adminRooms={session.adminRooms}
          currentRoomId={session.activeRoomId}
          nowMs={session.nowMs}
          onCloseRoom={actions.handleCloseRoom}
          onLoadAdminRooms={actions.handleLoadAdminRooms}
          onOpenRoom={actions.handleOpenAdminRoom}
        />
      ) : null}

      {showGuestEntry ? (
        <section className="panel-grid">
          <GuestJoinPanel
            joinMode={forms.joinMode}
            joinRoomFeedback={feedbacks.joinRoom}
            lookupFeedback={feedbacks.lookup}
            nickname={forms.nickname}
            onCheckRoom={actions.handleCheckRoom}
            onJoinModeChange={forms.setJoinMode}
            onJoinRoom={actions.handleJoinRoom}
            onNicknameChange={forms.setNickname}
            onRoomCodeChange={forms.setRoomCode}
            roomCode={forms.roomCode}
            roomPreview={session.roomPreview}
          />
          <LobbyPanel
            authState={session.authState}
            copyRoomCodeFeedback={feedbacks.copyRoomCode}
            heroParticipantState={derived.heroParticipant?.state ?? "Observer"}
            lobbyFeedback={feedbacks.lobby}
            lobbySnapshot={session.lobbySnapshot}
            nowMs={session.nowMs}
            onStackAmountChange={forms.setStackAmount}
            onCopyRoomCode={actions.copyRoomCode}
            onJoinQueue={actions.handleJoinQueue}
            onRefreshLobby={actions.handleRefreshLobby}
            onReserveSeat={actions.handleReserveSeat}
            queueFeedback={feedbacks.queue}
            reserveFeedback={feedbacks.reserve}
            stackAmount={forms.stackAmount}
            stackControlQuote={derived.stackControlQuote}
          />
        </section>
      ) : null}

      {showTableShell ? (
        <section className="player-table-shell">
          <TablePanel
            actionAffordances={session.privateState?.actionAffordances ?? null}
            actionTray={derived.actionTray}
            activeCallAmount={derived.activeCallAmount}
            authState={session.authState}
            betAmount={forms.betAmount}
            boardCards={derived.boardCards}
            currentSeatSnapshot={derived.currentSeatSnapshot}
            heroSeatIndex={derived.heroSeatIndex}
            isSpectatorSession={derived.isSpectatorSession}
            latestModerationMessage={session.latestModeration?.message}
            liveSnapshot={session.liveSnapshot}
            lockedNotice={derived.lockedNotice}
            nowMs={session.nowMs}
            onActionIntent={actions.handleActionIntent}
            onActionPreset={actions.handleActionPreset}
            onBetAmountChange={forms.setBetAmount}
            onReadyForHand={actions.handleReadyForHand}
            onSitOutNextHand={actions.handleSitOutNextHand}
            onSitOutNow={actions.handleSitOutNow}
            potBadges={derived.potBadges}
            privateState={session.privateState}
            reconnectCopy={derived.reconnectCopy}
            roomCode={session.roomPreview?.code}
            sizingAmount={derived.sizingAmount}
            socketFeedback={feedbacks.socket}
            socketStatus={session.socketStatus}
            tableSeatModels={derived.tableSeatModels}
          />

          <aside className="panel table-rail">
            <div className="panel-head">
              <p className="eyebrow">Rail</p>
              <h2>Stacks, history, and moderation</h2>
            </div>

            <div className="info-block">
              <InfoRow
                label="Hero seat"
                value={
                  derived.heroSeatIndex !== undefined
                    ? `Seat ${derived.heroSeatIndex + 1}`
                    : "Observer"
                }
              />
              <InfoRow
                label="Current stack"
                value={formatChips(derived.currentSeatSnapshot?.stack ?? session.privateState?.stack)}
              />
              <InfoRow
                label="Buy-in window"
                value={
                  derived.stackControlQuote
                    ? `${formatChips(derived.stackControlQuote.minChips)} to ${formatChips(derived.stackControlQuote.maxChips)}`
                    : "Join a room first"
                }
              />
            </div>

            <StackControlPanel
              chipControlState={derived.chipControlState}
              chipFeedback={feedbacks.chip}
              currentSeatSnapshot={derived.currentSeatSnapshot}
              currentTablePhase={derived.currentTablePhase}
              heroSeatIndex={derived.heroSeatIndex}
              onChipOperation={actions.handleChipOperation}
              onStackAmountChange={forms.setStackAmount}
              stackAmount={forms.stackAmount}
              stackControlQuote={derived.stackControlQuote}
            />

            <ShowdownPanel
              liveSnapshot={session.liveSnapshot}
              settlementSummary={derived.settlementSummary}
              showdownResult={session.showdownResult}
              showdownWinners={derived.showdownWinners}
            />

            <HandHistoryPanel
              activeHandId={session.handHistory?.handId}
              historyFeedback={feedbacks.history}
              historyItems={session.historyItems}
              historyNextCursor={session.historyNextCursor}
              onLoadHandTranscript={actions.handleLoadHandTranscript}
              onLoadHistoryList={actions.handleLoadHistoryList}
              onRequestLatestHistory={actions.handleRequestLatestHistory}
              settlementSummary={derived.settlementSummary}
            />

            <HandTranscriptPanel
              handHistory={session.handHistory}
              onExportHand={actions.handleExportHand}
              onRequestLatestHistory={actions.handleRequestLatestHistory}
              settlementSummary={derived.settlementSummary}
            />

            <PlayerListPanel
              canKick={derived.isAdmin}
              liveSnapshot={session.liveSnapshot}
              nowMs={session.nowMs}
              onKickParticipant={actions.handleKickParticipant}
            />

            {derived.isAdmin ? (
              <AdminConsole
                adminActionReason={forms.adminActionReason}
                adminFeedback={feedbacks.admin}
                liveSnapshot={session.liveSnapshot}
                onAdminActionReasonChange={forms.setAdminActionReason}
                onPauseResumeRoom={actions.handlePauseResumeRoom}
                onSaveRoomConfig={actions.handleSaveRoomConfig}
                onToggleJoinLock={actions.handleToggleJoinLock}
                roomForm={forms.roomForm}
                updateRoomForm={forms.updateRoomForm}
              />
            ) : null}
          </aside>
        </section>
      ) : null}
    </main>
  );
}
