import { CaseListPage } from "./CaseList";
import "../styles/design-lab.css";
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

const approvedCases = [case01, case02, case03, case04, case05, case06, case07, case08, case09, case10];

/** Development alias for the production homepage. Keeping one component here
 * prevents the approved Editorial Light composition from drifting. */
export function DesignLabPage() {
  return (
    <>
      <CaseListPage />
      <section className="casecrow-asset-lab" aria-labelledby="casecrow-asset-lab-title">
        <header>
          <p>Approved asset staging</p>
          <h2 id="casecrow-asset-lab-title">10 CaseCrow case studies</h2>
          <span>Slug mapping is intentionally pending. These assets are not connected to live prices or collections.</span>
        </header>
        <div className="casecrow-asset-lab__grid">
          {approvedCases.map((image, index) => (
            <figure key={image}>
              <img src={image} alt={`CaseCrow approved case concept ${String(index + 1).padStart(2, "0")}`} />
              <figcaption>CASE {String(index + 1).padStart(2, "0")} <small>UNMAPPED</small></figcaption>
            </figure>
          ))}
        </div>
      </section>
    </>
  );
}
