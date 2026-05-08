import { CourseBook, Chapter } from './types';

export const COURSE_BOOKS: CourseBook[] = [
  {
    id: 'schritte-b1-goethe',
    title: 'Schritte B1 Goethe',
    level: 'B1',
    series: 'Schritte Goethe',
    chapterCount: 14,
    totalVocab: 700,
    description: 'Dein Begleiter für den B1 Goethe Kurs.'
  },
  {
    id: 'schritte-a1',
    title: 'Schritte A1 ÖSD',
    level: 'A1',
    series: 'Schritte ÖSD',
    chapterCount: 14,
    totalVocab: 700,
    description: 'Dein Begleiter für den A1 ÖSD Kurs.'
  },
  {
    id: 'schritte-a2',
    title: 'Schritte A2 ÖSD',
    level: 'A2',
    series: 'Schritte ÖSD',
    chapterCount: 14,
    totalVocab: 700,
    description: 'Dein Begleiter für den A2 ÖSD Kurs.'
  }
];

export const CHAPTERS: Record<string, Chapter[]> = {
  'schritte-b1-goethe': [
    { id: 'schritte-b1-g-c1', bookId: 'schritte-b1-goethe', number: 1, title: 'Kapitel 1', vocabCount: 50 },
    { id: 'schritte-b1-g-c2', bookId: 'schritte-b1-goethe', number: 2, title: 'Kapitel 2', vocabCount: 50 },
    { id: 'schritte-b1-g-c3', bookId: 'schritte-b1-goethe', number: 3, title: 'Kapitel 3', vocabCount: 50 },
    { id: 'schritte-b1-g-c4', bookId: 'schritte-b1-goethe', number: 4, title: 'Kapitel 4', vocabCount: 50 },
    { id: 'schritte-b1-g-c5', bookId: 'schritte-b1-goethe', number: 5, title: 'Kapitel 5', vocabCount: 50 },
    { id: 'schritte-b1-g-c6', bookId: 'schritte-b1-goethe', number: 6, title: 'Kapitel 6', vocabCount: 50 },
    { id: 'schritte-b1-g-c7', bookId: 'schritte-b1-goethe', number: 7, title: 'Kapitel 7', vocabCount: 50 },
    { id: 'schritte-b1-g-c8', bookId: 'schritte-b1-goethe', number: 8, title: 'Kapitel 8', vocabCount: 50 },
    { id: 'schritte-b1-g-c9', bookId: 'schritte-b1-goethe', number: 9, title: 'Kapitel 9', vocabCount: 50 },
    { id: 'schritte-b1-g-c10', bookId: 'schritte-b1-goethe', number: 10, title: 'Kapitel 10', vocabCount: 50 },
    { id: 'schritte-b1-g-c11', bookId: 'schritte-b1-goethe', number: 11, title: 'Kapitel 11', vocabCount: 50 },
    { id: 'schritte-b1-g-c12', bookId: 'schritte-b1-goethe', number: 12, title: 'Kapitel 12', vocabCount: 50 },
    { id: 'schritte-b1-g-c13', bookId: 'schritte-b1-goethe', number: 13, title: 'Kapitel 13', vocabCount: 50 },
    { id: 'schritte-b1-g-c14', bookId: 'schritte-b1-goethe', number: 14, title: 'Kapitel 14', vocabCount: 50 },
  ],
  'schritte-a1': [
    { id: 'schritte-a1-c1', bookId: 'schritte-a1', number: 1, title: 'Kapitel 1', vocabCount: 50 },
    { id: 'schritte-a1-c2', bookId: 'schritte-a1', number: 2, title: 'Kapitel 2', vocabCount: 50 },
    { id: 'schritte-a1-c3', bookId: 'schritte-a1', number: 3, title: 'Kapitel 3', vocabCount: 50 },
    { id: 'schritte-a1-c4', bookId: 'schritte-a1', number: 4, title: 'Kapitel 4', vocabCount: 50 },
    { id: 'schritte-a1-c5', bookId: 'schritte-a1', number: 5, title: 'Kapitel 5', vocabCount: 50 },
    { id: 'schritte-a1-c6', bookId: 'schritte-a1', number: 6, title: 'Kapitel 6', vocabCount: 50 },
    { id: 'schritte-a1-c7', bookId: 'schritte-a1', number: 7, title: 'Kapitel 7', vocabCount: 50 },
    { id: 'schritte-a1-c8', bookId: 'schritte-a1', number: 8, title: 'Kapitel 8', vocabCount: 50 },
    { id: 'schritte-a1-c9', bookId: 'schritte-a1', number: 9, title: 'Kapitel 9', vocabCount: 50 },
    { id: 'schritte-a1-c10', bookId: 'schritte-a1', number: 10, title: 'Kapitel 10', vocabCount: 50 },
    { id: 'schritte-a1-c11', bookId: 'schritte-a1', number: 11, title: 'Kapitel 11', vocabCount: 50 },
    { id: 'schritte-a1-c12', bookId: 'schritte-a1', number: 12, title: 'Kapitel 12', vocabCount: 50 },
    { id: 'schritte-a1-c13', bookId: 'schritte-a1', number: 13, title: 'Kapitel 13', vocabCount: 50 },
    { id: 'schritte-a1-c14', bookId: 'schritte-a1', number: 14, title: 'Kapitel 14', vocabCount: 50 },
  ],
  'schritte-a2': [
    { id: 'schritte-a2-c1', bookId: 'schritte-a2', number: 1, title: 'Kapitel 1', vocabCount: 50 },
    { id: 'schritte-a2-c2', bookId: 'schritte-a2', number: 2, title: 'Kapitel 2', vocabCount: 50 },
    { id: 'schritte-a2-c3', bookId: 'schritte-a2', number: 3, title: 'Kapitel 3', vocabCount: 50 },
    { id: 'schritte-a2-c4', bookId: 'schritte-a2', number: 4, title: 'Kapitel 4', vocabCount: 50 },
    { id: 'schritte-a2-c5', bookId: 'schritte-a2', number: 5, title: 'Kapitel 5', vocabCount: 50 },
    { id: 'schritte-a2-c6', bookId: 'schritte-a2', number: 6, title: 'Kapitel 6', vocabCount: 50 },
    { id: 'schritte-a2-c7', bookId: 'schritte-a2', number: 7, title: 'Kapitel 7', vocabCount: 50 },
    { id: 'schritte-a2-c8', bookId: 'schritte-a2', number: 8, title: 'Kapitel 8', vocabCount: 50 },
    { id: 'schritte-a2-c9', bookId: 'schritte-a2', number: 9, title: 'Kapitel 9', vocabCount: 50 },
    { id: 'schritte-a2-c10', bookId: 'schritte-a2', number: 10, title: 'Kapitel 10', vocabCount: 50 },
    { id: 'schritte-a2-c11', bookId: 'schritte-a2', number: 11, title: 'Kapitel 11', vocabCount: 50 },
    { id: 'schritte-a2-c12', bookId: 'schritte-a2', number: 12, title: 'Kapitel 12', vocabCount: 50 },
    { id: 'schritte-a2-c13', bookId: 'schritte-a2', number: 13, title: 'Kapitel 13', vocabCount: 50 },
    { id: 'schritte-a2-c14', bookId: 'schritte-a2', number: 14, title: 'Kapitel 14', vocabCount: 50 },
  ]
};
