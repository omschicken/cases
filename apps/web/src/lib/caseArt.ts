import case01 from "../assets/casecrow-approved/cases/webp/case_01.webp";
import case02 from "../assets/casecrow-approved/cases/webp/case_02.webp";
import case03 from "../assets/casecrow-approved/cases/webp/case_03.webp";
import case04 from "../assets/casecrow-approved/cases/webp/case_04.webp";
import case05 from "../assets/casecrow-approved/cases/webp/case_05.webp";
import case06 from "../assets/casecrow-approved/cases/webp/case_06.webp";
import case07 from "../assets/casecrow-approved/cases/webp/case_07.webp";
import case08 from "../assets/casecrow-approved/cases/webp/case_08.webp";
import case09 from "../assets/casecrow-approved/cases/webp/case_09.webp";
import case10 from "../assets/casecrow-approved/cases/webp/case_10.webp";
import { CASECROW_ORIGINALS_BY_SLUG } from "./casecrowOriginals";

export const CASE_ART_BY_SLUG = {
  static: case01,
  ignition: case02,
  tidal: case03,
  phantom: case04,
  "neon-rush": case05,
  sovereign: case06,
  dragon: case07,
  aurora: case08,
  overdrive: case09,
  blacklight: case10,
  "static-case-v3": case01,
  "ignition-case-v4": case02,
  "sovereign-case-v3": case06,
  "overdrive-case-v3": case09,
  "blacklight-case-v4": case10,
} as const satisfies Record<string, string>;

export type ApprovedCaseSlug = keyof typeof CASE_ART_BY_SLUG;

export const APPROVED_CASE_SLUGS = Object.freeze(
  Object.keys(CASE_ART_BY_SLUG) as ApprovedCaseSlug[],
);

export function hasApprovedCaseArt(slug: string): slug is ApprovedCaseSlug {
  return Object.prototype.hasOwnProperty.call(CASE_ART_BY_SLUG, slug);
}

export function resolveCaseArt(slug: string, fallback?: string | null): string {
  return CASECROW_ORIGINALS_BY_SLUG.get(slug)?.imageUrl ?? (hasApprovedCaseArt(slug) ? CASE_ART_BY_SLUG[slug] : (fallback ?? ""));
}

export function caseVersionLabel(slug: string): string | null {
  const match = slug.match(/-v(\d+)$/i);
  return match ? `V${match[1]}` : null;
}
