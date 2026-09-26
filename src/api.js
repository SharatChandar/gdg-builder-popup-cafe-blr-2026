export async function api(path, body) {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Please try again.");
  return data;
}
export const images = {
  toast:
    "https://images.unsplash.com/photo-1752095809157-9dd2e2dfae8b?auto=format&fit=crop&w=800&q=85",
  coffee:
    "https://images.unsplash.com/photo-1537286164997-b6a9bbac8b55?auto=format&fit=crop&w=800&q=85",
  iced: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=800&q=85",
  pastry:
    "https://images.unsplash.com/photo-1759566926618-163d14e00fc8?auto=format&fit=crop&w=800&q=85",
};
