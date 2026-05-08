export type Wortart = 'Verb' | 'Nomen' | 'Adjektiv' | 'Sonstige';

export interface Vocabulary {
  id?: number;
  cloudId?: string;
  wortart: string;
  grundform: string;
  englisch: string;
  beispielsatz: string;
  level: string;
  // Verb fields
  v_hilfsverb?: string;
  v_partizip_ii?: string;
  v_praesens_ich?: string;
  v_praesens_du?: string;
  v_praesens_er?: string;
  v_praesens_wir?: string;
  v_praesens_ihr?: string;
  v_praesens_sie?: string;
  v_praet_ich?: string;
  v_praet_du?: string;
  v_praet_er?: string;
  v_praet_wir?: string;
  v_praet_ihr?: string;
  v_praet_sie?: string;
  v_imperativ_du?: string;
  v_imperativ_ihr?: string;
  v_imperativ_sie?: string;
  // Noun fields
  n_artikel?: string;
  n_nom_sg?: string;
  n_nom_pl?: string;
  // Adjective fields
  adj_komparativ?: string;
  adj_superlativ?: string;
  // Spaced Repetition fields
  box_level: string; // '1', '2', '3', '4', '5' or 'Archiv'
  naechste_faelligkeit: string; // YYYY-MM-DD HH:MM
  fehlerquote: number;
  source_name?: string;
  source_group?: string;
  is_hidden?: boolean;
  tags?: string[];
  last_direction?: 'de-en' | 'en-de';
  times_correct?: number;
  times_incorrect?: number;
  last_seen?: string;
  resetAt?: string;
  updatedAt?: string;
}

export interface SyntaxTraining {
  id?: number;
  sentence_de: string;
  sentence_en: string;
  components: string; // JSON string
}

export interface Synonym {
  id?: number;
  word: string;
  synonym: string;
}

export interface LearningHistory {
  id?: number;
  cloudId?: string;
  vocab_id: number;
  timestamp: string;
  correct: number; // 1 or 0
  session_id?: number;
}

export interface LearningSession {
  id?: number;
  cloudId?: string;
  start_time: string;
  end_time?: string;
  vocab_count: number;
  correct_count: number;
  new_vocab_count: number;
  duration_seconds?: number;
  last_activity_time?: string;
}

export interface CourseBook {
  id: string;
  title: string;
  level: string;
  chapterCount: number;
  totalVocab: number;
  description?: string;
  thumbnail?: string;
  series: string;
}

export interface Chapter {
  id: string;
  bookId: string;
  number: number;
  title: string;
  vocabCount: number;
}

export interface CourseBookProgress {
  bookId: string;
  chapterId: string;
  progress: number; // 0 to 100
  status: 'not_started' | 'started' | 'completed';
}

export interface UserSettings {
  id?: number;
  key: string;
  value: any;
}
