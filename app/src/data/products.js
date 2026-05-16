/**
 * @file In-memory product catalogue. Acts as the demo's "backend".
 *
 * The list is intentionally varied — multiple categories, a wide price range,
 * one out-of-stock item — so the validator scenarios can meaningfully exercise
 * search, filter, sort, and inventory edge cases.
 */

/**
 * @typedef {object} Product
 * @property {string} id
 * @property {string} name
 * @property {"Audio" | "Input" | "Display" | "Video" | "Accessories"} category
 * @property {number} price       USD, integer cents avoided for brevity.
 * @property {number} stock       0 means out of stock.
 * @property {number} rating      0–5, one decimal.
 * @property {string} summary
 * @property {string} emoji       Pseudo-thumbnail. Real apps would use an image.
 */

/** @type {Product[]} */
export const products = [
  {
    id: "headphones-aurora",
    name: "Aurora Wireless Headphones",
    category: "Audio",
    price: 199,
    stock: 12,
    rating: 4.6,
    summary: "Active noise cancellation, 30-hour battery, plush memory-foam pads.",
    emoji: "🎧",
  },
  {
    id: "keyboard-polaris",
    name: "Polaris Mechanical Keyboard",
    category: "Input",
    price: 149,
    stock: 6,
    rating: 4.8,
    summary: "Hot-swappable switches, per-key RGB, aluminium top plate.",
    emoji: "⌨️",
  },
  {
    id: "monitor-helios",
    name: 'Helios 32" 4K Monitor',
    category: "Display",
    price: 549,
    stock: 3,
    rating: 4.5,
    summary: "120 Hz refresh, factory-calibrated colour, USB-C 90W power delivery.",
    emoji: "🖥️",
  },
  {
    id: "mouse-vega",
    name: "Vega Wireless Mouse",
    category: "Input",
    price: 79,
    stock: 24,
    rating: 4.4,
    summary: "Ergonomic shape, 70-hour battery, six programmable buttons.",
    emoji: "🖱️",
  },
  {
    id: "webcam-orion",
    name: "Orion 4K Webcam",
    category: "Video",
    price: 129,
    stock: 0,
    rating: 4.2,
    summary: "Auto-framing, dual-mic array, removable privacy shutter.",
    emoji: "📷",
  },
  {
    id: "headphones-luna",
    name: "Luna Studio Headphones",
    category: "Audio",
    price: 299,
    stock: 5,
    rating: 4.7,
    summary: "Open-back, planar-magnetic drivers, detachable cable.",
    emoji: "🎵",
  },
  {
    id: "stand-atlas",
    name: "Atlas Monitor Arm",
    category: "Accessories",
    price: 89,
    stock: 18,
    rating: 4.5,
    summary: "Single-arm, gas-spring counterbalance, supports up to 32 inches.",
    emoji: "🦾",
  },
  {
    id: "speakers-nova",
    name: "Nova Desktop Speakers",
    category: "Audio",
    price: 249,
    stock: 7,
    rating: 4.6,
    summary: "Bluetooth + USB-C input, dedicated sub-out, woven-fabric grille.",
    emoji: "🔊",
  },
];

/** All distinct categories present in {@link products}. @type {string[]} */
export const categories = [...new Set(products.map((p) => p.category))].sort();

/**
 * Fetch a product by id. Pure — does not throw.
 *
 * @param {string} id
 * @returns {Product | undefined}
 */
export function getProduct(id) {
  return products.find((p) => p.id === id);
}
