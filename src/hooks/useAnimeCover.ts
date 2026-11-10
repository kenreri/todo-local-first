import { useEffect, useState } from "react";
import { getAnimeCover } from "../lib/animeCoverCache";

/** Never expose a previous cover while its URL changes; release each object URL. */
export function useAnimeCover(url: string | null) {
  const [result, setResult] = useState<{ url: string; src: string } | null>(null);
  useEffect(() => {
    if (!url) return;
    let active = true;
    let objectUrl: string | undefined;
    void getAnimeCover(url).then((blob) => {
      if (!active) return;
      objectUrl = blob ? URL.createObjectURL(blob) : undefined;
      setResult({ url, src: objectUrl ?? url });
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  return result?.url === url ? result.src : null;
}
