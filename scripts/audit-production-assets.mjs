#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const API_URL = process.env.CASES_API_URL ?? "https://cases-x18t.vercel.app/api/cases";
const OFFICIAL_SKINS_URL = "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json";
const OUTPUT_DIR = resolve(process.argv[2] ?? "artifacts/item-image-audit");
const EXTERIOR = / \((FN|MW|FT|WW|BS|Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/;

function normalize(name) {
  let value = name.replace(EXTERIOR, "").replace(/^★ /, "").trim();
  if (value.startsWith("Butterfly |")) value = `Butterfly Knife |${value.slice("Butterfly |".length)}`;
  return value;
}

function isPlaceholder(url) {
  return !url || url.startsWith("data:") || /placehold(?:er)?\.co/i.test(url);
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function inspectUrl(url) {
  if (!url) return { reachable: false, status: 0, contentType: "" };
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(15_000) });
    return {
      reachable: response.ok && (response.headers.get("content-type") ?? "").startsWith("image/"),
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      contentLength: response.headers.get("content-length") === null ? null : Number(response.headers.get("content-length")),
    };
  } catch (error) {
    return { reachable: false, status: 0, contentType: "", error: error instanceof Error ? error.message : String(error) };
  }
}

async function mapLimit(values, limit, worker) {
  const output = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      output[index] = await worker(values[index], index);
    }
  }));
  return output;
}

const [cases, officialSkins] = await Promise.all([fetchJson(API_URL), fetchJson(OFFICIAL_SKINS_URL)]);
const slugCounts = new Map();
for (const entry of cases) slugCounts.set(entry.slug, (slugCounts.get(entry.slug) ?? 0) + 1);
const slugIssues = cases
  .filter((entry) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) || slugCounts.get(entry.slug) !== 1)
  .map((entry) => entry.slug);
const officialByName = new Map(officialSkins.map((skin) => [normalize(skin.name), skin.image]));
const items = cases.flatMap((entry) => entry.items.map((item) => ({ caseName: entry.name, caseSlug: entry.slug, ...item })));

const rows = await mapLimit(items, 12, async (item) => {
  const normalizedName = normalize(item.name);
  const officialUrl = officialByName.get(normalizedName) ?? null;
  const [currentHttp, replacementHttp] = await Promise.all([
    inspectUrl(item.imageUrl),
    officialUrl && officialUrl !== item.imageUrl ? inspectUrl(officialUrl) : Promise.resolve(null),
  ]);
  const placeholder = isPlaceholder(item.imageUrl);
  const exactMatch = Boolean(officialUrl);
  const replacementAvailable = Boolean(officialUrl && (replacementHttp?.reachable || officialUrl === item.imageUrl));
  return {
    id: item.id,
    name: item.name,
    case: item.caseName,
    caseSlug: item.caseSlug,
    currentImageUrl: item.imageUrl,
    currentHttp,
    placeholder,
    exactOfficialMatch: exactMatch,
    officialImageUrl: officialUrl,
    replacementAvailable,
    needsReplacement: placeholder || !currentHttp.reachable || !exactMatch,
    resolution: replacementAvailable ? "official exact-name override" : "Editorial neutral fallback",
  };
});

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(resolve(OUTPUT_DIR, "items.json"), `${JSON.stringify(rows, null, 2)}\n`);

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const headers = ["name", "id", "case", "caseSlug", "currentImageUrl", "httpStatus", "contentType", "reachable", "placeholder", "exactOfficialMatch", "officialImageUrl", "replacementAvailable", "needsReplacement", "resolution"];
const csv = [headers.join(","), ...rows.map((row) => [
  row.name, row.id, row.case, row.caseSlug, row.currentImageUrl, row.currentHttp.status,
  row.currentHttp.contentType, row.currentHttp.reachable, row.placeholder, row.exactOfficialMatch,
  row.officialImageUrl, row.replacementAvailable, row.needsReplacement, row.resolution,
].map(csvCell).join(","))].join("\n");
await writeFile(resolve(OUTPUT_DIR, "items.csv"), `${csv}\n`);

const caseRows = await mapLimit(cases, 8, async (entry) => ({
  id: entry.id,
  name: entry.name,
  slug: entry.slug,
  priceMinor: entry.priceMinor,
  currency: entry.currency,
  itemCount: entry.items.length,
  isActive: entry.isActive,
  imageUrl: entry.imageUrl,
  imageHttp: await inspectUrl(entry.imageUrl),
  placeholder: isPlaceholder(entry.imageUrl),
  appearsToUseItemImage: /steamstatic\.com\/economy\/image/i.test(entry.imageUrl),
}));
await writeFile(resolve(OUTPUT_DIR, "cases.json"), `${JSON.stringify(caseRows, null, 2)}\n`);

const summary = {
  generatedAt: new Date().toISOString(),
  apiUrl: API_URL,
  activeCases: cases.length,
  items: rows.length,
  currentReachable: rows.filter((row) => row.currentHttp.reachable).length,
  placeholders: rows.filter((row) => row.placeholder).length,
  exactOfficialMatches: rows.filter((row) => row.exactOfficialMatch).length,
  officialReplacements: rows.filter((row) => row.replacementAvailable).length,
  fallbacksRequired: rows.filter((row) => !row.replacementAvailable).length,
  slugIssues,
  brokenCurrentItemUrls: rows.filter((row) => !row.currentHttp.reachable || row.currentHttp.contentLength === 0).length,
  brokenCaseImageUrls: caseRows.filter((row) => !row.imageHttp.reachable || row.imageHttp.contentLength === 0).length,
};
await writeFile(resolve(OUTPUT_DIR, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
