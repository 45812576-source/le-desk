import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F0F4F8] flex flex-col items-center justify-center p-8">
      <div className="border-2 border-[#1A202C] bg-white p-8 flex flex-col items-center max-w-sm w-full">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-4">
          Le Desk
        </div>
        {/* Pixel art "404" */}
        <div className="grid grid-cols-4 gap-0.5 mb-6">
          {Array.from({ length: 32 }).map((_, i) => {
            const pixels = [
              1,0,0,1, 1,1,0,0, 0,1,0,1, 1,1,0,0,
              1,0,0,1, 1,0,1,0, 0,1,0,1, 1,0,1,0,
              1,1,1,1, 1,1,0,0, 0,1,0,1, 1,1,0,0,
              0,0,0,1, 0,0,1,0, 1,1,1,1, 0,0,1,0,
              // rows 5-8 empty (just padding)
            ];
            return (
              <div
                key={i}
                className="w-3 h-3"
                style={{ background: pixels[i] ? "#1A202C" : "transparent" }}
              />
            );
          })}
        </div>
        <div className="text-2xl font-bold font-mono mb-2">404</div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-6 text-center">
          页面不存在
        </div>
        <Link
          href="/"
          className="inline-flex items-center border-2 border-[#1A202C] px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-[#00D1FF] hover:bg-[#00A3C4] transition-colors text-[#1A202C]"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
