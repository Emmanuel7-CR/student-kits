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
