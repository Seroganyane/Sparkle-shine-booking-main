import { Button } from "@/components/ui/button";
import { Product } from "@/lib/products";
import { FC } from "react";

export const ProductCard: FC<{ product: Product; onAdd: (p: Product) => void }> = ({ product, onAdd }) => {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-sm text-muted-foreground">{product.name}</div>
      <div className="mt-2 font-display text-lg font-semibold">R {product.price.toFixed(2)}</div>
      {product.desc && <div className="mt-2 text-sm text-muted-foreground">{product.desc}</div>}
      <div className="mt-4">
        <Button onClick={() => onAdd(product)} size="sm" variant="hero">
          Add to cart
        </Button>
      </div>
    </div>
  );
};

export default ProductCard;
