import type { PDFFont } from "pdf-lib";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export const PDF_FONT_FAMILY = "IBM Plex Sans";

export type PdfDocumentFonts = {
  regular: PDFFont;
  semiBold: PDFFont;
};

const IBM_PLEX_FONT_PATHS = {
  regular: "/fonts/IBMPlexSans-Regular.ttf",
  semiBold: "/fonts/IBMPlexSans-SemiBold.ttf",
} as const;

const fontBytesPromises = new Map<string, Promise<Uint8Array>>();

async function loadFontBytes(publicPath: string) {
  const cached = fontBytesPromises.get(publicPath);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    if (typeof window === "undefined") {
      const { readFileSync } = await import("node:fs");
      const { join } = await import("node:path");
      const filePath = join(process.cwd(), "public", publicPath.replace(/^\//, ""));
      return new Uint8Array(readFileSync(filePath));
    }

    const response = await fetch(publicPath);
    if (!response.ok) {
      throw new Error(`Не удалось загрузить шрифт IBM Plex для PDF: ${publicPath}`);
    }

    return new Uint8Array(await response.arrayBuffer());
  })();

  fontBytesPromises.set(publicPath, promise);
  return promise;
}

export async function createVectorPdfDocument() {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const [regularBytes, semiBoldBytes] = await Promise.all([
    loadFontBytes(IBM_PLEX_FONT_PATHS.regular),
    loadFontBytes(IBM_PLEX_FONT_PATHS.semiBold),
  ]);

  const [regular, semiBold] = await Promise.all([
    pdfDoc.embedFont(regularBytes, { subset: true }),
    pdfDoc.embedFont(semiBoldBytes, { subset: true }),
  ]);

  return {
    pdfDoc,
    fonts: { regular, semiBold } satisfies PdfDocumentFonts,
  };
}
