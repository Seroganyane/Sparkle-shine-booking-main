import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { ShoppingCart, Trash2 } from "lucide-react-native";
import { useCart } from "../context/CartContext";
import { products } from "../lib/products";

const ShopScreen = () => {
  const { items, addItem, removeItem, clear, total } = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const handleAddToCart = (product: typeof products[0]) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
    });
    Alert.alert("Added to Cart", `${product.name} added successfully`);
  };

  const handleCheckout = () => {
    if (items.length === 0) {
      Alert.alert("Empty Cart", "Please add items before checking out");
      return;
    }
    Alert.alert(
      "Purchase Successful",
      `Order placed for R${total.toFixed(2)}. Thank you!`,
      [{ text: "OK", onPress: clear }]
    );
  };

  return (
    <View style={styles.container}>
      {/* Products Section */}
      <ScrollView style={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Shop</Text>
          <Text style={styles.subtitle}>Premium car care products</Text>
        </View>

        <View style={styles.productsGrid}>
          {products.map((product) => (
            <View key={product.id} style={styles.productCard}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productDesc}>{product.description}</Text>
              <Text style={styles.productPrice}>
                R {product.price.toFixed(2)}
              </Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => handleAddToCart(product)}
              >
                <ShoppingCart size={18} color="#ffffff" />
                <Text style={styles.addButtonText}>Add to cart</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Cart Section */}
      <View style={styles.cartSection}>
        <View style={styles.cartHeader}>
          <View>
            <Text style={styles.cartTitle}>Cart</Text>
            <Text style={styles.cartItems}>
              {items.length} item{items.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <Text style={styles.cartTotal}>R {total.toFixed(2)}</Text>
        </View>

        {items.length > 0 ? (
          <>
            <ScrollView style={styles.cartItems}>
              {items.map((item) => (
                <View key={item.id} style={styles.cartItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartItemName}>{item.name}</Text>
                    <Text style={styles.cartItemQty}>Qty: {item.quantity}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeItem(item.id)}>
                    <Trash2 size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <View style={styles.cartActions}>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={clear}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.checkoutButton}
                onPress={handleCheckout}
              >
                <Text style={styles.checkoutButtonText}>Checkout</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <Text style={styles.emptyCartText}>Your cart is empty</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scrollContent: {
    flex: 1,
    paddingBottom: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
  },
  productsGrid: {
    paddingHorizontal: 20,
    gap: 12,
  },
  productCard: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  productDesc: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0ea5e9",
    marginTop: 8,
  },
  addButton: {
    backgroundColor: "#0ea5e9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
    gap: 6,
  },
  addButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
  cartSection: {
    backgroundColor: "#1e293b",
    borderTopWidth: 1,
    borderTopColor: "#334155",
    paddingHorizontal: 20,
    paddingVertical: 12,
    maxHeight: 200,
  },
  cartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  cartTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
  },
  cartItems: {
    fontSize: 13,
    color: "#64748b",
  },
  cartTotal: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0ea5e9",
  },
  cartItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  cartItemQty: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  emptyCartText: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 14,
    paddingVertical: 12,
  },
  cartActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#64748b",
    alignItems: "center",
  },
  clearButtonText: {
    color: "#64748b",
    fontWeight: "600",
  },
  checkoutButton: {
    flex: 2,
    paddingVertical: 8,
    backgroundColor: "#0ea5e9",
    borderRadius: 6,
    alignItems: "center",
  },
  checkoutButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
});

export default ShopScreen;
