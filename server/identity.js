import { insist } from "./domain.js";
export function linkGuestToAccount(state, guest, targetId) {
  if (!guest || guest.id === targetId || guest.firebaseUid) return;
  const active = (id) =>
    state.visits.some(
      (v) => v.guestId === id && ["held", "seated"].includes(v.status),
    );
  insist(
    !(active(guest.id) && active(targetId)),
    "Both visits have an active table. Ask staff to close one before signing in.",
    409,
  );
  for (const collection of [
    "visits",
    "orders",
    "bills",
    "requests",
    "waitlist",
  ])
    for (const record of state[collection])
      if (record.guestId === guest.id) record.guestId = targetId;
}
