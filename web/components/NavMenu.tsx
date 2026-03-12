import { Link } from "react-router";
import { NavMenu as AppBridgeNavMenu } from "@shopify/app-bridge-react";

export function NavMenu() {
  return (
    <AppBridgeNavMenu>
      <Link to="/" rel="home">
        Dashboard
      </Link>
      <Link to="/products">Products</Link>
      <Link to="/simulator">A2A Simulator</Link>
      <Link to="/citations">Citations</Link>
      <Link to="/pricing">Pricing</Link>
    </AppBridgeNavMenu>
  );
}
