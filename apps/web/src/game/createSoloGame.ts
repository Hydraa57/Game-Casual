import * as Phaser from 'phaser';
import type { HudSnapshot } from '@pixelmatrix/shared';
import { BOARD_SIZE } from './BoardRenderer';
import { BoardScene } from './BoardScene';
import { Sfx } from './sfx';

export interface SoloController {
  start(): void;
  continueRound(): void;
  pause(): void;
  resume(): void;
  setMuted(muted: boolean): void;
  destroy(): void;
}

export interface CreateSoloGameOptions {
  readonly parent: HTMLElement;
  readonly onHud: (snapshot: HudSnapshot) => void;
  /** Hanya development — lihat `BoardSceneOptions.startLevel`. */
  readonly startLevel?: number;
}

export function createSoloGame({
  parent,
  onHud,
  startLevel,
}: CreateSoloGameOptions): SoloController {
  const sfx = new Sfx();
  const scene = new BoardScene({ onHud, sfx, startLevel });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    banner: false,
    // Papan selalu persegi dan ikut lebar container-nya — inilah yang membuat
    // grid 8×8 tetap identik di HP maupun desktop (hanya ukurannya berubah).
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      pixelArt: true,
      antialias: false,
    },
    // Audio ditangani sendiri lewat WebAudio (lihat sfx.ts), jadi Phaser tidak
    // perlu membuat AudioContext-nya sendiri.
    audio: { noAudio: true },
    scene,
  });

  return {
    start: () => scene.startRound(),
    continueRound: () => scene.continueRound(),
    pause: () => scene.pauseRound(),
    resume: () => scene.resumeRound(),
    setMuted: (muted: boolean) => sfx.setMuted(muted),
    destroy: () => {
      sfx.dispose();
      game.destroy(true);
    },
  };
}
