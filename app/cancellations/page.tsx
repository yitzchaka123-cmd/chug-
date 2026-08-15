import { legalDocuments, legalDetails } from "../legal-content";
import { LegalPage } from "../legal-page";

const whatsappMessage = encodeURIComponent("Hello Nechama, I would like to request cancellation of a Choir Chug registration. Please tell me what details you need.");

export default function CancellationsPage() {
  return (
    <LegalPage
      document={legalDocuments.cancellations}
      actions={
        <div className="cancellation-actions" aria-label="Cancellation contact options">
          <a className="button" href={`https://wa.me/972535906149?text=${whatsappMessage}`} target="_blank" rel="noreferrer">Send written WhatsApp request</a>
          <a className="secondary-button" href="tel:+972535906149">Call {legalDetails.phone}</a>
        </div>
      }
    />
  );
}
