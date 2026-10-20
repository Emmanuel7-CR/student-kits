export interface Tool {
  slug: string;
  title: string;
  blurb: string;
  icon: string;
  keywords: string[];
}

export const tools: Tool[] = [
  {
    slug: 'cgpa',
    title: 'CGPA Calculator',
    blurb: 'Pick the 4.0 or 5.0 scale, add many semesters, see your class, and plan the GPA you need next. Saved on your device.',
    icon: 'calculator',
    keywords: ['gpa', 'cgpa', 'grade point', 'degree class', 'first class', '2:1', '4.0', '5.0', 'semester', 'result'],
  },
  {
    slug: 'gpa-converter',
    title: 'GPA Converter',
    blurb: 'Estimate a CGPA on the other scale, and learn the more accurate way to convert.',
    icon: 'repeat',
    keywords: ['convert', '5.0 to 4.0', '4.0 to 5.0', 'wes', 'abroad', 'masters'],
  },
  {
    slug: 'aggregate',
    title: 'Post-UTME Aggregate Calculator',
    blurb: 'Combine your UTME and Post-UTME scores using weights you can match to your school.',
    icon: 'percent',
    keywords: ['jamb', 'utme', 'post utme', 'aggregate', 'admission', 'cut off'],
  },
  {
    slug: 'citation',
    title: 'Citation Generator',
    blurb: 'APA 7, MLA 9 and Harvard references for books, journal articles and websites.',
    icon: 'quote',
    keywords: ['reference', 'apa', 'mla', 'harvard', 'bibliography', 'cite', 'project', 'thesis'],
  },
  {
    slug: 'pdf',
    title: 'PDF Tools',
    blurb: 'Merge PDFs, turn photos into a PDF, or keep and remove pages. Files never leave your phone.',
    icon: 'file',
    keywords: ['pdf', 'merge', 'combine', 'split', 'extract pages', 'images to pdf', 'jpg to pdf', 'assignment', 'scan'],
  },
  {
    slug: 'cv',
    title: 'CV Builder',
    blurb: 'Build a clean one or two page CV for internships and jobs, then print it or save it as PDF.',
    icon: 'user',
    keywords: ['cv', 'resume', 'curriculum vitae', 'job', 'internship', 'siwes', 'referees', 'application'],
  },
  {
    slug: 'siwes',
    title: 'SIWES Logbook and Letters',
    blurb: 'Print a weekly SIWES logbook with the right dates, and write your placement request letter.',
    icon: 'clipboard',
    keywords: ['siwes', 'itf', 'industrial training', 'logbook', 'placement', 'attachment', 'letter', 'it'],
  },
  {
    slug: 'cbt',
    title: 'CBT Practice',
    blurb: 'Timed multiple-choice practice. Use the sample sets or turn your own notes into a quiz.',
    icon: 'check',
    keywords: ['cbt', 'quiz', 'practice', 'exam', 'multiple choice', 'mcq', 'test', 'jamb', 'post utme', 'revision', 'study'],
  },
  {
    slug: 'project-topics',
    title: 'Project Topic Ideas',
    blurb: 'Starting ideas for final year projects by department. Always agree the final topic with your supervisor.',
    icon: 'lightbulb',
    keywords: ['final year', 'project', 'topic', 'research', 'seminar', 'proposal'],
  },
  {
    slug: 'invoice',
    title: 'Invoice Generator',
    blurb: 'Make a clean invoice for freelance work and print or save it as PDF. VAT is optional.',
    icon: 'receipt',
    keywords: ['invoice', 'receipt', 'freelance', 'business', 'pdf', 'vat'],
  },
  {
    slug: 'profit',
    title: 'Profit Calculator',
    blurb: 'Profit, margin and markup for a product, plus the price you need for a target margin.',
    icon: 'trending',
    keywords: ['profit', 'margin', 'markup', 'business', 'accounting', 'selling price'],
  },
];
