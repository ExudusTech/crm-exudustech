const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function padToNaturalHour(hour: string, minute?: string) {
  const normalizedHour = Number(hour);
  const normalizedMinute = Number(minute || "0");

  if (normalizedMinute === 0) return `${normalizedHour}`;
  if (normalizedMinute < 10) return `${normalizedHour} e zero ${normalizedMinute}`;
  return `${normalizedHour} e ${normalizedMinute}`;
}

function formatDate(day: string, month: string, year: string) {
  const monthIndex = Number(month) - 1;
  const monthName = MONTH_NAMES[monthIndex];
  if (!monthName) return `${day}/${month}/${year}`;
  return `${Number(day)} de ${monthName} de ${year}`;
}

function normalizeDateAndTime(text: string) {
  return text
    .replace(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g, (_, day, month, year) => formatDate(day, month, year))
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, year, month, day) => formatDate(day, month, year))
    .replace(/\b(\d{1,2})h(\d{2})\s*(?:às|as|a)\s*(\d{1,2})h(\d{2})\b/gi, (_, h1, m1, h2, m2) => {
      return `das ${padToNaturalHour(h1, m1)} às ${padToNaturalHour(h2, m2)}`;
    })
    .replace(/\b(\d{1,2}):(\d{2})\s*(?:às|as|a)\s*(\d{1,2}):(\d{2})\b/g, (_, h1, m1, h2, m2) => {
      return `das ${padToNaturalHour(h1, m1)} às ${padToNaturalHour(h2, m2)}`;
    })
    .replace(/\b(\d{1,2})h(\d{2})\b/gi, (_, hour, minute) => `${padToNaturalHour(hour, minute)}`)
    .replace(/\b(\d{1,2})h\b/gi, (_, hour) => `${padToNaturalHour(hour)}`)
    .replace(/\b(\d{1,2}):(\d{2})\b/g, (_, hour, minute) => `${padToNaturalHour(hour, minute)}`);
}

export function cleanForSpeech(text: string): string {
  let clean = text;

  clean = clean.replace(/#{1,6}\s*/g, "");
  clean = clean.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1");
  clean = clean.replace(/_([^_]+)_/g, "$1");
  clean = clean.replace(/```[\s\S]*?```/g, "");
  clean = clean.replace(/`([^`]+)`/g, "$1");
  clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  clean = clean.replace(/https?:\/\/\S+/g, "");
  clean = clean.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/gu, "");
  clean = clean.replace(/\|/g, ", ");
  clean = clean.replace(/[-]{3,}/g, "");
  clean = clean.replace(/^[-•*]\s*/gm, "");
  clean = clean.replace(/^\d+\.\s*/gm, "");
  clean = clean.replace(/^>\s*/gm, "");
  clean = clean.replace(/^---+$/gm, "");
  clean = clean.replace(/^\*\*\*+$/gm, "");
  clean = clean.replace(/\//g, " ");
  clean = clean.replace(/\\/g, " ");
  clean = clean.replace(/[<>{}[\]()]/g, "");
  clean = clean.replace(/&/g, " e ");
  clean = clean.replace(/@/g, " arroba ");
  clean = clean.replace(/#/g, "");
  clean = clean.replace(/\s*:\s*/g, ". ");
  clean = clean.replace(/\n+/g, ". ");

  clean = normalizeDateAndTime(clean);

  clean = clean.replace(/,\s*,/g, ",");
  clean = clean.replace(/\.\s*\./g, ".");
  clean = clean.replace(/\s{2,}/g, " ");
  clean = clean.trim();
  clean = clean.replace(/^[.,;:\s]+/, "");
  clean = clean.replace(/[,;:\s]+$/, "");

  return clean;
}

export function splitIntoSpeechChunks(text: string): string[] {
  const chunks = text
    .split(/(?<=[.!?;])\s+|(?<=,)\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9])/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .flatMap((chunk) => {
      if (chunk.length <= 180) return [chunk];

      return chunk
        .split(/,\s+/)
        .map((piece, index, arr) => {
          const trimmed = piece.trim();
          if (!trimmed) return "";
          return index < arr.length - 1 ? `${trimmed},` : trimmed;
        })
        .filter(Boolean);
    });

  return chunks.length > 0 ? chunks : [text];
}