import { legalDocuments } from "../legal-content";
import { LegalPage } from "../legal-page";

export default function AccessibilityPage() {
  return <LegalPage document={legalDocuments.accessibility} />;
}
