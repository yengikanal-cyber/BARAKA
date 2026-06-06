export type AppearanceSettings = {
  theme: 'light' | 'dark' | 'system';
  accent: 'green' | 'blue' | 'indigo' | 'purple' | 'pink' | 'orange' | 'teal' | 'graphite';
  glass: 'off' | 'soft' | 'medium' | 'strong';
  background: 'plain' | 'gradient' | 'pattern';
  density: 'comfortable' | 'compact';
  font: 'system' | 'inter' | 'outfit' | 'manrope';
  radius: 'square' | 'soft' | 'round';
};

export const UNITS = [
  'dona', 'kg', 'litr', 'metr', 'tonna', 'karobka',
  'pachka', 'qop', 'boglam', 'sht', 'juft',
] as const;
export type Unit = (typeof UNITS)[number];

export type Product = {
  id: number;
  manufacturer_id: number;
  name: string;
  price: number;
  unit: Unit;
  category: string | null;
  photo_url: string | null;
  in_stock: boolean;
  created_at: string;
};

export type User = {
  id: number;
  email: string;
  name: string;
  nickname: string;
  phone: string | null;
  role: 'manufacturer' | 'accountant' | 'staff' | 'buyer' | 'partner';
  parent_id: number | null;
  avatar_url: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  language: 'uz' | 'ru' | 'en';
  created_at: string;
} & AppearanceSettings;

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    let payload: any = null;
    try { payload = await res.json(); } catch {}
    const err = new Error(payload?.error || `http_${res.status}`);
    (err as any).status = res.status;
    (err as any).payload = payload;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function upload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!res.ok) {
    let payload: any = null;
    try { payload = await res.json(); } catch {}
    throw new Error(payload?.error || `http_${res.status}`);
  }
  return res.json();
}

export const api = {
  me: () => request<{ user: User }>('/auth/me'),
  register: (body: {
    email: string;
    password: string;
    name: string;
    nickname: string;
    phone?: string | null;
    role: User['role'];
    ownerNickname?: string | null;
  }) => request<{ user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (email: string, password: string) =>
    request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),

  updateProfile: (body: Partial<Pick<User, 'name' | 'phone' | 'address' | 'lat' | 'lng' | 'language'>>) =>
    request<{ user: User }>('/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  updateAppearance: (body: Partial<AppearanceSettings>) =>
    request<{ user: User }>('/profile/appearance', { method: 'PATCH', body: JSON.stringify(body) }),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return upload<{ user: User }>('/profile/avatar', form);
  },
  changePassword: (current: string, next: string) =>
    request<{ ok: true }>('/profile/password', { method: 'POST', body: JSON.stringify({ current, next }) }),

  // Products
  listProducts: (params: { category?: string; stock?: 'in' | 'out' } = {}) => {
    const q = new URLSearchParams();
    if (params.category) q.set('category', params.category);
    if (params.stock) q.set('stock', params.stock);
    const qs = q.toString();
    return request<{ products: Product[]; categories: string[] }>(`/products${qs ? '?' + qs : ''}`);
  },
  listProductsByManufacturer: (manufacturerId: number, all = false) =>
    request<{ manufacturer: { id: number; name: string; nickname: string; avatar_url: string | null }; products: Product[]; categories: string[] }>(
      `/products/by/${manufacturerId}${all ? '?all=1' : ''}`,
    ),
  createProduct: (body: { name: string; price: number; unit: Unit; category?: string | null; photo_url?: string | null; in_stock?: boolean }) =>
    request<{ product: Product }>('/products', { method: 'POST', body: JSON.stringify(body) }),
  updateProduct: (id: number, body: Partial<{ name: string; price: number; unit: Unit; category: string | null; photo_url: string | null; in_stock: boolean }>) =>
    request<{ product: Product }>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  toggleStock: (id: number) =>
    request<{ product: Product }>(`/products/${id}/toggle-stock`, { method: 'POST' }),
  deleteProduct: (id: number) =>
    request<{ ok: true }>(`/products/${id}`, { method: 'DELETE' }),

  // Generic image upload (products, stories, rewards)
  uploadImage: (file: File, kind: 'product' | 'story' | 'reward' = 'product') => {
    const form = new FormData();
    form.append('image', file);
    return upload<{ url: string }>(`/uploads/image?kind=${kind}`, form);
  },
};
