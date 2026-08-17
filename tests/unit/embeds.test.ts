import { describe, expect, it } from "vitest";
import { parseEmbed } from "@/lib/embeds";

function parsed(raw: string, kind?: "video" | "tour" | "floorplan" | "doc") {
  const result = parseEmbed(raw, kind);
  if (!result.ok) throw new Error(result.error);
  return result.embed;
}

describe("parseEmbed", () => {
  it("reads YouTube watch, short and shorts links", () => {
    for (const raw of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "youtube.com/embed/dQw4w9WgXcQ",
    ]) {
      const embed = parsed(raw);
      expect(embed.provider).toBe("youtube");
      expect(embed.kind).toBe("video");
      expect(embed.embedUrl).toBe(
        "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
      );
    }
  });

  it("reads Vimeo page and player links", () => {
    expect(parsed("https://vimeo.com/76979871").embedUrl).toBe(
      "https://player.vimeo.com/video/76979871",
    );
    expect(parsed("https://player.vimeo.com/video/76979871").provider).toBe("vimeo");
  });

  it("keeps the Matterport model id and classifies it as a tour", () => {
    const embed = parsed("https://my.matterport.com/show/?m=SxQL3iGyoDo&play=1");
    expect(embed.provider).toBe("matterport");
    expect(embed.kind).toBe("tour");
    expect(embed.embedUrl).toBe("https://my.matterport.com/show/?m=SxQL3iGyoDo");
  });

  it("rejects Matterport links without a model", () => {
    const result = parseEmbed("https://my.matterport.com/show/");
    expect(result.ok).toBe(false);
  });

  it("treats iGuide as a tour and CubiCasa as a floor plan", () => {
    expect(parsed("https://youriguide.com/123_main_st_toronto").kind).toBe("tour");
    expect(parsed("https://app.cubi.casa/order/9911").kind).toBe("floorplan");
  });

  it("links out instead of framing unknown hosts", () => {
    const embed = parsed("https://tours.example.com/abc", "tour");
    expect(embed.provider).toBe("link");
    expect(embed.embedUrl).toBeNull();
    expect(embed.kind).toBe("tour");
  });

  it("upgrades bare hosts to https and refuses junk", () => {
    expect(parsed("vimeo.com/76979871").canonicalUrl).toBe("https://vimeo.com/76979871");
    expect(parseEmbed("javascript:alert(1)").ok).toBe(false);
    expect(parseEmbed("   ").ok).toBe(false);
  });
});
