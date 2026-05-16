/**
 * @file Top-level routing component. The provider tree lives in
 * {@link main.jsx}; this file just wires URLs to route components.
 */

import { Navigate, Route, Routes } from "react-router-dom";

import Header from "./components/Header.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Cart from "./routes/Cart.jsx";
import Catalog from "./routes/Catalog.jsx";
import Checkout from "./routes/Checkout.jsx";
import Login from "./routes/Login.jsx";
import OrderSuccess from "./routes/OrderSuccess.jsx";
import ProductDetail from "./routes/ProductDetail.jsx";

export default function App() {
  return (
    <div className="min-h-screen bg-surface text-fg">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Catalog />
              </ProtectedRoute>
            }
          />
          <Route
            path="/product/:id"
            element={
              <ProtectedRoute>
                <ProductDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cart"
            element={
              <ProtectedRoute>
                <Cart />
              </ProtectedRoute>
            }
          />
          <Route
            path="/checkout"
            element={
              <ProtectedRoute>
                <Checkout />
              </ProtectedRoute>
            }
          />
          <Route
            path="/checkout/success"
            element={
              <ProtectedRoute>
                <OrderSuccess />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
