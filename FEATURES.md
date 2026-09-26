# Common Ground Café Companion — feature guide

This guide documents the features currently implemented in `cafe-companion`. It covers the guest app at `/`, the staff space at `/staff`, and payment invitations at `/pay/:token`. The sample café is Common Ground in Bengaluru, with an INR menu and ten seeded tables. Configuration and deployment instructions are in [README.md](README.md).

## At a glance

| Area | What it does | Who uses it |
| --- | --- | --- |
| Visit home | Shows seating availability, the current visit, an active order, popular items, Wi-Fi and service shortcuts | Guest |
| Menu and cart | Finds, customizes and orders available food and drinks | Guest |
| Seating | Finds a suitable table, requests a five-minute hold and joins the waitlist | Guest and staff |
| Orders and bills | Tracks preparation, pays a bill, splits it and reorders served items | Guest |
| Profile and phone login | Saves local preferences and optionally links orders to a verified phone account | Guest |
| Staff space | Manages the kitchen, tables, guest requests, menu availability and waitlist | Staff |
| Optional integrations | Gemini suggestions, Firebase phone sign-in, Stripe Checkout, Twilio SMS and browser WebMCP | Configured deployments |

## Guest features

### Visit home and navigation

- The home view greets a guest by their saved name and shows the number of available tables, a current table or pending request, a queue-based preparation estimate and the latest active order.
- Shortcuts open seating, guest Wi-Fi, the help panel and the menu. Featured items open their product details.
- Desktop navigation includes Visit, Menu, Seats, Orders and Profile. The mobile bottom bar contains the first four; Profile is available from the header avatar.
- The app refreshes guest state every five seconds. If the connection fails, it shows an offline or paused-updates banner and the last successful sync time. Ordering and payment still require a server connection.

### Browse and customize the menu

1. Open **Explore menu**. Search by product name or description, choose a category, or turn on the **Plant based** filter. The sample categories are Coffee, Bakery, Kitchen and Tea & more.
2. Open an item to see its description, image, declared allergens, calorie estimate, serving size and availability. Sold-out items remain visible but cannot be added.
3. For coffee and matcha, choose Standard, Whole, Oat or no milk. Oat adds the configured sample charge of ₹40. Set a quantity from 1 to 20, then add the item to the cart.

The app warns that customizations may change allergens and asks guests to speak to staff about allergies and cross-contact. Staff can change availability, but this interface does not edit product names, descriptions, prices or allergens.

### Calories

Every fictional menu item shows estimated kcal per original-recipe serving. Details include serving size and a reminder that customizations change calories. These are illustrative values, not measured nutrition. Existing nutrition entries are preserved when the server backfills missing values.

### 3D and AR previews

Every sample menu item has an **Explore in 3D / AR** option. Guests can orbit, zoom and reset its illustrative Three.js model, or return to the photo. On a compatible WebXR AR device over HTTPS, **View in your space (AR)** starts surface detection. Move the device until the placement ring appears, then tap to place or reposition the item. The camera is used only for the AR session. If WebXR AR is unavailable, the 3D preview remains usable. The 3D code loads when opened. Models are stylized visual previews, not exact reconstructions or portion measurements.

### Gemini order suggestions

Under **A little help choosing?**, a guest can type a request, attach a JPEG/PNG/WebP food photo, or record up to 20 seconds of audio. An attachment is limited to 4 MB. Pressing **Ask Gemini** sends the request and attachment to the server, then to Gemini when `GEMINI_API_KEY` is configured. The guest reviews the proposed menu items and quantities before adding them to the cart and still places the order manually.

The server checks suggested item IDs against available menu items and validates quantities and milk choices. Suggestions cannot place an order, send an invitation or charge a payment. Only in local demo mode without Gemini configuration, **Try sample draft** displays a clearly labeled fixed example; it does not analyze the entered text, photo or audio. Media is sent only when **Ask Gemini** is pressed and is not stored by this app. Suggestions cannot verify allergens or identify people.

### Cart and ordering

- The cart groups the same item and milk choice, lets guests change quantities, and shows item prices, subtotal, sample 5% tax and total. The server recalculates prices and tax from its own menu when the order is placed.
- Choose **Takeaway** or **At my table**. Table delivery requires staff to have confirmed a seat. Enter a name and, optionally, a note for staff.
- **Place order** submits the cart and opens **Orders & bills**. A request ID makes retrying the same submission idempotent. The kitchen can pause new orders; browsing remains available during a pause.
- Each order gets its own bill. The order starts as **Received**, then staff advances it through **Preparing**, **Ready** and **Served**. The guest sees an estimated preparation range and the live status. Estimates use queued item preparation times and the configured staff count; they are heuristic.
- A served order offers **Order again**, which adds currently available items back to the cart. Any item now sold out is skipped.

### Seating and waitlist

1. Open **Find a seat** and choose a party size from one to six. Optional filters require a power outlet or quiet corner.
2. Inspect the floor plan and table details, including capacity, zone, accessibility and status. The suggested table is the smallest currently available table that meets the selected needs.
3. Press **Request** on an available table. The server atomically holds it for five minutes; staff must confirm seating. A guest can cancel a pending request. Expired holds return to availability.
4. If no table suits the group, enter a name and join the waitlist. Staff can assign an available table with enough seats; assignment creates a table request that still needs seating confirmation.

The floor plan shows available, held, occupied and cleaning tables. Availability can change before a request succeeds. A table QR code opens `/?table=Txx` and directs the guest to the seating view; scanning does not reserve or confirm the table. A guest with an active table asks staff to move them.

### Guest Wi-Fi and service requests

- Wi-Fi network details appear only after staff confirms seating. The guest can copy a configured password; the app does not join the network automatically.
- A seated guest can request **Water**, **Help with my order** or **Please bring the bill**. The panel shows whether staff has received or acknowledged the request. Repeating the same unfinished request does not create a duplicate.

### Bills, splits and payment links

- Every order starts with one unpaid share. The guest can open **Pay bill**, or choose **Split with friends** for an equal split or custom amounts. One bill supports one to twelve named people. Custom amounts must add up exactly to the bill total; equal splits distribute any remaining minor currency units exactly. Tax is already included.
- Each participant can have an optional phone number in international `+` format. A saved split shows the recipients and private payment links. Sending SMS requires an explicit review checkbox and button press; a phone number alone never authorizes a charge. Links can also be opened or copied for manual sharing.
- Each signed link is scoped to one share and expires after 24 hours. The payer sees their name, amount and status. In demo mode, **Simulate payment** settles the share without charging money. In live mode, a configured Stripe Checkout session takes the payment; only a verified Stripe webhook settles it.
- The order displays unpaid, partially paid or paid status. Staff see outstanding balances. A split locks once a share has been paid or a payment or invitation has started, protecting existing shares. Phone numbers are masked on shared screens.
- A paid bill does not release a table. The guest may leave only when all bills for that visit are paid and all its orders are served. A confirmed table then enters cleaning until staff marks it available. Canceling an unconfirmed hold releases it immediately.

## Profile and identity

- A guest can save a name and favorite menu items. These preferences live in that browser's local storage; clearing browser data removes them, and phone login does not sync them.
- Guest orders, visits, bills, requests and waitlist entries are scoped to an anonymous guest session by default.
- With Firebase Phone Authentication configured, the Profile screen can send a one-time code after the guest enters an international phone number and agrees to the disclosure. Firebase uses reCAPTCHA. The server verifies the Firebase token, phone sign-in provider, revocation status and recent authentication before issuing a one-hour account session.
- Signing in links only the current anonymous guest's records to the verified account, making account orders accessible across devices. Switching verified accounts does not merge their records. If both identities have active tables, linking stops until staff resolves one. A guest can sign out; an expired account session requires signing in again.
- Without Firebase configuration, guests can continue to order anonymously and the login action is disabled.

## Staff features

Staff open `/staff` and enter their own username and password. Only local demo mode displays the default PIN `2468` unless overridden. The staff session lasts eight hours and can be signed out. The dashboard refreshes every four seconds.

| Staff tab or control | Available actions |
| --- | --- |
| Overview | View counts of active orders, available tables, unfinished guest requests and waiting parties. Pause or resume acceptance of new orders. |
| Orders | See order codes, service table or takeaway, customer name, lines, notes and outstanding amount. Advance an order from accepted to preparing, ready and served, in that order. |
| Tables | Confirm held requests. Mark an occupied table as vacated, then mark a cleaning table available. Move a seated party to an available table with enough seats; undelivered orders and unfinished requests follow the new table. Generate and download a QR code for each table. |
| Requests | Acknowledge a new guest request and mark it done. |
| Menu | Mark any item sold out or make it available again. |
| Waitlist | See waiting groups and assign a suitable available table. The guest's resulting hold still requires confirmation. |

Staff cannot clear an occupied visit while it has an unpaid bill or undelivered order. The dashboard enforces owner, barista, and floor roles.

## Optional browser and platform features

- **Coffee run Easter egg:** Tap the small coffee cup in the guest page footer to open a coffee-themed endless runner. Press Space or ↑, or tap the game, to jump over donuts and coffee spills. The game tracks a score and saves the best score in this browser's local storage. It is self-contained and does not affect orders or payments.
- **WebMCP:** In browsers that support `document.modelContext` (or the earlier `navigator.modelContext`), the guest page registers `cafe_menu`, `cafe_available_tables` and `cafe_review_product`. They read public menu/table data or open a product for user review. They do not add to cart, reserve tables, submit orders or pay. Normal browser use does not require WebMCP.
- **Installable web app:** The app has a standalone PWA manifest and a production service worker. On navigation failure, the worker serves a simple offline page. It does not cache ordering or payment actions for later submission.
- **Responsive layout:** The guest interface provides desktop side navigation and a mobile bottom bar. The staff space and payment pages work as separate routes.

## Configuration and operational scope

| Capability | Default local behavior | Additional configuration for live use |
| --- | --- | --- |
| Data | Embedded PostgreSQL via PGlite, with seeded sample data | Cloud SQL PostgreSQL via `DATA_STORE=postgres` and database settings |
| Payments | Simulated settlement in `DEMO_MODE=true` | `DEMO_MODE=false`, HTTPS `PUBLIC_URL`, session/staff secrets, Stripe secret and webhook secret |
| SMS invitations | Preview only; no message is sent | Twilio account SID, auth token and sender number |
| AI suggestions | Labeled sample draft | Server-side Gemini API key |
| Phone login | Guest access without login | Firebase Phone Authentication, web config and Admin credentials |
| Wi-Fi | Sample network details after seating | `WIFI_SSID` and `WIFI_PASSWORD` |

The current pilot models **one order per bill**. It does not implement combined table bills, per-item split allocation, refunds, reassignment of sent shares, expired-link renewal, POS synchronization or SMS delivery callbacks. An expired link does not cancel the balance due. The monetary model assumes two decimal places. See [README.md](README.md) for environment variables, deployment steps and provider details.

Live deployment uses individual owner, barista, and floor accounts, with server-side permissions. No operational fixtures are seeded. Staff can record a counter receipt only after confirming money was received; this is audited with their username. SMS invitations and online checkout are disabled until their providers are configured.
