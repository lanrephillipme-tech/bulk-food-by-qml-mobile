export const palette = {
  green: "#138A36",
  charcoal: "#17211B",
  gold: "#F4B000",
  offWhite: "#F7F5EF",
  coral: "#E94F37",
  mint: "#DFF5E7",
  border: "#E5E0D7",
  muted: "#65756C",
  white: "#FFFFFF"
};

export const user = {
  name: "Ada",
  country: "Nigeria",
  city: "Lagos",
  walletBalance: 42500,
  qmlScore: 720,
  creditLimit: 180000,
  referralCode: "QML-ADA-4821"
};

export const activePlan = {
  title: "Monthly Family Food Pack",
  total: 150000,
  paid: 82000,
  nextDueDate: "22 Aug",
  interval: "Weekly",
  status: "Eligible for delivery"
};

export const packages = [
  {
    id: "pkg_family",
    title: "Monthly Family Food Pack",
    subtitle: "Rice, oil, beans, tomato, chicken cuts",
    price: 150000,
    tag: "Pay 50%, get delivery",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e"
  },
  {
    id: "pkg_rice_group",
    title: "1 Bag Rice Group Buy",
    subtitle: "4 slots, split equally near you",
    price: 80000,
    tag: "2 slots left",
    image: "https://images.unsplash.com/photo-1586201375761-83865001e31c"
  },
  {
    id: "pkg_festive",
    title: "Festive Bulk Pack",
    subtitle: "Food items for families and teams",
    price: 300000,
    tag: "3 month plan",
    image: "https://images.unsplash.com/photo-1543353071-10c8ba85a904"
  }
];

export const roles = [
  { key: "customer", label: "Customer", status: "Active", text: "Buy food, save small-small, join group buys." },
  { key: "vendor", label: "Vendor", status: "Apply", text: "List products, create packages, manage stock." },
  { key: "financier", label: "Financier", status: "Active", text: "Fund verified food plans and earn returns." },
  { key: "logistics", label: "Logistics", status: "Apply", text: "Register bike, car, van, truck, or trailer." }
];

export const categories = ["Grains", "Protein", "Oil", "Tubers", "Fresh Produce", "Festive", "Staff Packs"];
