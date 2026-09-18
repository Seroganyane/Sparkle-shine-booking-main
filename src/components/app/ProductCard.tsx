import { Button } from "@/components/ui/button";
import { Product } from "@/lib/products";
import { FC } from "react";

export const ProductCard: FC<{ product: Product; onAdd: (p: Product) => void }> = ({ product, onAdd }) => {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card/70 p-4 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex h-64 items-center justify-center overflow-hidden rounded-lg bg-background/60">
        <img
          src={product.image}
          alt={product.name}
          width={800}
          height={800}
          loading="lazy"
          decoding="async"
          className="block h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]"
        />
      </div>
      <div className="mt-3 flex min-w-0 flex-1 items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="break-words text-sm font-medium text-foreground">{product.name}</div>
          <div className="text-sm text-muted-foreground">R {product.price.toFixed(2)}</div>
        </div>
        <Button onClick={() => onAdd(product)} variant="hero" className="shrink-0">
          Add to cart
        </Button>
      </div>
    </div>
  );
};

export default ProductCard;
