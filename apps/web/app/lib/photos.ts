export const photo = (name: string) => `/photo/${name}.webp`;

const CAR: Record<string, [string, string]> = {
  "jac-t9": ["hero-jac", "show-jac"],
  "haval-h3": ["hero-haval", "show-haval"],
};

export const carStudio = (slug: string | undefined) => (slug && CAR[slug] ? photo(CAR[slug][0]) : null);
export const carTrail = (slug: string | undefined) => photo(slug && CAR[slug] ? CAR[slug][1] : "show-jac");

const WORK: Record<string, string> = {
  "Tank 300": "work-tank300",
  "Chery Tiggo 8 Pro": "work-tiggo",
  "Geely Monjaro": "work-monjaro",
  "Great Wall Poer": "work-poer",
  "Haval H5": "work-h5",
  "JAC T9": "hero-jac",
  "Haval H3": "hero-haval",
};

export const workPhoto = (car: string) => (WORK[car] ? photo(WORK[car]) : null);
