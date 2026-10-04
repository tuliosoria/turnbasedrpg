import { describe, expect, it } from "vitest";
import { emblemUrlsByHouse } from "./emblems";

describe("emblemUrlsByHouse", () => {
  it("mapeia emblem- para a sede e prefere a miniatura", () => {
    const urls = emblemUrlsByHouse([
      { entityId: "emblem-casa-khazdrun", thumbnailUrl: "https://img/thumb.png", storageUrl: "https://img/full.png" },
      { entityId: "khar-durak", thumbnailUrl: null, storageUrl: "https://img/cidade.png" },
      { entityId: null, thumbnailUrl: null, storageUrl: "https://img/solta.png" },
    ]);
    expect(urls).toEqual({ "casa-khazdrun": "https://img/thumb.png" });
  });

  it("cai na imagem cheia quando não há miniatura", () => {
    const urls = emblemUrlsByHouse([
      { entityId: "emblem-casa-solarion", thumbnailUrl: null, storageUrl: "https://img/solarion.png" },
    ]);
    expect(urls).toEqual({ "casa-solarion": "https://img/solarion.png" });
  });
});
