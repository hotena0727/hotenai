import fs from "fs/promises";
import path from "path";
import kuromoji from "kuromoji";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

const INPUT_CSV = path.resolve("public/csv/talk_situations.csv");
const OUTPUT_CSV = path.resolve("public/csv/talk_situations.with-yomi.csv");

function kataToHira(text = "") {
  return String(text).replace(/[ァ-ン]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function buildTokenizer() {
  return new Promise((resolve, reject) => {
    kuromoji
      .builder({ dicPath: "node_modules/kuromoji/dict" })
      .build((err, tokenizer) => {
        if (err) reject(err);
        else resolve(tokenizer);
      });
  });
}

function normalizeYomi(text = "") {
  return String(text)
    .replace(/[、。．，,！？!？?「」『』（）()\[\]{}…~"'`´]/g, "")
    .replace(/\s+/g, "")
    .replace(/ぐらい/g, "くらい");
}

function fixCommonNumberReadings(text = "") {
  return String(text)
    .replace(/いちせん/g, "いっせん")
    .replace(/さんせん/g, "さんぜん")
    .replace(/はちせん/g, "はっせん")
    .replace(/さんひゃく/g, "さんびゃく")
    .replace(/ろくひゃく/g, "ろっぴゃく")
    .replace(/はちひゃく/g, "はっぴゃく");
}

function fixPhraseReadings(text = "") {
  return String(text)
    .replace(/ひとつじょう/g, "ひとつうえ")
    .replace(/一つ上/g, "ひとつうえ");
}

function digitToJapanese(n) {
  const map = ["", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"];
  return map[n] || "";
}

function readUnder10000(num) {
  const n = Number(num);
  if (!Number.isInteger(n) || n < 0 || n >= 10000) return String(num);

  if (n === 0) return "ぜろ";

  let result = "";
  const thousands = Math.floor(n / 1000);
  const hundreds = Math.floor((n % 1000) / 100);
  const tens = Math.floor((n % 100) / 10);
  const ones = n % 10;

  if (thousands > 0) {
    if (thousands === 1) result += "せん";
    else if (thousands === 3) result += "さんぜん";
    else if (thousands === 8) result += "はっせん";
    else result += `${digitToJapanese(thousands)}せん`;
  }

  if (hundreds > 0) {
    if (hundreds === 1) result += "ひゃく";
    else if (hundreds === 3) result += "さんびゃく";
    else if (hundreds === 6) result += "ろっぴゃく";
    else if (hundreds === 8) result += "はっぴゃく";
    else result += `${digitToJapanese(hundreds)}ひゃく`;
  }

  if (tens > 0) {
    if (tens === 1) result += "じゅう";
    else result += `${digitToJapanese(tens)}じゅう`;
  }

  if (ones > 0) {
    result += digitToJapanese(ones);
  }

  return result;
}

function convertNumberYenToReading(text = "") {
  return String(text).replace(/(\d[\d,]*)円/g, (_, rawNum) => {
    const normalized = String(rawNum).replace(/,/g, "");
    const n = Number(normalized);

    if (!Number.isInteger(n) || n < 0) {
      return `${normalized}円`;
    }

    if (n < 10000) {
      return `${readUnder10000(n)}えん`;
    }

    return `${normalized}円`;
  });
}

function preprocessJapaneseText(text = "") {
  return fixPhraseReadings(
    fixCommonNumberReadings(
      normalizeYomi(
        convertNumberYenToReading(String(text))
      )
    )
  );
}

function toReading(tokenizer, text) {
  const preprocessed = preprocessJapaneseText(text);
  const tokens = tokenizer.tokenize(preprocessed);

  const rawReading = tokens
    .map((token) => {
      const surface = token.surface_form || "";
      const reading = token.reading || token.pronunciation || "";

      if (reading && reading !== "*") {
        return kataToHira(reading);
      }
      return surface;
    })
    .join("");

  return fixPhraseReadings(
    normalizeYomi(
      fixCommonNumberReadings(rawReading)
    )
  );
}

async function main() {
  const raw = await fs.readFile(INPUT_CSV, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
  });

  const tokenizer = await buildTokenizer();

  const nextRows = rows.map((row) => {
    const answerJp = String(row.answer_jp || "").trim();

    return {
      ...row,
      answer_yomi: toReading(tokenizer, answerJp),
    };
  });

  const csv = stringify(nextRows, {
    header: true,
  });

  await fs.writeFile(OUTPUT_CSV, csv, "utf8");
  console.log(`완료: ${OUTPUT_CSV}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});