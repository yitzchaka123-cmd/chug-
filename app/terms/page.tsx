import { legalDocuments } from "../legal-content";
import { LegalPage } from "../legal-page";

export default function TermsPage() {
  return <LegalPage document={legalDocuments.terms} />;
}
