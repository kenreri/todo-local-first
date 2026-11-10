import { useEffect, useState } from "react";
import { cn } from "../lib/cn";

/**
 * 远程壁纸层（M4.5-3）：固定全屏、随机二次元图、淡入。
 * - <img> + referrerPolicy=no-referrer：绕过常见图床防盗链（按 Referer 拦截外链）
 * - 加载成功才显示；失败 / 断网自动降级为渐变背景，界面永远可用
 * - 压暗纱走 --wallpaper-scrim token，保证上层文字对比度
 * - 弹窗锁滚动吞掉滚动条时，经 --scrollbar-comp 反向扣宽，壁纸不会跟着视口挪动
 */
export function WallpaperLayer({ url }: { url: string }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setReady(false);
    setFailed(false);
  }, [url]);

  if (!url || failed) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 overflow-hidden"
      style={{ width: "calc(100% - var(--scrollbar-comp, 0px))" }}
    >
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        onLoad={() => setReady(true)}
        onError={() => setFailed(true)}
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
          ready ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className="absolute inset-0 bg-[var(--wallpaper-scrim)]"
        style={{ opacity: "calc(0.2 + var(--wallpaper-dim, 40) / 50)" }}
      />
    </div>
  );
}
