import { afterEach, describe, expect, it, vi } from "vitest";
import { ANIME_COVER_CACHE, getAnimeCover } from "./animeCoverCache";

const image = () => new Blob(["image-bytes"], { type: "image/jpeg" });
function setup() {
  const saved = new Map<string, Response>();
  const cache = {
    match: vi.fn(async (url: string) => saved.get(url)?.clone()),
    put: vi.fn(async (url: string, response: Response) => { saved.set(url, response.clone()); }),
    delete: vi.fn(async (key: string | Request) => saved.delete(typeof key === "string" ? key : key.url)),
    keys: vi.fn(async () => [...saved.keys()].map((url) => new Request(url))),
  };
  const open = vi.fn(async () => cache);
  const fetchImage = vi.fn(async () => new Response(image()));
  vi.stubGlobal("caches", { open });
  vi.stubGlobal("fetch", fetchImage);
  return { saved, cache, open, fetchImage };
}
afterEach(() => vi.unstubAllGlobals());

describe("anime cover persistent cache", () => {
  it("downloads once and subsequently reads a durable image without network", async () => {
    const { fetchImage, open } = setup();
    const url = "https://lain.bgm.tv/cover.jpg";
    expect((await getAnimeCover(url))?.size).toBeGreaterThan(0);
    fetchImage.mockRejectedValue(new Error("offline"));
    expect((await getAnimeCover(url))?.type).toBe("image/jpeg");
    expect(fetchImage).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(ANIME_COVER_CACHE);
  });
  it("shares concurrent requests for the same cover", async () => {
    const { fetchImage } = setup();
    await Promise.all([getAnimeCover("https://lain.bgm.tv/same.jpg"), getAnimeCover("https://lain.bgm.tv/same.jpg")]);
    expect(fetchImage).toHaveBeenCalledTimes(1);
  });
  it("fetches the changed URL without serving the old image", async () => {
    const { fetchImage } = setup();
    await getAnimeCover("https://lain.bgm.tv/old.jpg");
    await getAnimeCover("https://lain.bgm.tv/new.jpg");
    expect(fetchImage).toHaveBeenCalledTimes(2);
  });
  it("allows retry after network failure", async () => {
    const { fetchImage } = setup();
    fetchImage.mockRejectedValueOnce(new Error("offline"));
    expect(await getAnimeCover("https://lain.bgm.tv/retry.jpg")).toBeNull();
    expect(await getAnimeCover("https://lain.bgm.tv/retry.jpg")).not.toBeNull();
  });
  it("continues displaying downloaded images when storage is unavailable or full", async () => {
    const { open, cache } = setup();
    open.mockRejectedValueOnce(new Error("disabled"));
    expect(await getAnimeCover("https://lain.bgm.tv/disabled.jpg")).not.toBeNull();
    cache.put.mockRejectedValueOnce(new Error("quota"));
    expect(await getAnimeCover("https://lain.bgm.tv/quota.jpg")).not.toBeNull();
  });
  it("does not cache error pages or oversized images", async () => {
    const { fetchImage, cache } = setup();
    fetchImage.mockResolvedValueOnce(new Response("error", {status: 404}));
    expect(await getAnimeCover("https://lain.bgm.tv/missing.jpg")).toBeNull();
    fetchImage.mockResolvedValueOnce(new Response("html", {headers:{"Content-Type":"text/html"}}));
    expect(await getAnimeCover("https://lain.bgm.tv/html.jpg")).toBeNull();
    fetchImage.mockResolvedValueOnce(new Response(new Blob([new Uint8Array(8*1024*1024+1)],{type:"image/png"})));
    expect(await getAnimeCover("https://lain.bgm.tv/huge.jpg")).toBeNull();
    expect(cache.put).not.toHaveBeenCalled();
  });
  it("bounds the cache and replaces malformed entries", async () => {
    const { saved, cache } = setup();
    for (let i=0;i<200;i++) saved.set(`https://lain.bgm.tv/${i}.jpg`, new Response(image()));
    saved.set("https://lain.bgm.tv/bad.jpg", new Response("bad"));
    expect(await getAnimeCover("https://lain.bgm.tv/bad.jpg")).not.toBeNull();
    expect(saved.size).toBe(200);
    expect(cache.delete).toHaveBeenCalled();
  });
  it("rejects missing or non-http URLs without network", async () => {
    const { fetchImage } = setup();
    expect(await getAnimeCover("")).toBeNull();
    expect(await getAnimeCover("javascript:alert(1)")).toBeNull();
    expect(fetchImage).not.toHaveBeenCalled();
  });
});
