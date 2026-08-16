export type LegalSection = {
  heading: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
};

export type LegalDocument = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: readonly LegalSection[];
};

export const legalDetails = {
  lastUpdated: "16 August 2026",
  operator: "The Choir Chug, operated by Nechama Abergil",
  location: "Beit Shemesh, Israel",
  phone: "053-590-6149",
} as const;

export const legalDocuments = {
  privacy: {
    eyebrow: "Your information",
    title: "Privacy Policy",
    intro:
      "This policy explains how The Choir Chug collects, uses, protects and retains parent and participant information through the registration and administration system.",
    sections: [
      {
        heading: "Who is responsible for the information",
        paragraphs: [
          `${legalDetails.operator}, ${legalDetails.location}, is responsible for the registration database. Privacy questions and requests may be made by phone at ${legalDetails.phone}.`,
        ],
      },
      {
        heading: "Information we may collect",
        bullets: [
          "Parent and child names, date of birth or age, telephone numbers and email addresses.",
          "Emergency contacts, allergies, medical information and accessibility or assistance needs supplied for the participant’s safety.",
          "Registration answers, group placement, schedule information, private administrative notes and communication history.",
          "Payment method, payment status, transaction reference and any payment-proof image a parent chooses to upload.",
          "Agreement version, paragraph approvals, parent declaration, electronic signature and the signed document record.",
          "Security and audit information such as date, time, IP address, device information and administrator activity.",
        ],
      },
      {
        heading: "Whether providing information is required",
        paragraphs: [
          "Providing information is voluntary and is not required by law. Certain fields will be marked as required because registration, parent contact, safe participation, payment administration or signing cannot be completed without them. If required information is not provided, we may be unable to accept or administer the registration. Optional medical details and optional media or marketing choices will be identified separately.",
        ],
      },
      {
        heading: "Why information is used",
        bullets: [
          "To process registration, form suitable groups and provide schedules and program updates.",
          "To carry out the registration agreement and maintain its signed record.",
          "To support the participant safely in an emergency and respond to disclosed needs.",
          "To record and verify payments, discounts and outstanding balances.",
          "To communicate with parents about the program and, only with a separate choice where required, send promotional messages.",
          "To secure the service, investigate misuse, maintain backups and comply with legal, accounting or authority requirements.",
        ],
      },
      {
        heading: "Sensitive information and uploaded payment proof",
        paragraphs: [
          "Medical information and financial activity can be information of special sensitivity. Only information genuinely needed for the program should be supplied. Parents should crop or cover account balances, account history, identity numbers and unrelated transactions before uploading payment proof. A transaction reference, date and amount should be offered instead of a screenshot whenever practical.",
        ],
      },
      {
        heading: "Who may receive information",
        paragraphs: [
          "Information may be accessed only by authorized Choir Chug administrators and by service providers needed for hosting, private file storage, security, backups and technical support. Professional advisers or public authorities may receive information where reasonably necessary or legally required. Personal information is not sold. Provider names, storage countries and any overseas safeguards must be listed here before public registration opens.",
        ],
      },
      {
        heading: "Retention and deletion",
        paragraphs: [
          "Information will be kept only for the time needed for the stated purpose and applicable legal obligations. Emergency and medical information and payment-proof images will have shorter retention than signed agreements and accounting records. Archiving a former student will not mean permanent retention. Exact retention periods and secure deletion rules will be finalized before launch and applied automatically where practical.",
        ],
      },
      {
        heading: "Security",
        paragraphs: [
          "The live system is intended to use protected administrator access, automatic logout, encrypted transmission and storage, private uploads, access logging, rate limits, backups and restricted exports. No internet service can promise absolute security. Parents should not send medical details or payment screenshots through ordinary messaging unless specifically instructed through a secure process.",
        ],
      },
      {
        heading: "Children, media and communications",
        paragraphs: [
          "A parent or legal guardian must provide a child’s information and confirm authority to do so. Choices for private parent-group sharing, an unlisted end-of-year video, public website use, social media or advertising will be presented separately and will not be preselected. Operational program messages will be distinguished from optional advertising.",
        ],
      },
      {
        heading: "Access and correction requests",
        paragraphs: [
          `Subject to Israeli law and legitimate retention duties, a person may ask to inspect information held about them and request correction of information that is incomplete, unclear or inaccurate. Requests may be made at ${legalDetails.phone}; identity may be verified before a request is completed.`,
        ],
      },
      {
        heading: "Cookies and analytics",
        paragraphs: [
          "The launch version should use only essential technology needed to operate and secure the site. If non-essential analytics, advertising pixels or profiling tools are added, they will remain off until the visitor makes an active choice, and this policy will identify the provider, purpose, duration and any overseas processing.",
        ],
      },
    ],
  },
  terms: {
    eyebrow: "Using this website",
    title: "Terms of Use",
    intro:
      "These terms govern use of The Choir Chug website. The separate annual Registration & Agreement Form governs participation in the program.",
    sections: [
      {
        heading: "Operator and contact",
        paragraphs: [
          `${legalDetails.operator}, ${legalDetails.location}. Telephone: ${legalDetails.phone}. Registration questions and requests are handled by phone or written message.`,
        ],
      },
      {
        heading: "Website information",
        paragraphs: [
          "Program descriptions, times, locations, prices and availability may change until a school year is finalized. The parent will see the applicable school-year details, full price, payment schedule, service dates and agreement before signing. If these terms conflict with mandatory Israeli law, the mandatory law prevails.",
        ],
      },
      {
        heading: "Parent responsibility",
        bullets: [
          "Provide accurate and current information and correct it when necessary.",
          "Register only as a parent or legal guardian with authority to provide the participant’s information and sign.",
          "Keep any private return, schedule or parent-group link confidential and notify The Choir Chug if it is exposed.",
          "Do not upload unlawful, malicious or unrelated files or information about other people without authority.",
        ],
      },
      {
        heading: "Registration, payment and cancellation",
        paragraphs: [
          `A registration becomes binding only after the applicable annual agreement is completed and the parent receives confirmation. Prices, payment methods, discount terms and cancellation information will be displayed before signing. Nothing on this website limits cancellation, refund or other rights that cannot lawfully be waived. Cancellation requests and transaction questions may be made by phone or written message to ${legalDetails.phone}.`,
        ],
      },
      {
        heading: "Medical and emergency information",
        paragraphs: [
          "By completing registration, the parent agrees that the allergy, medical and assistance information provided during registration may be used by authorized Choir Chug staff for the participant’s safe participation and in emergencies. Please provide only information that is relevant for the program.",
        ],
      },
      {
        heading: "Electronic agreement",
        paragraphs: [
          "The parent will be asked to confirm each agreement section, state an intention to sign electronically and add a signature. The system will retain the school year, agreement version, timestamps and audit record, and the completed document is available to download at the end of registration. A signed agreement will not be silently changed; a material change requires a new version and renewed approval.",
        ],
      },
      {
        heading: "Photos, recordings, lyrics and other content",
        paragraphs: [
          "Site photographs, the Choir Chug logo, recordings and written content may not be copied or reused without permission. Any parent media choices are governed by the annual agreement and the separate choices presented during registration. Parents must not submit lyrics, images or recordings unless they have the right to use them. An unlisted video remains subject to privacy and copyright obligations.",
        ],
      },
      {
        heading: "Availability and responsibility",
        paragraphs: [
          "Reasonable efforts will be made to keep the website accurate and available, but interruptions and errors can occur. To the maximum extent permitted by Israeli law, The Choir Chug is not responsible for indirect loss caused solely by temporary website unavailability. This does not exclude responsibility or consumer rights that the law does not allow to be excluded.",
        ],
      },
      {
        heading: "Privacy, security and misuse",
        paragraphs: [
          "Personal information is handled as described in the Privacy Policy. Attempts to bypass access controls, enter another family’s private page, scrape information, interfere with the service or introduce malicious code are prohibited.",
        ],
      },
      {
        heading: "Law and updates",
        paragraphs: [
          "These terms are governed by the laws of the State of Israel, subject to mandatory consumer and jurisdiction rules. The displayed last-updated date will change when terms are revised. Material changes affecting an existing signed registration will not replace the signed annual agreement without proper notice and renewed acceptance where required.",
        ],
      },
    ],
  },
  accessibility: {
    eyebrow: "Access for everyone",
    title: "Accessibility Statement",
    intro:
      "The Choir Chug is working toward an accessible website and registration experience for parents using different devices and assistive technologies.",
    sections: [
      {
        heading: "Accessibility target",
        paragraphs: [
          "The launch build is intended to meet the applicable requirements of Israeli Standard 5568 and WCAG Level AA. This statement does not claim completed compliance until the full live system, documents and registration flow have been tested.",
        ],
      },
      {
        heading: "Measures included in the design",
        bullets: [
          "Keyboard navigation, visible focus indicators and meaningful headings and labels.",
          "Readable contrast, scalable text and responsive layouts for desktop and mobile.",
          "Alternative text for meaningful images and accessible text alongside visual documents.",
          "Reduced-motion support for parallax and animation.",
          "Clear form errors, large touch targets and labelled checkboxes and upload controls.",
          "An accessible typed-signature option accompanies the drawing canvas.",
        ],
      },
      {
        heading: "Motion controls",
        paragraphs: [
          "The site follows the device’s reduced-motion preference. A visible site-level motion control will be added if testing shows the stronger parallax can otherwise make content difficult to use.",
        ],
      },
      {
        heading: "Physical access",
        paragraphs: [
          "Sessions may take place in Mishkafayim or RBSA. The final physical accessibility arrangements, accessible entrance and any assistance available will be added once the exact location for each group is confirmed.",
        ],
      },
      {
        heading: "Accessibility contact",
        paragraphs: [
          `If you encounter a barrier or need an accessible alternative, please call Nechama at ${legalDetails.phone}. Please describe the page, action and device involved.`,
        ],
      },
    ],
  },
} satisfies Record<string, LegalDocument>;
