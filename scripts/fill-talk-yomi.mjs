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

function toReading(tokenizer, text) {
  const tokens = tokenizer.tokenize(String(text || ""));
  return tokens
    .map((token) => {
      const surface = token.surface_form || "";
      const reading = token.reading || token.pronunciation || "";

      if (reading && reading !== "*") {
        return kataToHira(reading);
      }
      return surface;
    })
    .join("");
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
    const answerYomi = String(row.answer_yomi || "").trim();

    return {
      ...row,
      answer_yomi: answerYomi || toReading(tokenizer, answerJp),
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