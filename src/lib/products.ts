export type Product = { id: string; name: string; price: number; desc?: string };

export const products: Product[] = [
  { id: "p1", name: "Premium Car Shampoo (1L)", price: 79.99, desc: "Gentle foaming shampoo for a streak-free finish." },
  { id: "p2", name: "Quick Detailer (500ml)", price: 49.5, desc: "Remove light dust and leave a glossy shine." },
  { id: "p3", name: "Tire Shine (400ml)", price: 39.99, desc: "Long-lasting tire dressing for a deep black finish." },
  { id: "p4", name: "Microfiber Cloth (Pack of 3)", price: 59.0, desc: "Soft cloths safe for paint and glass." },
];
