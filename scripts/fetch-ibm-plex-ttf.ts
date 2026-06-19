import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const FONT_SOURCES = {
  "IBMPlexSans-Regular.ttf":
    "https://cdn.jsdelivr.net/gh/IBM/plex@v6.4.1/IBM-Plex-Sans/fonts/complete/ttf/IBMPlexSans-Regular.ttf",
  "IBMPlexSans-SemiBold.ttf":
    "https://cdn.jsdelivr.net/gh/IBM/plex@v6.4.1/IBM-Plex-Sans/fonts/complete/ttf/IBMPlexSans-SemiBold.ttf",
} as const;

async function main() {
  for (const [fileName, url] of Object.entries(FONT_SOURCES)) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Не удалось скачать ${fileName}: ${response.status}`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const targetPath = join(process.cwd(), "public/fonts", fileName);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, bytes);
    console.log(fileName, bytes.length);
  }
}

main();
