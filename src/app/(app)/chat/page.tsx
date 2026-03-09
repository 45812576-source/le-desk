export default function ChatEmptyPage() {
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div className="w-12 h-12 bg-[#00D1FF] pixel-border flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
        Le Desk
      </p>
      <p className="text-[10px] text-gray-400">
        点击上方「+ 新建对话」开始，或选择已有对话
      </p>
    </div>
  );
}
