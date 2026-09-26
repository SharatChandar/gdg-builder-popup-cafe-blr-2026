import { seed } from "./domain.js";
// Fictional café/catalog approved by the owner. Operations always start empty.
export function emptyCafe() {
  const state = seed();
  state.tables = state.tables.map((table) => ({
    ...table,
    status: "available",
    visitId: null,
  }));
  state.staffUsers = [];
  state.settings = {
    name: "Common Ground",
    location: "Indiranagar, Bengaluru",
    acceptOrders: true,
    staffCount: 2,
    taxRate: 5,
    setupComplete: true,
  };
  return state;
}
