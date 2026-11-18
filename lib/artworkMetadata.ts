export type PrintSize = {
  name: string;
  price?: number;
};

export type ArtworkMetadata = {
  title?: string;
  year?: number;
  medium?: string;
  description?: string;

  featured?: boolean;

  originalAvailable?: boolean;
  originalDimensions?: string;

  printsAvailable?: boolean;

  printSizes?: string[];

  print?: {
    currency?: string;
    price?: number;

    sizes?: PrintSize[];

    paper?: string;
    finish?: string;
    framed?: boolean;
    framingDetails?: string;
  };
};

export const artworkMetadata: Record<string, ArtworkMetadata> = {
  /*
   * MELATONIA CITY
   */

  "Melatonia City/mama-africa.jpg": {
    title: "MAMA AFRICA",
    year: 2025,
    medium: "Digital artwork",

    description:
      "A contemporary digital work exploring identity, memory, culture and the enduring presence of Africa.",

    featured: true,

    originalAvailable: false,

    printsAvailable: true,

    printSizes: [],
  },

  "Melatonia City/mr-dreamer.jpg": {
    title: "MR. DREAMER",
    year: 2025,
    medium: "Digital artwork",

    description:
      "Mr. Dreamer is a recurring figure moving through imagined worlds, paintings and stories.",

    featured: true,

    originalAvailable: false,

    printsAvailable: true,

    printSizes: [],
  },

  /*
   * POINT OF VIEW
   */

  "Point-Of-View/boom-on-boomer.jpg": {
    title: "BOOM ON BOOMER",
    year: 2020,
    medium: "Painting",

    description:
      "A painting from 2020 exploring colour, energy and the collision of ideas.",

    featured: true,

    originalAvailable: false,

    printsAvailable: false,
  },

  /*
   * ADD MORE ARTWORK INFORMATION BELOW
   */
};