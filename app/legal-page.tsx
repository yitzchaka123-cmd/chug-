import Link from "next/link";
import { ReactNode } from "react";
import { legalDetails, type LegalDocument } from "./legal-content";
import { choirConfig } from "./site-config";

export function LegalPage({ document, actions }: { document: LegalDocument; actions?: ReactNode }) {
  return (
    <main className="legal-shell">
      <header className="legal-header">
        <Link href="/" aria-label="The Choir Chug home"><img src={choirConfig.brand.logo} alt="The Choir Chug" /></Link>
        <nav aria-label="Legal page navigation"><Link href="/">Home</Link><Link className="nav-register" href="/register">Register</Link></nav>
      </header>
      <article className="legal-document">
        <div className="legal-title"><p className="eyebrow">{document.eyebrow}</p><h1>{document.title}</h1><p>{document.intro}</p><small>Last updated: {legalDetails.lastUpdated}</small></div>
        {actions}
        <div className="legal-sections">
          {document.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
            </section>
          ))}
        </div>
      </article>
      <footer className="legal-footer"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/accessibility">Accessibility</Link></footer>
    </main>
  );
}
