export type Product = {
  id: string;
  name: string;
  price: number;
  description: string;
};

export const products: Product[] = [
  {
    id: "p1",
    name: "Premium Car Shampoo (1L)",
    price: 79.99,
    description: "Gentle foaming shampoo for a streak-free finish.",
  },
  {
    id: "p2",
    name: "Quick Detailer (500ml)",
    price: 49.5,
    description: "Remove light dust and leave a glossy shine.",
  },
  {
    id: "p3",
    name: "Tire Shine (400ml)",
    price: 39.99,
    description: "Long-lasting tire dressing for a deep black finish.",
  },
  {
    id: "p4",
    name: "Microfiber Cloth (Pack of 3)",
    price: 59.0,
    description: "Soft cloths safe for paint and glass.",
  },
];
