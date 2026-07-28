'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { pendingTutorial, SOLO_STARTING_LIVES, soloIntensity } from '@pixelmatrix/shared';
import type { TutorialTopic } from '@pixelmatrix/shared';
import { INITIAL_SNAPSHOT } from '@/game/hudSnapshot';
import type { HudSnapshot } from '@/game/hudSnapshot';
import type { SoloController } from '@/game/createSoloGame';
import { Link } from '@/i18n/navigation';
import { readHighScore, writeHighScore } from '@/lib/highScore';
import { Music } from '@/game/music';
import { markTutorialSeen, readTutorialSeen } from '@/lib/tutorialSeen';
import { readMuted, writeMuted } from '@/lib/mute';
import { Hud } from './Hud';
import { TutorialCard } from './TutorialCard';

export function SoloGame({ startLevel }: { startLevel?: number }) {
  const t = useTranslations('solo');
  const boardRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SoloController | null>(null);

  const [snapshot, setSnapshot] = useState<HudSnapshot>(INITIAL_SNAPSHOT);
  const [highScore, setHighScore] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [muted, setMuted] = useState(false);
  const [tutorial, setTutorial] = useState<TutorialTopic | null>(null);

  /**
   * Penjelasan yang sudah dilihat, dipegang di ref.
   *
   * Sengaja BUKAN state: ia dibaca di dalam effect yang mengamati level, dan
   * kalau ia jadi dependency maka menandai satu penjelasan sebagai "sudah
   * dilihat" akan menjalankan effect itu lagi — lalu penjelasan yang sama
   * muncul kembali seketika.
   */
  const seenRef = useRef<readonly TutorialTopic[]>([]);

  /**
   * Musik latar hidup selama komponen ini terpasang.
   *
   * Dibuat sekali di ref, bukan per render: AudioContext itu sumber daya OS,
   * dan membuatnya berulang kali akan ditolak browser setelah beberapa kali.
   */
  const musicRef = useRef<Music | null>(null);
  if (musicRef.current === null && typeof window !== 'undefined') {
    musicRef.current = new Music();
  }

  useEffect(() => {
    const music = musicRef.current;
    return () => music?.dispose();
  }, []);

  /**
   * Ketegangan mengikuti keadaan permainan, dihitung di `shared` supaya bisa
   * diuji tanpa audio sama sekali.
   */
  useEffect(() => {
    musicRef.current?.setIntensity(
      soloIntensity(snapshot.level, snapshot.lives, SOLO_STARTING_LIVES),
    );
  }, [snapshot.level, snapshot.lives]);

  // Musik hanya berbunyi saat benar-benar bermain. Di layar jeda, game over,
  // dan saat kartu tutorial terbuka, ia berhenti — itu momen untuk membaca,
  // bukan momen untuk didesak.
  useEffect(() => {
    const music = musicRef.current;
    if (!music) return;
    if (snapshot.status === 'running' && tutorial === null) music.start();
    else music.stop();
  }, [snapshot.status, tutorial]);

  useEffect(() => {
    setHighScore(readHighScore());
    setMuted(readMuted());
    musicRef.current?.setMuted(readMuted());
    seenRef.current = readTutorialSeen();
  }, []);

  /**
   * Munculkan penjelasan saat pemain baru naik ke level yang membuka mekanik.
   *
   * Papannya dibekukan lewat `pause()` yang sudah ada — jalur yang sama dengan
   * tombol pause, jadi tidak ada keadaan baru yang perlu dijaga. Tanpa
   * pembekuan ini pemain harus memilih antara membaca dan bermain, dan ia akan
   * memilih bermain lalu menutup kartunya tanpa dibaca.
   */
  useEffect(() => {
    if (snapshot.status !== 'running') return;

    const topic = pendingTutorial(snapshot.level, seenRef.current);
    if (topic === null) return;

    seenRef.current = [...seenRef.current, topic];
    markTutorialSeen(topic);
    controllerRef.current?.pause();
    setTutorial(topic);
  }, [snapshot.level, snapshot.status]);

  const dismissTutorial = useCallback(() => {
    setTutorial(null);
    controllerRef.current?.resume();
  }, []);

  // Phaser menyentuh `window` saat di-import, jadi di-import dinamis di dalam
  // effect — dengan begitu halaman tetap bisa dirender di server.
  useEffect(() => {
    let disposed = false;
    let controller: SoloController | null = null;

    void import('@/game/createSoloGame').then(({ createSoloGame }) => {
      if (disposed || !boardRef.current) return;
      controller = createSoloGame({ parent: boardRef.current, onHud: setSnapshot, startLevel });
      // Preferensi bunyi dibaca sebelum controller ada, jadi diterapkan di sini.
      controller.setMuted(readMuted());
      controllerRef.current = controller;
    });

    return () => {
      disposed = true;
      controller?.destroy();
      controllerRef.current = null;
    };
  }, [startLevel]);

  // Simpan rekor begitu ronde selesai.
  useEffect(() => {
    if (snapshot.status !== 'gameOver') return;
    const previous = readHighScore();
    if (snapshot.score > previous) {
      writeHighScore(snapshot.score);
      setHighScore(snapshot.score);
      setIsNewRecord(true);
    }

    // Kirim ke akun kalau pemain login. Endpoint-nya membalas `saved: false`
    // untuk guest dan saat database tidak ada — keduanya keadaan normal, jadi
    // kegagalannya sengaja tidak ditampilkan ke pemain: rekor localStorage
    // sudah tersimpan dan ronde berikutnya tidak boleh terganggu oleh ini.
    void fetch('/api/solo-scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score: snapshot.score,
        durationSeconds: Math.max(1, Math.round(snapshot.elapsedMs / 1000)),
        level: snapshot.level,
      }),
    }).catch(() => {});
  }, [snapshot.status, snapshot.score, snapshot.elapsedMs, snapshot.level]);

  const start = useCallback(() => {
    setIsNewRecord(false);
    controllerRef.current?.start();
  }, []);

  const continueRound = useCallback(() => {
    setIsNewRecord(false);
    controllerRef.current?.continueRound();
  }, []);

  const togglePause = useCallback(() => {
    if (snapshot.status === 'running') controllerRef.current?.pause();
    else if (snapshot.status === 'paused') controllerRef.current?.resume();
  }, [snapshot.status]);

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      controllerRef.current?.setMuted(next);
      musicRef.current?.setMuted(next);
      writeMuted(next);
      return next;
    });
  }, []);

  // Kenyamanan di desktop; di HP semuanya lewat tombol.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
        event.preventDefault();
        togglePause();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePause]);

  const canPause = snapshot.status === 'running' || snapshot.status === 'paused';

  return (
    <main className="shell">
      <div className="topbar">
        <Link className="btn btn--small" href="/">
          ← {t('back')}
        </Link>
        <div>
          <span className="hud__label">{t('highScore')}</span>
          <div className="stat__value">{highScore}</div>
        </div>
      </div>

      <Hud snapshot={snapshot} />

      {/* Baru muncul setelah checkpoint pertama, supaya awal permainan tidak ramai. */}
      {snapshot.checkpointLevel !== null && (
        <div className="metabar">
          <span>
            <span className="hud__label">{t('checkpoint')}</span> Lv {snapshot.checkpointLevel}
          </span>
          <span>
            <span className="hud__label">{t('continues')}</span>{' '}
            {'●'.repeat(snapshot.continuesLeft) || '—'}
          </span>
        </div>
      )}

      <div className="board" ref={boardRef}>
        {snapshot.status === 'idle' && (
          <div className="overlay">
            <h2 className="overlay__title">{t('tapToStart')}</h2>
            <p className="overlay__hint">{t('tapToStartHint')}</p>
            <button className="btn btn--primary" type="button" onClick={start}>
              {t('tapToStart')}
            </button>
          </div>
        )}

        {tutorial !== null && (
          <TutorialCard topic={tutorial} level={snapshot.level} onDismiss={dismissTutorial} />
        )}

        {/* Overlay pause biasa disembunyikan saat kartu tutorial tampil: papan
            memang sedang dibekukan, tapi yang harus dibaca pemain adalah
            penjelasannya, bukan tombol "lanjut". */}
        {tutorial === null && snapshot.status === 'paused' && (
          <div className="overlay">
            <h2 className="overlay__title">{t('paused')}</h2>
            <button className="btn btn--primary" type="button" onClick={togglePause}>
              {t('resume')}
            </button>
          </div>
        )}

        {snapshot.status === 'gameOver' && (
          <div className="overlay">
            <h2 className="overlay__title">{t('gameOver')}</h2>
            <span className="hud__label">{t('finalScore')}</span>
            <div className="overlay__score">{snapshot.score}</div>
            {isNewRecord && <div className="overlay__record">★ {t('newRecord')}</div>}
            <div className="overlay__detail">
              <span>
                {t('bestCombo')}: {snapshot.bestCombo}
              </span>
              <span>
                {t('accuracy')}: {Math.round(snapshot.accuracy * 100)}%
              </span>
            </div>
            {snapshot.canContinue && snapshot.checkpointLevel !== null ? (
              <>
                <button className="btn btn--primary" type="button" onClick={continueRound}>
                  {t('continueFrom', { level: snapshot.checkpointLevel })}
                  <span className="badge">
                    {t('continuesLeft', { count: snapshot.continuesLeft })}
                  </span>
                </button>
                <button className="btn btn--small" type="button" onClick={start}>
                  {t('startOver')}
                </button>
              </>
            ) : (
              <button className="btn btn--primary" type="button" onClick={start}>
                {t('playAgain')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="controls">
        <button className="btn" type="button" onClick={togglePause} disabled={!canPause}>
          {snapshot.status === 'paused' ? t('resume') : t('pause')}
        </button>
        <button className="btn" type="button" onClick={toggleMute}>
          {muted ? t('muteOff') : t('muteOn')}
        </button>
      </div>
    </main>
  );
}
