import Dexie, { type Table } from 'dexie';
import { Vocabulary, SyntaxTraining, Synonym, LearningHistory, LearningSession, UserSettings, CourseBookProgress } from './types';

export class MaylangDatabase extends Dexie {
  vocabulary!: Table<Vocabulary>;
  syntax_training!: Table<SyntaxTraining>;
  synonyms!: Table<Synonym>;
  learning_history!: Table<LearningHistory>;
  learning_sessions!: Table<LearningSession>;
  user_settings!: Table<UserSettings>;
  course_progress!: Table<CourseBookProgress>;

  constructor() {
    super('MayalngDB');
    this.version(6).stores({
      vocabulary: '++id, cloudId, wortart, grundform, englisch, box_level, naechste_faelligkeit, source_name, source_group, is_hidden, updatedAt, resetAt, *tags',
      syntax_training: '++id, sentence_de, sentence_en',
      synonyms: '++id, word, synonym',
      learning_history: '++id, cloudId, vocab_id, timestamp, correct, session_id',
      learning_sessions: '++id, cloudId, start_time, end_time',
      user_settings: 'key',
      course_progress: '[bookId+chapterId], bookId, status'
    });
  }
}

export const db = new MaylangDatabase();
