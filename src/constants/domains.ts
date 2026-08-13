export const DOMAINS = [
  'Science',
  'Technology and Engineering',
  'Politics',
  'Economics and Finance',
  'Sociology',
  'Psychology',
  'Liberal Arts',
  'Entertainment'
];

export const DEFAULT_DOMAIN_FIELDS: Record<string, string[]> = {
  'Science': ['Physics', 'Chemistry', 'Biology', 'Astronomy', 'Earth Science'],
  'Technology and Engineering': ['Computer Science', 'Software Engineering', 'Electrical Engineering', 'Mechanical Engineering', 'Civil Engineering'],
  'Politics': ['International Relations', 'Political Theory', 'Comparative Politics', 'Public Administration'],
  'Economics and Finance': ['Macroeconomics', 'Microeconomics', 'Finance', 'Accounting', 'Marketing'],
  'Sociology': ['Culture', 'Demography', 'Criminology', 'Social Stratification'],
  'Psychology': ['Cognitive Psychology', 'Clinical Psychology', 'Developmental Psychology', 'Social Psychology'],
  'Liberal Arts': ['History', 'Literature', 'Philosophy', 'Art', 'Linguistics'],
  'Entertainment': ['Movies', 'Music', 'Gaming', 'Sports', 'Pop Culture']
};

export const getStoredDomainFields = (): Record<string, string[]> => {
  try {
    const stored = localStorage.getItem('glossaryDomainFields');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to parse domain fields', e);
  }
  return DEFAULT_DOMAIN_FIELDS;
};
