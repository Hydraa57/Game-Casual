'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ALLOWED_TARGET_SCORES,
  ALLOWED_TIME_LIMITS_SEC,
  AVATAR_GLYPH,
  BOT_DIFFICULTIES,
  MAX_PLAYERS_LIMIT,
  MIN_PLAYERS_TO_START,
  TEAM_IDS,
  teamCapacity,
  teamsReady,
} from '@pixelmatrix/shared';
import type {
  BotDifficulty,
  ChatMessage,
  Player,
  RoomSettings,
  RoomState,
  TeamId,
} from '@pixelmatrix/shared';
import { ChatPanel } from './ChatPanel';
import { ConfirmDialog } from './ConfirmDialog';
import { PingBadge } from './PingBadge';
import { PrefetchGame } from './PrefetchGame';

export interface RoomLobbyProps {
  readonly room: RoomState;
  readonly playerId: string | null;
  readonly busy: boolean;
  readonly onReady: (ready: boolean) => void;
  readonly onUpdateSettings: (settings: Partial<RoomSettings>) => void;
  readonly onStart: () => void;
  readonly onLeave: () => void;
  readonly onAddBot: (difficulty: BotDifficulty) => void;
  readonly onRemoveBot: (botId: string) => void;
  readonly onSetTeam: (team: TeamId) => void;
  readonly chat: readonly ChatMessage[];
  readonly onSendChat: (text: string) => void;
}

export function RoomLobby({
  room,
  playerId,
  busy,
  onReady,
  onUpdateSettings,
  onStart,
  onLeave,
  onAddBot,
  onRemoveBot,
  onSetTeam,
  chat,
  onSendChat,
}: RoomLobbyProps) {
  const t = useTranslations('room');
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const me = room.players.find((player) => player.id === playerId);
  const isHost = me?.isHost ?? false;
  /**
   * Kesiapan dihitung dari pemain yang TERSAMBUNG, bukan seluruh daftar.
   *
   * Harus cocok dengan `Room.canStart()` di server. Kalau di sini memakai
   * seluruh daftar, satu pemain yang sedang reconnect akan membuat tombol
   * "mulai" mati padahal server sudah mengizinkan — host melihat tombol yang
   * tidak bisa ditekan tanpa penjelasan apa pun.
   */
  const connected = room.players.filter((player) => player.connected);
  const connectedCount = connected.length;
  const roomFull = room.players.length >= room.settings.maxPlayers;
  const allReady = connected.every((player) => player.isReady);
  const enoughPlayers = connectedCount >= MIN_PLAYERS_TO_START;

  const beregu = room.settings.teamMode === 'teams';
  /**
   * Dihitung dari pemain TERSAMBUNG, sama seperti `Room.canStart()` di server.
   *
   * Kalau di sini memakai seluruh daftar, lobby akan menampilkan 3v3 yang rapi
   * sementara server melihat 3v2 dan menolak memulai — host menekan tombol yang
   * menyala lalu mendapat error yang bertentangan dengan yang dilihatnya.
   */
  const teamCounts = connected.reduce<Record<TeamId, number>>(
    (counts, player) => {
      if (player.team !== null) counts[player.team] += 1;
      return counts;
    },
    { a: 0, b: 0 },
  );
  const teamsBalanced = !beregu || teamsReady(teamCounts);
  const perTeam = teamCapacity(room.settings.maxPlayers);

  const share = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}?code=${room.roomCode}`;
    const text = t('shareText', { code: room.roomCode });

    // Di HP, share sheet bawaan jauh lebih cepat daripada copy lalu buka WhatsApp.
    if (navigator.share) {
      void navigator.share({ title: t('shareTitle'), text, url }).catch(() => {
        /* pemain membatalkan share — bukan error */
      });
      return;
    }
    void navigator.clipboard?.writeText(`${text} ${url}`).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }, [room.roomCode, t]);

  return (
    <div className="lobby">
      <div className="card lobby__code">
        <span className="hud__label">{t('roomCode')}</span>
        <div className="lobby__codeValue">{room.roomCode}</div>
        <button className="btn btn--small" type="button" onClick={share}>
          {copied ? t('copied') : t('share')}
        </button>
      </div>

      {/* Lobby = waktu tunggu paling pasti dalam permainan ini. Tanpa ini,
          ~330 KB Phaser baru diunduh saat countdown 3-2-1 sudah berjalan. */}
      <PrefetchGame target="remote" />

      {beregu ? (
        /*
          Dua kolom regu menggantikan satu daftar.

          Bukan satu daftar dengan lencana regu di tiap baris: yang paling
          sering ditanyakan di lobby beregu adalah "siapa lawan siapa", dan
          menjawabnya dari lencana berarti membaca delapan baris lalu
          mengelompokkannya sendiri di kepala. Dua kolom menjawabnya tanpa
          dibaca.
        */
        <section className="card">
          <h2 className="card__title">
            {t('teamsTitle')} ({connectedCount}/{room.settings.maxPlayers})
          </h2>
          <div className="teams">
            {TEAM_IDS.map((team) => {
              const anggota = room.players.filter((player) => player.team === team);
              const akuDiSini = me?.team === team;
              const penuh = teamCounts[team] >= perTeam;
              return (
                <div className={`teams__col teams__col--${team}`} key={team}>
                  <h3 className="teams__name">
                    {t(`teamName.${team}`)}
                    <span className="teams__count">
                      {anggota.length}/{perTeam}
                    </span>
                  </h3>
                  <ul className="playerList">
                    {anggota.map((player) => (
                      <PlayerRow
                        key={player.id}
                        player={player}
                        isMe={player.id === playerId}
                        isHost={isHost}
                        busy={busy}
                        onRemoveBot={onRemoveBot}
                      />
                    ))}
                  </ul>
                  {/* Tombolnya hanya di regu SEBERANG. Tombol "gabung" di regu
                      yang sudah kutempati tidak melakukan apa pun, dan tombol
                      mati yang tidak melakukan apa pun membuat orang menekannya
                      berulang kali lalu mengira lobby-nya macet. */}
                  {!akuDiSini && room.status === 'waiting' && (
                    <button
                      className="btn btn--small"
                      type="button"
                      onClick={() => onSetTeam(team)}
                      disabled={busy || penuh}
                    >
                      {penuh ? t('teamFull') : t('joinTeam')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="card">
          <h2 className="card__title">
            {t('players')} ({room.players.length}/{room.settings.maxPlayers})
          </h2>
          {/* Sama seperti scoreboard match: mulai tiga pemain, daftarnya dipecah
              dua kolom supaya lobby berempat tidak menjulur melewati layar. */}
          <ul className={`playerList${room.players.length > 2 ? ' playerList--grid' : ''}`}>
            {room.players.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                isMe={player.id === playerId}
                isHost={isHost}
                busy={busy}
                onRemoveBot={onRemoveBot}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Hanya host. Pemain lain tetap melihat botnya di daftar di atas —
          yang tidak mereka punya cuma tombolnya, sama seperti pengaturan. */}
      {isHost && room.status === 'waiting' && (
        <section className="card">
          <h2 className="card__title">{t('addBotTitle')}</h2>
          <p className="hint">{t('addBotHint')}</p>
          <div className="botPicker">
            {BOT_DIFFICULTIES.map((difficulty) => (
              <button
                key={difficulty}
                className="btn btn--small"
                type="button"
                onClick={() => onAddBot(difficulty)}
                // Kursi habis berarti tombolnya tidak akan berhasil. Membiarkannya
                // hidup lalu menjawab ROOM_FULL membuat pemain menebak-nebak
                // apakah yang rusak tombolnya atau koneksinya.
                disabled={busy || roomFull}
              >
                {t(`botLevel.${difficulty}`)}
              </button>
            ))}
          </div>
          {roomFull && <p className="hint">{t('addBotFull')}</p>}
        </section>
      )}

      <section className="card">
        <h2 className="card__title">{t('settings')}</h2>
        {isHost ? (
          <div className="settings">
            {/*
              Paling atas karena ia mengubah ARTI baris di bawahnya: di mode
              beregu, "maks pemain" berhenti berarti "berapa orang boleh masuk"
              dan mulai berarti "berapa lawan berapa".
            */}
            <div className="settings__row">
              <span className="hud__label">{t('teamMode')}</span>
              <div className="settings__options">
                {(['ffa', 'teams'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={room.settings.teamMode === mode ? 'chip chip--active' : 'chip'}
                    onClick={() => onUpdateSettings({ teamMode: mode })}
                    disabled={busy}
                  >
                    {t(`teamModeName.${mode}`)}
                  </button>
                ))}
              </div>
            </div>
            <SettingRow
              label={beregu ? t('teamFormat') : t('maxPlayers')}
              options={playerOptions(beregu)}
              value={room.settings.maxPlayers}
              // Di mode beregu angkanya dibaca sebagai formatnya: 4 → "2v2".
              format={beregu ? (n) => `${n / 2}v${n / 2}` : undefined}
              onChange={(maxPlayers) => onUpdateSettings({ maxPlayers })}
            />
            <SettingRow
              label={t('targetScore')}
              options={[...ALLOWED_TARGET_SCORES]}
              value={room.settings.targetScore}
              onChange={(targetScore) => onUpdateSettings({ targetScore })}
            />
            <SettingRow
              label={t('timeLimit')}
              options={[...ALLOWED_TIME_LIMITS_SEC]}
              value={room.settings.timeLimitSec}
              suffix="s"
              onChange={(timeLimitSec) => onUpdateSettings({ timeLimitSec })}
            />
          </div>
        ) : (
          <p className="hint">
            {t('settingsReadOnly', {
              players: room.settings.maxPlayers,
              score: room.settings.targetScore,
              time: room.settings.timeLimitSec,
            })}
          </p>
        )}
      </section>

      <div className="controls controls--stack">
        <button
          className={me?.isReady ? 'btn' : 'btn btn--primary'}
          type="button"
          onClick={() => onReady(!me?.isReady)}
        >
          {me?.isReady ? t('cancelReady') : t('imReady')}
        </button>

        {isHost && (
          <button
            className="btn btn--primary"
            type="button"
            onClick={onStart}
            disabled={busy || !allReady || !enoughPlayers || !teamsBalanced}
          >
            {t('startMatch')}
          </button>
        )}
      </div>

      {/*
        Satu alasan pada satu waktu, urut dari yang paling awal harus dibereskan.
        Menampilkan ketiganya sekaligus berarti host membaca tiga kalimat untuk
        menemukan satu tindakan.
      */}
      {isHost && !enoughPlayers && <p className="hint">{t('waitingForPlayers')}</p>}
      {isHost && enoughPlayers && !allReady && <p className="hint">{t('waitingForReady')}</p>}
      {isHost && enoughPlayers && allReady && !teamsBalanced && (
        <p className="hint">{t('waitingForTeams')}</p>
      )}
      {!isHost && allReady && teamsBalanced && <p className="hint">{t('waitingForHost')}</p>}
      {/* Pemain biasa juga perlu tahu — dialah yang harus pindah, bukan host. */}
      {!isHost && !teamsBalanced && <p className="hint">{t('waitingForTeams')}</p>}

      <button className="btn btn--small" type="button" onClick={() => setConfirmLeave(true)}>
        {t('leaveRoom')}
      </button>

      {confirmLeave && (
        <ConfirmDialog
          title={t('leaveRoomTitle')}
          body={t('leaveRoomBody')}
          confirmLabel={t('leaveRoom')}
          onConfirm={onLeave}
          onCancel={() => setConfirmLeave(false)}
        />
      )}

      {/* Chat ditaruh SETELAH kontrol match, bukan sebelumnya. Di layar HP yang
          sempit, yang harus terlihat lebih dulu adalah tombol siap dan mulai —
          bukan percakapan. */}
      <ChatPanel
        messages={chat}
        playerId={playerId}
        // Syarat yang sama ditegakkan server di `Room.canChat()`. Di sini ia
        // hanya untuk menonaktifkan kolomnya, supaya tidak ada yang mengetik
        // panjang-panjang lalu pesannya ditolak.
        enabled={connectedCount >= MIN_PLAYERS_TO_START}
        onSend={onSendChat}
      />
    </div>
  );
}

/**
 * Satu baris pemain di lobby.
 *
 * Dipisah karena dipakai dua tata letak yang berbeda — daftar datar di mode
 * ffa dan dua kolom regu — dan menyalinnya berarti dua salinan yang harus
 * diperbarui bersamaan setiap kali ada lencana baru. Yang kedua pasti akan
 * tertinggal.
 */
function PlayerRow({
  player,
  isMe,
  isHost,
  busy,
  onRemoveBot,
}: {
  readonly player: Player;
  readonly isMe: boolean;
  readonly isHost: boolean;
  readonly busy: boolean;
  readonly onRemoveBot: (botId: string) => void;
}) {
  const t = useTranslations('room');
  return (
    <li
      // Pemain yang koneksinya putus tetap menempati kursinya selama masa
      // tenggang. Tanpa penanda ini, pemain lain hanya melihat seseorang yang
      // tidak pernah menekan "siap" dan tidak tahu kenapa — lalu menyimpulkan
      // lobby-nya rusak.
      className={`playerList__item${player.connected ? '' : ' playerList__item--gone'}`}
    >
      <span className={isMe ? 'playerList__me' : undefined}>
        {/* Avatar ditampilkan di sini supaya pemain melihat karakter yang
            BENAR-BENAR dipakai — server bisa menggantinya kalau pilihannya
            sudah diambil orang lain. */}
        <span className="avatarMark" aria-hidden="true">
          {AVATAR_GLYPH[player.avatar]}
        </span>
        {player.nickname}
        {player.isHost && <span className="badge">{t('host')}</span>}
        {/* Selalu terlihat. Menyembunyikan bahwa lawanmu bukan orang berarti
            skor yang kamu kalahkan tidak berarti apa-apa. */}
        {player.bot !== null && (
          <span className="badge badge--bot">{t(`botLevel.${player.bot}`)}</span>
        )}
      </span>
      <span className="playerList__right">
        {/* Bot tidak punya jaringan untuk diukur. Menampilkan "0 ms" untuknya
            akan terbaca sebagai lawan berkoneksi sempurna, padahal yang benar
            adalah pertanyaannya tidak berlaku. */}
        {player.bot === null && (
          // Ping ditampilkan sejak di lobby, bukan hanya saat match: di situlah
          // keputusan yang bisa diambil masih ada — menunggu sebentar, atau
          // memulai tanpa menunggu koneksi yang buruk.
          <PingBadge latencyMs={player.latencyMs} connected={player.connected} />
        )}
        {player.bot !== null && isHost ? (
          <button
            className="btn btn--small btn--ghost"
            type="button"
            onClick={() => onRemoveBot(player.id)}
            disabled={busy}
          >
            {t('removeBot')}
          </button>
        ) : player.connected ? (
          <span className={player.isReady ? 'ready ready--yes' : 'ready'}>
            {player.isReady ? t('ready') : t('notReady')}
          </span>
        ) : (
          <span className="ready ready--gone">{t('reconnecting')}</span>
        )}
      </span>
    </li>
  );
}

/**
 * Pilihan kapasitas room.
 *
 * Di mode beregu hanya yang genap: kursi ganjil berarti satu tempat yang tidak
 * akan pernah bisa dipakai, dan lobby yang menunggu pemain ketujuh di room
 * berkapasitas 7 akan menunggu selamanya. Server menegakkan hal yang sama di
 * `normalizeSettings` — ini supaya pilihannya tidak pernah ditawarkan sejak
 * awal, bukan ditawarkan lalu diam-diam diubah.
 */
function playerOptions(beregu: boolean): number[] {
  const options: number[] = [];
  const mulai = beregu ? 4 : MIN_PLAYERS_TO_START;
  for (let count = mulai; count <= MAX_PLAYERS_LIMIT; count += 1) {
    if (beregu && count % 2 !== 0) continue;
    options.push(count);
  }
  return options;
}

function SettingRow({
  label,
  options,
  value,
  suffix = '',
  format,
  onChange,
}: {
  label: string;
  options: readonly number[];
  value: number;
  suffix?: string;
  /**
   * Cara menuliskan angkanya. Dipakai mode beregu untuk menampilkan "2v2"
   * alih-alih "4" — angka mentahnya benar tapi tidak menjawab pertanyaan yang
   * ada di kepala pemain saat itu.
   */
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="settings__row">
      <span className="hud__label">{label}</span>
      <div className="settings__options">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={option === value ? 'chip chip--active' : 'chip'}
            onClick={() => onChange(option)}
          >
            {format ? format(option) : `${option}${suffix}`}
          </button>
        ))}
      </div>
    </div>
  );
}
