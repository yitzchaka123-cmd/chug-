import { legalDocuments } from "../legal-content";
import { LegalPage } from "../legal-page";

export default function PrivacyPage() {
  return <LegalPage document={legalDocuments.privacy} />;
}
