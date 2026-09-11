import NavbarGate from "./shared/components/Navbar/NavbarGate";
import LandingPage from "./features/landing/components/LandingPage";
import "./globals.css";

export default function App() {
  return (
    <>
      <NavbarGate />
      <LandingPage />
    </>
  );
}
