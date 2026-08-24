export interface TaxonomyItem {
  id: string;
  name: string;
  fields: string[];
  isDefault?: boolean;
}

export const CURRENT_TAXONOMY_VERSION = 2;

export const DEFAULT_TAXONOMY: TaxonomyItem[] = [
  {
    id: 'life_science',
    name: 'Life Science',
    fields: ['Biology', 'Medicine', 'Genetics', 'Neuroscience', 'Biotechnology', 'Pharmacology'],
    isDefault: true
  },
  {
    id: 'basic_science',
    name: 'Basic Science',
    fields: ['Physics', 'Chemistry', 'Mathematics', 'Astronomy', 'Logic'],
    isDefault: true
  },
  {
    id: 'earth_science',
    name: 'Earth Science',
    fields: ['Geology', 'Meteorology', 'Oceanography', 'Environmental Science', 'Ecology'],
    isDefault: true
  },
  {
    id: 'engineering',
    name: 'Engineering',
    fields: ['Computer Science', 'Software Engineering', 'Electrical Engineering', 'Mechanical Engineering', 'Civil Engineering', 'AI & Robotics'],
    isDefault: true
  },
  {
    id: 'finance_economics',
    name: 'Finance & Economics',
    fields: ['Macroeconomics', 'Microeconomics', 'Corporate Finance', 'Investment & Banking', 'Accounting', 'Trade & Commerce'],
    isDefault: true
  },
  {
    id: 'politics',
    name: 'Politics',
    fields: ['International Relations', 'Political Theory', 'Comparative Politics', 'Public Administration', 'Diplomacy'],
    isDefault: true
  },
  {
    id: 'psychology',
    name: 'Psychology',
    fields: ['Cognitive Psychology', 'Clinical Psychology', 'Developmental Psychology', 'Social Psychology', 'Behavioral Economics'],
    isDefault: true
  },
  {
    id: 'law',
    name: 'Law',
    fields: ['Constitutional Law', 'Criminal Law', 'Civil & Commercial Law', 'International Law', 'Intellectual Property (IP)'],
    isDefault: true
  },
  {
    id: 'liberal_arts',
    name: 'Liberal Arts',
    fields: ['History', 'Literature', 'Philosophy', 'Art & Aesthetics', 'Linguistics', 'Sociology & Culture'],
    isDefault: true
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    fields: ['Movies & Cinema', 'Music', 'Gaming', 'Sports', 'Pop Culture', 'Media & Journalism'],
    isDefault: true
  }
];

export const DOMAINS = DEFAULT_TAXONOMY.map(t => t.name);

export const DEFAULT_DOMAIN_FIELDS: Record<string, string[]> = DEFAULT_TAXONOMY.reduce((acc, item) => {
  acc[item.name] = item.fields;
  return acc;
}, {} as Record<string, string[]>);

// Mapping from V1 legacy categories/tags to V2 official categories (supports both '/' and '\')
export const TAXONOMY_MIGRATION_V1_TO_V2: Record<string, string> = {
  'Economics and Finance': 'Finance & Economics',
  'Technology and Engineering': 'Engineering',
  'Science/Biology': 'Life Science/Biology',
  'Science/Earth Science': 'Earth Science/Earth Science',
  'Science/Physics': 'Basic Science/Physics',
  'Science/Chemistry': 'Basic Science/Chemistry',
  'Science/Astronomy': 'Basic Science/Astronomy',
  'Science': 'Basic Science',
  'Sociology/Culture': 'Liberal Arts/Sociology & Culture',
  'Sociology/Social Stratification': 'Finance & Economics/Trade & Commerce',
  'Sociology/Demography': 'Liberal Arts/Sociology & Culture',
  'Sociology/Criminology': 'Law/Criminal Law',
  'Sociology': 'Liberal Arts',
  'Entertainment/Movies': 'Entertainment/Movies & Cinema',
  'Liberal Arts/Art': 'Liberal Arts/Art & Aesthetics',
  // Backwards compatibility legacy keys
  'Science\\Biology': 'Life Science/Biology',
  'Science\\Earth Science': 'Earth Science/Earth Science',
  'Science\\Physics': 'Basic Science/Physics',
  'Science\\Chemistry': 'Basic Science/Chemistry',
  'Science\\Astronomy': 'Basic Science/Astronomy',
  'Sociology\\Culture': 'Liberal Arts/Sociology & Culture',
  'Sociology\\Social Stratification': 'Finance & Economics/Trade & Commerce',
  'Sociology\\Demography': 'Liberal Arts/Sociology & Culture',
  'Sociology\\Criminology': 'Law/Criminal Law',
  'Entertainment\\Movies': 'Entertainment/Movies & Cinema',
  'Liberal Arts\\Art': 'Liberal Arts/Art & Aesthetics'
};

export const parseTaxonomyTag = (rawTag: string): { domain: string; field?: string } => {
  if (!rawTag) return { domain: '' };
  const normalized = rawTag.trim().replace(/\\/g, '/');
  if (normalized.includes('/')) {
    const [domain, ...rest] = normalized.split('/');
    return { domain: domain.trim(), field: rest.join('/').trim() };
  }
  return { domain: normalized };
};

export const formatTaxonomyTag = (domain: string, field?: string): string => {
  const d = domain.trim();
  const f = field ? field.trim() : '';
  return f ? `${d}/${f}` : d;
};

export const taxonomyToDomainFields = (taxonomy: TaxonomyItem[]): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  for (const item of taxonomy) {
    result[item.name] = [...item.fields];
  }
  return result;
};

export const getStoredTaxonomy = (): TaxonomyItem[] => {
  try {
    const storedVersion = parseInt(localStorage.getItem('glossaryTaxonomyVersion') || '1', 10);
    const stored = localStorage.getItem('glossaryTaxonomy');

    // If version upgrade needed or no stored taxonomy yet
    if (!stored || storedVersion < CURRENT_TAXONOMY_VERSION) {
      // Auto upgrade to V2 default taxonomy
      saveStoredTaxonomy(DEFAULT_TAXONOMY);
      localStorage.setItem('glossaryTaxonomyVersion', String(CURRENT_TAXONOMY_VERSION));
      return DEFAULT_TAXONOMY;
    }

    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse stored taxonomy', e);
  }
  return DEFAULT_TAXONOMY;
};

export const saveStoredTaxonomy = (taxonomy: TaxonomyItem[]) => {
  try {
    localStorage.setItem('glossaryTaxonomy', JSON.stringify(taxonomy));
    localStorage.setItem('glossaryTaxonomyVersion', String(CURRENT_TAXONOMY_VERSION));
    // Also save legacy format for backward compatibility
    localStorage.setItem('glossaryDomainFields', JSON.stringify(taxonomyToDomainFields(taxonomy)));
  } catch (e) {
    console.error('Failed to save taxonomy to localStorage', e);
  }
};

export const getStoredDomainFields = (): Record<string, string[]> => {
  return taxonomyToDomainFields(getStoredTaxonomy());
};
