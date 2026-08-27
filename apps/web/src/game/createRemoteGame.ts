import * as Phaser from 'phaser';
import { BOARD_SIZE } from './BoardRenderer';
import { RemoteBoardScene } from './RemoteBoardScene';
import { buatSfx } from './audio';

export interface RemoteController {
  readonly scene: RemoteBoardScene;
  unlockAudio(): void;
  setMuted(muted: boolean): void;
  destroy(): void;
}

export interface CreateRemoteGameOptions {
  readonly parent: HTMLElement;
  readonly onTapPixel: (pixelId: string) => void;
}

export function createRemoteGame({
  parent,
  onTapPixel,
}: CreateRemoteGameOptions): RemoteController {
  const sfx = buatSfx();
  const scene = new RemoteBoardScene({ onTapPixel, sfx });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    banner: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { pixelArt: true, antialias: false },
    audio: { noAudio: true },
    scene,
  });

  return {
    scene,
    unlockAudio: () => sfx.unlock(),
    setMuted: (muted: boolean) => sfx.setMuted(muted),
    destroy: () => {
      sfx.dispose();
      game.destroy(true);
    },
  };
}
