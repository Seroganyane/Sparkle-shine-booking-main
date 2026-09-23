export type Product = { id: string; name: string; price: number; desc?: string; image: string };

const shampooImg = "/products/shampoo.png";
const detailerImg = "/products/detailer.png";
const tireShineImg = "/products/tire-shine.png";

export const products: Product[] = [
  { id: "p1", name: "Premium Car Shampoo (1L)", price: 79.99, desc: "Gentle foaming shampoo for a streak-free finish.", image: shampooImg },
  { id: "p2", name: "Quick Detailer (500ml)", price: 49.5, desc: "Remove light dust and leave a glossy shine.", image: detailerImg },
  { id: "p3", name: "Tire Shine (400ml)", price: 39.99, desc: "Long-lasting tire dressing for a deep black finish.", image: tireShineImg },
  { id: "p4", name: "Microfiber Cloth (Pack of 3)", price: 59.0, desc: "Soft cloths safe for paint and glass.", image: detailerImg },
];
