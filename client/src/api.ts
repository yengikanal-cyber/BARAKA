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

export type Contact = {
  connection_id: number;
  other_id: number;
  name: string;
  nickname: string;
  role: 'manufacturer' | 'accountant' | 'staff' | 'buyer' | 'partner';
  avatar_url: string | null;
  phone: string | null;
  staff_id: number | null;
  debt: number;
};

export type SearchResult = {
  id: number;
  name: string;
  nickname: string;
  role: string;
  avatar_url: string | null;
  phone: string | null;
  connected: boolean;
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

export type Story = {
  id: number;
  manufacturer_id: number;
  type: 'news' | 'discount' | 'product';
  title: string;
  description: string | null;
  discount_percent: number | null;
  photo_url: string | null;
  created_at: string;
};

export type StoryGroup = {
  manufacturer: { id: number; name: string; nickname: string; avatar_url: string | null } | null;
  stories: Story[];
};

export type RewardLeader = {
  user: { id: number; name: string; nickname: string; avatar_url: string | null } | null;
  total: number;
  rank: number;
};

export type Reward = {
  id: number;
  manufacturer: { id: number; name: string; nickname: string; avatar_url: string | null } | null;
  title: string;
  photo_url: string | null;
  description: string | null;
  period_type: 'month' | 'quarter' | 'custom';
  start_date: string | null;
  end_date: string | null;
  criteria: 'volume' | 'paid';
  top_n: number;
  created_at: string;
  leaders: RewardLeader[];
  // buyer-side extras
  myRank?: number | null;
  myTotal?: number;
  qualifying?: boolean;
};

export type Notification = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, any> | null;
  is_read: boolean;
  created_at: string;
};

export type Partner = {
  id: number;
  name: string;
  nickname: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
};

export type TeamMember = {
  id: number;
  name: string;
  nickname: string;
  email: string;
  phone: string | null;
  role: 'staff' | 'accountant';
  avatar_url: string | null;
  assignedCount: number;
};

export type AssignClient = {
  connection_id: number;
  buyer_id: number;
  name: string;
  nickname: string;
  avatar_url: string | null;
  assigned: boolean;
};

export type StatsReport = {
  cards: { turnover: number; paid: number; debt: number; returns: number };
  counts: { delivery: number; order: number; return: number };
  monthly: { month: string; total: number }[];
  topPartners: { user: { id: number; name: string; nickname: string; avatar_url: string | null } | null; total: number }[];
  topProducts: { name: string; qty: number; total: number }[];
  sellerSide: boolean;
};

export type TxType = 'delivery' | 'order' | 'return';
export type TxStatus = 'pending' | 'accepted' | 'delivered' | 'paid' | 'rejected';

export type TxItem = {
  id: number;
  product_id: number | null;
  name: string;
  unit: string;
  price: number;
  quantity: number;
  reason: string | null;
};

export type Transaction = {
  id: number;
  manufacturer_id: number;
  buyer_id: number;
  type: TxType;
  status: TxStatus;
  total: number;
  note: string | null;
  reason: string | null;
  created_by: number;
  created_at: string;
  delivered_at: string | null;
  paid_at: string | null;
  accepted_at: string | null;
  items: TxItem[];
};

export type ChatMessage = {
  id: number;
  sender_id: number;
  body: string;
  created_at: string;
};

export type TimelineItem =
  | { kind: 'message'; at: string; message: ChatMessage }
  | { kind: 'transaction'; at: string; transaction: Transaction };

export type ChatData = {
  other: { id: number; name: string; nickname: string; role: string; avatar_url: string | null; phone: string | null } | null;
  connection_id: number;
  iAmSeller: boolean;
  debt: number;
  timeline: TimelineItem[];
};

export type NewTxItem = {
  product_id?: number | null;
  name: string;
  unit: string;
  price: number;
  quantity: number;
  reason?: string | null;
};

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

  // Connections / Contacts
  listContacts: () => request<{ contacts: Contact[] }>('/connections'),
  searchUsers: (q: string) =>
    request<{ results: SearchResult[] }>(`/connections/search?q=${encodeURIComponent(q)}`),
  addConnection: (userId: number) =>
    request<{ connection_id: number }>('/connections', { method: 'POST', body: JSON.stringify({ userId }) }),
  deleteConnection: (id: number) =>
    request<{ ok: true }>(`/connections/${id}`, { method: 'DELETE' }),

  // Stories
  listStories: () => request<{ groups: StoryGroup[]; canCreate: boolean }>('/stories'),
  createStory: (body: { type: 'news' | 'discount' | 'product'; title: string; description?: string | null; discount_percent?: number | null; photo_url?: string | null }) =>
    request<{ story: Story }>('/stories', { method: 'POST', body: JSON.stringify(body) }),
  deleteStory: (id: number) => request<{ ok: true }>(`/stories/${id}`, { method: 'DELETE' }),

  // Rewards
  listRewards: () => request<{ rewards: Reward[]; canManage: boolean }>('/rewards'),
  createReward: (body: {
    title: string;
    photo_url?: string | null;
    description?: string | null;
    period_type?: 'month' | 'quarter' | 'custom';
    start_date?: string | null;
    end_date?: string | null;
    criteria?: 'volume' | 'paid';
    top_n?: number;
  }) => request<{ reward: Reward }>('/rewards', { method: 'POST', body: JSON.stringify(body) }),
  updateReward: (id: number, body: Partial<{
    title: string;
    photo_url: string | null;
    description: string | null;
    period_type: 'month' | 'quarter' | 'custom';
    start_date: string | null;
    end_date: string | null;
    criteria: 'volume' | 'paid';
    top_n: number;
  }>) => request<{ reward: Reward }>(`/rewards/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteReward: (id: number) => request<{ ok: true }>(`/rewards/${id}`, { method: 'DELETE' }),

  // Notifications
  listNotifications: () => request<{ notifications: Notification[]; unread: number }>('/notifications'),
  unreadCount: () => request<{ unread: number }>('/notifications/unread-count'),
  markAllRead: () => request<{ ok: true }>('/notifications/read-all', { method: 'POST' }),
  markRead: (id: number) => request<{ ok: true }>(`/notifications/${id}/read`, { method: 'POST' }),

  // Stats
  statsSummary: () => request<{ debt: number; turnover: number; paid: number; contacts: number }>('/stats/summary'),
  statsReport: () => request<StatsReport>('/stats/report'),

  // Chat + transactions
  getChat: (otherId: number) => request<ChatData>(`/chat/${otherId}`),
  sendMessage: (otherId: number, body: string) =>
    request<{ message: ChatMessage }>(`/chat/${otherId}/message`, { method: 'POST', body: JSON.stringify({ body }) }),
  createTransaction: (body: { otherId: number; type: TxType; items: NewTxItem[]; note?: string | null }) =>
    request<{ transaction: Transaction; debt: number }>('/transactions', { method: 'POST', body: JSON.stringify(body) }),
  txAction: (id: number, action: 'accept' | 'deliver' | 'pay' | 'reject') =>
    request<{ transaction: Transaction; debt: number }>(`/transactions/${id}/action`, { method: 'POST', body: JSON.stringify({ action }) }),

  // Team
  listTeam: () => request<{ members: TeamMember[] }>('/team'),
  addTeamMember: (body: { name: string; email: string; password: string; role: 'staff' | 'accountant'; phone?: string | null }) =>
    request<{ member: TeamMember }>('/team', { method: 'POST', body: JSON.stringify(body) }),
  removeTeamMember: (id: number) =>
    request<{ ok: true }>(`/team/${id}`, { method: 'DELETE' }),
  teamClients: (staffId: number) =>
    request<{ clients: AssignClient[] }>(`/team/${staffId}/clients`),
  assignClient: (staffId: number, connectionId: number, assigned: boolean) =>
    request<{ ok: true }>('/team/assign', { method: 'POST', body: JSON.stringify({ staffId, connectionId, assigned }) }),

  // Partners (buyer-side)
  listPartners: () => request<{ partners: Partner[]; owner: { id: number; name: string; nickname: string; avatar_url: string | null } | null; canManage: boolean }>('/partners'),
  addPartner: (body: { name: string; email: string; password: string; phone?: string | null }) =>
    request<{ partner: Partner }>('/partners', { method: 'POST', body: JSON.stringify(body) }),
  removePartner: (id: number) =>
    request<{ ok: true }>(`/partners/${id}`, { method: 'DELETE' }),
};
