'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AVATAR_GLYPH, CHAT_MAX_LENGTH } from '@pixelmatrix/shared';
import type { ChatMessage } from '@pixelmatrix/shared';

export interface ChatPanelProps {
  readonly messages: readonly ChatMessage[];
  readonly playerId: string | null;
  /**
   * Chat aktif atau tidak. Ditentukan pemanggil dari jumlah pemain yang
   * tersambung — server menegakkan aturan yang sama, jadi ini murni petunjuk
   * supaya pemain tidak mengetik sesuatu yang pasti ditolak.
   */
  readonly enabled: boolean;
  onSend(text: string): void;
}

export function ChatPanel({ messages, playerId, enabled, onSend }: ChatPanelProps) {
  const t = useTranslations('room');
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLUListElement>(null);

  /**
   * Selalu gulir ke pesan terbaru.
   *
   * Tanpa ini, pesan baru masuk di bawah lipatan dan lobby terlihat seperti
   * tidak ada yang menjawab. Dipicu oleh JUMLAH pesan, bukan array-nya: array
   * baru dibuat setiap render dan akan membuat effect ini jalan terus.
   */
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages.length]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (text.length === 0) return;
    onSend(text);
    setDraft('');
  };

  return (
    <section className="chat">
      <h2 className="card__title">{t('chatTitle')}</h2>

      {messages.length === 0 ? (
        <p className="hint">{enabled ? t('chatEmpty') : t('chatWaiting')}</p>
      ) : (
        <ul className="chat__log" ref={logRef}>
          {messages.map((message) => (
            <li
              key={message.id}
              className={`chat__row${message.playerId === playerId ? ' chat__row--me' : ''}`}
            >
              <span className="avatarMark" aria-hidden="true">
                {AVATAR_GLYPH[message.avatar]}
              </span>
              <span className="chat__who">{message.nickname}</span>
              {/* Ditaruh sebagai text node, bukan HTML: pesan ini datang dari
                  pemain lain dan tidak boleh bisa menyuntikkan markup. React
                  meng-escape-nya, dan itu memang yang diandalkan di sini. */}
              <span className="chat__text">{message.text}</span>
            </li>
          ))}
        </ul>
      )}

      <form className="chat__form" onSubmit={submit}>
        <input
          className="input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={CHAT_MAX_LENGTH}
          placeholder={enabled ? t('chatPlaceholder') : t('chatWaiting')}
          disabled={!enabled}
          // Papan ketik HP: enter mengirim, bukan menambah baris.
          enterKeyHint="send"
          autoComplete="off"
        />
        <button
          className="btn btn--small"
          type="submit"
          disabled={!enabled || draft.trim().length === 0}
        >
          {t('chatSend')}
        </button>
      </form>
    </section>
  );
}
