import { useState, useRef, useEffect, FormEvent } from 'react';

interface ChatMessage {
  sender: string;
  message: string;
  timestamp: string;
}

interface GameChatProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  opponentUsername: string;
}

export function GameChat({ messages, onSend, opponentUsername }: GameChatProps) {
  const [input, setInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  const handleQuickEmoji = (emoji: string) => {
    onSend(emoji);
  };

  // Filter messages to hide opponent if muted
  const displayedMessages = isMuted
    ? messages.filter((msg) => msg.sender !== opponentUsername)
    : messages;

  return (
    <div className="flex h-[320px] flex-col rounded-3xl border border-gray-700 bg-gray-800/80 shadow-lg backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-green-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Live Chat</span>
        </div>
        <button
          type="button"
          onClick={() => setIsMuted(!isMuted)}
          className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition active:scale-95 ${
            isMuted
              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {isMuted ? '🔇 Muted' : '🔊 Mute Opponent'}
        </button>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        className="flex-grow overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-700"
      >
        {displayedMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-xs text-gray-500">
            No messages yet. Send a friendly greeting!
          </div>
        ) : (
          displayedMessages.map((msg, idx) => (
            <div key={idx} className="flex flex-col text-left">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-bold text-gray-200">{msg.sender}</span>
                <span className="text-[9px] text-gray-500">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-350 bg-gray-900/30 rounded-xl px-3 py-1.5 inline-block self-start max-w-[90%] break-words">
                {msg.message}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Quick Emojis */}
      <div className="flex items-center justify-around border-t border-gray-700/40 px-3 py-1 bg-gray-900/10">
        {['👍', '👎', '😊', '😮', '🎉', '🤝'].map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => handleQuickEmoji(emoji)}
            className="text-sm p-1 rounded-md transition hover:bg-gray-700 hover:scale-125"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-gray-700/60 p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-grow rounded-xl border border-gray-750 bg-gray-900 px-3 py-2 text-xs text-white placeholder-gray-600 outline-none transition focus:border-green-500"
          maxLength={200}
        />
        <button
          type="submit"
          className="rounded-xl bg-green-600 p-2 text-white transition hover:bg-green-500 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </form>
    </div>
  );
}

export default GameChat;
