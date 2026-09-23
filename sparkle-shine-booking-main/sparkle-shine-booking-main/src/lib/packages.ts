export type PackageId = "basic" | "premium" | "deluxe";

export const PACKAGES: { id: PackageId; name: string; price: number; cost: number; duration: string; features: string[] }[] = [
  {
    id: "basic",
    name: "Basic Shine",
    price: 15,
    cost: 5,
    duration: "20 min",
    features: ["Exterior wash", "Wheel rinse", "Hand dry"],
  },
  {
    id: "premium",
    name: "Premium Detail",
    price: 30,
    cost: 12,
    duration: "40 min",
    features: ["Everything in Basic", "Interior vacuum", "Tire shine", "Window polish"],
  },
  {
    id: "deluxe",
    name: "Deluxe Showroom",
    price: 55,
    cost: 22,
    duration: "75 min",
    features: ["Everything in Premium", "Hand wax", "Leather conditioning", "Engine bay clean"],
  },
];

export const getPackage = (id: PackageId) => PACKAGES.find((p) => p.id === id)!;