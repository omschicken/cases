import { CaseListPage } from "./CaseList";

/** Development alias for the production homepage. Keeping one component here
 * prevents the approved Editorial Light composition from drifting. */
export function DesignLabPage() {
  return <CaseListPage />;
}
