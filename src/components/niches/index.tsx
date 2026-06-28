import type { Client, Niche } from "@/data/sample";
import RealEstateDashboard from "./RealEstateDashboard";
import RestaurantDashboard from "./RestaurantDashboard";
import DentalDashboard from "./DentalDashboard";
import FitnessDashboard from "./FitnessDashboard";
import LoungeDashboard from "./LoungeDashboard";
import BeautyDashboard from "./BeautyDashboard";
import AutoDashboard from "./AutoDashboard";
import HotelDashboard from "./HotelDashboard";
import LocalStoreDashboard from "./LocalStoreDashboard";
import GenericDashboard from "./GenericDashboard";

const registry: Partial<Record<Niche, React.FC<{ client: Client }>>> = {
  real_estate: RealEstateDashboard,
  restaurant: RestaurantDashboard,
  dental_clinic: DentalDashboard,
  fitness_gym: FitnessDashboard,
  lounge: LoungeDashboard,
  beauty: BeautyDashboard,
  auto: AutoDashboard,
  hotel: HotelDashboard,
  local_store: LocalStoreDashboard,
};

export function NicheDashboard({ client }: { client: Client }) {
  const Dashboard = registry[client.niche] ?? GenericDashboard;
  return <Dashboard client={client} />;
}

export const hasBespokeDashboard = (niche: Niche) => niche in registry;
