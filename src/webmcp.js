import { useEffect, useRef } from "react";
export function createCafeTools(get) {
  const empty = { type: "object", properties: {}, additionalProperties: false };
  return [
    {
      name: "cafe_menu",
      description:
        "Read the currently available café menu and server-provided prices in minor currency units.",
      inputSchema: empty,
      execute: async () => {
        const { state } = get();
        return {
          items:
            state?.menu
              .filter((m) => m.available)
              .map(({ id, name, price, category }) => ({
                id,
                name,
                price,
                category,
              })) || [],
        };
      },
    },
    {
      name: "cafe_available_tables",
      description:
        "Read available café tables. Availability is not a reservation.",
      inputSchema: empty,
      execute: async () => ({
        tables:
          get()
            .state?.tables.filter((t) => t.status === "available")
            .map(({ id, seats, zone, outlet }) => ({
              id,
              seats,
              zone,
              outlet,
            })) || [],
      }),
    },
    {
      name: "cafe_review_product",
      description:
        "Open a menu item for the user to review and customize. Does not add to cart, order or pay.",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "An exact menu item ID from cafe_menu.",
          },
        },
        required: ["id"],
        additionalProperties: false,
      },
      execute: async ({ id }) => {
        const { state, setProduct } = get();
        const product = state?.menu.find((m) => m.id === id && m.available);
        if (!product) throw new Error("Menu item unavailable.");
        setProduct(product);
        return { opened: id, requiresUserConfirmation: true };
      },
    },
  ];
}
export function useCafeWebMCP(state, setProduct, enabled = true) {
  const current = useRef({ state, setProduct });
  current.current = { state, setProduct };
  useEffect(() => {
    if (!enabled) return;
    const context = document.modelContext || navigator.modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    const names = [];
    for (const tool of createCafeTools(() => current.current)) {
      try {
        const result = context.registerTool(tool, {
          signal: controller.signal,
        });
        names.push(tool.name);
        Promise.resolve(result).catch(() => {});
      } catch {}
    }
    return () => {
      controller.abort();
      if (context.unregisterTool)
        for (const name of names)
          try {
            context.unregisterTool(name);
          } catch {}
    };
  }, [enabled]);
}
