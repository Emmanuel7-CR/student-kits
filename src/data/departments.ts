/**
 * Common, populated departments in Nigerian universities. Names differ between schools (for example "Nursing Science"
 * or "Nursing"), so these are the widely used names. The slug is what the library stores, so never rename a slug.
 */

export type Area = 'science' | 'arts';

export interface Department {
  slug: string;
  name: string;
  area: Area;
  faculty: string;
}

export const areaLabels: Record<Area, string> = {
  science: 'Sciences, Health and Engineering',
  arts: 'Arts, Social Sciences, Law and Management',
};

const d = (slug: string, name: string, area: Area, faculty: string): Department => ({ slug, name, area, faculty });

export const departments: Department[] = [
  // Health sciences
  d('medicine-and-surgery', 'Medicine and Surgery', 'science', 'Health Sciences'),
  d('nursing', 'Nursing Science', 'science', 'Health Sciences'),
  d('pharmacy', 'Pharmacy', 'science', 'Health Sciences'),
  d('medical-laboratory-science', 'Medical Laboratory Science', 'science', 'Health Sciences'),
  d('dentistry', 'Dentistry', 'science', 'Health Sciences'),
  d('physiotherapy', 'Physiotherapy', 'science', 'Health Sciences'),
  d('radiography', 'Radiography and Radiation Science', 'science', 'Health Sciences'),
  d('anatomy', 'Anatomy', 'science', 'Health Sciences'),
  d('physiology', 'Human Physiology', 'science', 'Health Sciences'),
  d('public-health', 'Public Health', 'science', 'Health Sciences'),
  d('nutrition-and-dietetics', 'Nutrition and Dietetics', 'science', 'Health Sciences'),
  d('veterinary-medicine', 'Veterinary Medicine', 'science', 'Health Sciences'),
  // Natural and applied sciences
  d('computer-science', 'Computer Science', 'science', 'Natural and Applied Sciences'),
  d('information-technology', 'Information Technology', 'science', 'Natural and Applied Sciences'),
  d('software-engineering', 'Software Engineering', 'science', 'Natural and Applied Sciences'),
  d('cyber-security', 'Cyber Security', 'science', 'Natural and Applied Sciences'),
  d('mathematics', 'Mathematics', 'science', 'Natural and Applied Sciences'),
  d('statistics', 'Statistics', 'science', 'Natural and Applied Sciences'),
  d('physics', 'Physics', 'science', 'Natural and Applied Sciences'),
  d('chemistry', 'Chemistry', 'science', 'Natural and Applied Sciences'),
  d('industrial-chemistry', 'Industrial Chemistry', 'science', 'Natural and Applied Sciences'),
  d('biochemistry', 'Biochemistry', 'science', 'Natural and Applied Sciences'),
  d('microbiology', 'Microbiology', 'science', 'Natural and Applied Sciences'),
  d('biology', 'Biological Sciences', 'science', 'Natural and Applied Sciences'),
  d('botany', 'Botany and Plant Science', 'science', 'Natural and Applied Sciences'),
  d('zoology', 'Zoology and Animal Biology', 'science', 'Natural and Applied Sciences'),
  d('biotechnology', 'Biotechnology', 'science', 'Natural and Applied Sciences'),
  d('geology', 'Geology', 'science', 'Natural and Applied Sciences'),
  // Agriculture
  d('agricultural-science', 'Agricultural Science', 'science', 'Agriculture'),
  d('agricultural-economics', 'Agricultural Economics and Extension', 'science', 'Agriculture'),
  d('food-science', 'Food Science and Technology', 'science', 'Agriculture'),
  // Engineering
  d('civil-engineering', 'Civil Engineering', 'science', 'Engineering'),
  d('electrical-engineering', 'Electrical and Electronics Engineering', 'science', 'Engineering'),
  d('mechanical-engineering', 'Mechanical Engineering', 'science', 'Engineering'),
  d('chemical-engineering', 'Chemical Engineering', 'science', 'Engineering'),
  d('computer-engineering', 'Computer Engineering', 'science', 'Engineering'),
  d('petroleum-engineering', 'Petroleum Engineering', 'science', 'Engineering'),
  // Environmental sciences
  d('architecture', 'Architecture', 'science', 'Environmental Sciences'),
  d('estate-management', 'Estate Management', 'science', 'Environmental Sciences'),
  d('quantity-surveying', 'Quantity Surveying', 'science', 'Environmental Sciences'),
  d('urban-planning', 'Urban and Regional Planning', 'science', 'Environmental Sciences'),
  d('building', 'Building Technology', 'science', 'Environmental Sciences'),
  // Social sciences
  d('economics', 'Economics', 'arts', 'Social Sciences'),
  d('political-science', 'Political Science', 'arts', 'Social Sciences'),
  d('international-relations', 'International Relations', 'arts', 'Social Sciences'),
  d('sociology', 'Sociology', 'arts', 'Social Sciences'),
  d('psychology', 'Psychology', 'arts', 'Social Sciences'),
  d('geography', 'Geography', 'arts', 'Social Sciences'),
  d('criminology', 'Criminology and Security Studies', 'arts', 'Social Sciences'),
  d('social-work', 'Social Work', 'arts', 'Social Sciences'),
  d('mass-communication', 'Mass Communication', 'arts', 'Social Sciences'),
  d('public-administration', 'Public Administration', 'arts', 'Social Sciences'),
  // Management sciences
  d('accounting', 'Accounting', 'arts', 'Management Sciences'),
  d('business-administration', 'Business Administration', 'arts', 'Management Sciences'),
  d('banking-and-finance', 'Banking and Finance', 'arts', 'Management Sciences'),
  d('marketing', 'Marketing', 'arts', 'Management Sciences'),
  // Law
  d('law', 'Law', 'arts', 'Law'),
  // Arts and humanities
  d('english', 'English and Literary Studies', 'arts', 'Arts'),
  d('linguistics', 'Linguistics and Nigerian Languages', 'arts', 'Arts'),
  d('french', 'French', 'arts', 'Arts'),
  d('history', 'History and International Studies', 'arts', 'Arts'),
  d('philosophy', 'Philosophy', 'arts', 'Arts'),
  d('religious-studies', 'Religious Studies', 'arts', 'Arts'),
  d('theatre-arts', 'Theatre and Performing Arts', 'arts', 'Arts'),
  d('music', 'Music', 'arts', 'Arts'),
  d('fine-arts', 'Fine and Applied Arts', 'arts', 'Arts'),
  d('library-science', 'Library and Information Science', 'arts', 'Arts'),
  // Education
  d('education', 'Education', 'arts', 'Education'),
  d('guidance-counselling', 'Guidance and Counselling', 'arts', 'Education'),
];

export const bySlug = new Map(departments.map((x) => [x.slug, x]));

export function departmentName(slug: string): string {
  return bySlug.get(slug)?.name ?? slug;
}

/** Departments grouped for a <select> with optgroups: area first, then faculty. */
export function grouped(subset: Department[] = departments): { label: string; items: Department[] }[] {
  const out: { label: string; items: Department[] }[] = [];
  for (const area of ['science', 'arts'] as Area[]) {
    const faculties = [...new Set(subset.filter((x) => x.area === area).map((x) => x.faculty))];
    for (const faculty of faculties) {
      out.push({ label: faculty, items: subset.filter((x) => x.area === area && x.faculty === faculty) });
    }
  }
  return out;
}
