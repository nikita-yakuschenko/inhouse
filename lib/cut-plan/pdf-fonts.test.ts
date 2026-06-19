import { readFileSync } from "node:fs";
import { join } from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { describe, expect, it } from "vitest";

import { createVectorPdfDocument } from "@/lib/cut-plan/pdf-document-fonts";
import { drawPdfText } from "@/lib/cut-plan/pdf-text";

describe("IBM Plex PDF fonts", () => {
  it("embeds cyrillic glyphs from complete TTF files", async () => {
    const { pdfDoc, fonts } = await createVectorPdfDocument();
    const page = pdfDoc.addPage([400, 120]);

    drawPdfText(page, fonts, {
      text: "П(Ц)-1",
      x: 40,
      y: 80,
      sizePt: 14,
      color: { r: 0, g: 0, b: 0 },
    });

    const width = fonts.regular.widthOfTextAtSize("П(Ц)-1", 14);
    expect(width).toBeGreaterThan(20);

    const bytes = await pdfDoc.save();
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text).not.toMatch(/\/Subtype\s*\/Image/);
  });

  it("uses unicode cmap in bundled IBM Plex TTF", () => {
    const bytes = readFileSync(join(process.cwd(), "public/fonts/IBMPlexSans-Regular.ttf"));
    const font = fontkit.create(bytes);
    const glyph = font.glyphForCodePoint(0x041f);
    expect(glyph.id).toBeGreaterThan(0);
  });
});
