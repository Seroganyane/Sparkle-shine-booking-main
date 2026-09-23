export type Product = { id: string; name: string; price: number; desc?: string; image: string };

export const products: Product[] = [
  { id: "air-fresheners", name: "Car air fresheners", price: 120, desc: "Car fragrance options.", image: "/products/air-fresheners.webp" },
  { id: "wiper-blades", name: "Windscreen wiper blades", price: 200, desc: "Replacement windscreen wiper blades.", image: "/products/wiper-blades.webp" },
  { id: "rubber-mats", name: "Rubber car mats", price: 360, desc: "All-weather rubber floor mats.", image: "/products/rubber-mats.webp" },
  { id: "carpet-mats", name: "Carpet car mats", price: 400, desc: "Universal carpet floor mats.", image: "/products/carpet-mats.webp" },
];
