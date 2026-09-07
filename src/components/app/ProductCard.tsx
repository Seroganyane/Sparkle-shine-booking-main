import { Button } from "@/components/ui/button";
import { Product } from "@/lib/products";
import { FC } from "react";

export const ProductCard: FC<{ product: Product; onAdd: (p: Product) => void }> = ({ product, onAdd }) => {
  return (
    <div className="group relative overflow-hidden rounded-none bg-transparent transition-transform duration-200 hover:-translate-y-0.5">
      <div className="overflow-hidden bg-transparent p-0">
        <img
          src={product.image}
          alt={product.name}
          className="h-64 w-full object-contain bg-transparent transition duration-300 group-hover:scale-[1.02]"
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">{product.name}</div>
          <div className="text-sm text-muted-foreground">R {product.price.toFixed(2)}</div>
        </div>
        <Button onClick={() => onAdd(product)} size="sm" variant="hero">
          Add
        </Button>
      </div>
    </div>
  );
};

export default ProductCard;
