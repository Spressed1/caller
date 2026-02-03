
export interface BusinessLead {
  id: string;
  name: string;
  phone: string;
  address: string;
  website?: string;
  rating?: number;
  userRatingsTotal?: number;
  category?: string;
  status: 'pending' | 'calling' | 'completed' | 'failed';
  notes?: string;
}

export interface SearchResult {
  leads: BusinessLead[];
  groundingSources: Array<{
    title: string;
    uri: string;
  }>;
}
