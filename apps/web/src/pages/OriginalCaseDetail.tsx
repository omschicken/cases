import { Navigate, useParams } from "react-router-dom";

/** Preserve collection bookmarks while using the server-backed case page. */
export function OriginalCaseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={slug ? `/cases/${encodeURIComponent(slug)}` : "/"} replace />;
}
