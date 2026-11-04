"use client";

import PageHeader from "@/components/page-header/PageHeader";
import MenuRow from "@/components/menu-row/MenuRow";
import BottomNav from "@/components/bottom-nav/BottomNav";
const MENU_ITEMS = [
  { label: "Account Details", href: "/profile/account-details" },
  { label: "Setup Meter", href: "/profile/setup-meter" },
];

export default function ProfilePage() {
  const handleLogout = () => {
    window.location.href = "/logout";
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PageHeader title="Profile" />

      <main className="flex-1 px-5 pt-2">
        <div className="flex flex-col">
          {MENU_ITEMS.map((item) => (
            <MenuRow key={item.href} label={item.label} href={item.href} />
          ))}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-8 w-full rounded-full border  bg-orange-500 py-3.5 text-sm font-semibold text-white transition hover:bg-orange-50"
        >
          Logout
        </button>
      </main>

      <BottomNav />
    </div>
  );
}
