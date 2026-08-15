export const choirConfig = {
  brand: {
    name: "The Choir Chug",
    descriptor: "Professional Girls’ Choir",
    phone: "053-590-6149",
    logo: "/choir-chug-logo-transparent.png",
  },
  currentYear: {
    label: "2026–2027",
    day: "Wednesdays",
    sessionLength: "50 minutes",
    timeWindow: "Between 5:00–7:00 p.m.",
    dates: "September 2026–June 15, 2027",
    location: "Mishkafayim or RBSA",
    monthlyFee: "₪200",
    juneFee: "₪100",
    payment: {
      monthlyAmount: 200,
      juneAmount: 100,
      registrationFeeAmount: 200,
      choirYearTotal: 1900,
      securityCheckAmount: 1700,
      securityCheckMonths: "October–June",
      proofUpload: "required" as "required" | "optional",
      methods: ["Bank transfer", "Bit", "Standing order", "Checks", "Cash"],
    },
  },
  landing: {
    eyebrow: "A professional girls’ choir in Beit Shemesh",
    headline: "A place for her voice to grow.",
    intro:
      "Vocal technique, real studio recordings, confidence and friendship  -  in one uplifting weekly experience.",
    benefits: [
      {
        number: "01",
        title: "Vocal technique",
        body: "Learn how to sing with control, strength and confidence.",
        photo: "/photos/studio-keyboard.jpg",
      },
      {
        number: "02",
        title: "Studio recording",
        body: "Experience the excitement and focus of recording behind a real microphone.",
        photo: "/photos/studio-solo-pink.jpg",
      },
      {
        number: "03",
        title: "Confidence & friendship",
        body: "Grow in a warm group where every girl has a place and a voice.",
        photo: "/photos/studio-friends.jpg",
      },
      {
        number: "04",
        title: "End-of-year video",
        body: "Celebrate the year together in a special final production.",
        photo: "/photos/studio-yellow.jpg",
      },
    ],
  },
  photos: {
    hero: "/photos/hero-group.jpg",
    studioFriends: "/photos/studio-friends.jpg",
    studioKeyboard: "/photos/studio-keyboard.jpg",
    studioSoloPink: "/photos/studio-solo-pink.jpg",
    studioLyrics: "/photos/studio-lyrics.jpg",
    studioYellow: "/photos/studio-yellow.jpg",
  },
} as const;

export type ChoirConfig = typeof choirConfig;
