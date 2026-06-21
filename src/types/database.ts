// Types Supabase — régénérables avec `npm run db:types` une fois le projet linké.
// Ces types sont écrits à la main pour rester fonctionnels sans l'étape de génération.

export type Lettre = 'C' | 'H' | 'O' | 'I' | 'X';
export type AuthProvider = 'email' | 'google' | 'apple';

export interface Profile {
  id: string;
  email: string;
  prenom: string;
  nom: string | null;
  date_naissance: string | null; // "YYYY-MM-DD"
  provider: AuthProvider;
  is_admin: boolean;
  is_moderator: boolean;
  onboarding_completed_at: string | null;
  eula_accepted_at: string | null;
  banned_at: string | null;
  created_at: string;
}

export interface BlockedUser {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface ContentReport {
  id: string;
  reporter_id: string;
  content_type: 'photo' | 'secret_message';
  content_id: string;
  author_id: string | null;
  reason: string | null;
  content_excerpt: string | null;
  status: 'pending' | 'resolved' | 'dismissed';
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface PushToken {
  id: string;
  user_id: string;
  expo_token: string;
  platform: 'ios' | 'android';
  created_at: string;
}

export interface Question {
  id: string;
  lettre: Lettre;
  texte: string;
  ordre: number;
  is_onboarding: boolean;
  created_at: string;
}

export interface QuestionDelivery {
  id: string;
  question_id: string;
  user_id: string;
  sent_at: string;
  opened_at: string | null;
  answered_at: string | null;
}

export interface ResponseRow {
  id: string;
  delivery_id: string;
  user_id: string;
  question_id: string;
  lettre: Lettre;
  contenu: string;
  score: number | null;
  ai_feedback: string | null;
  created_at: string;
}

export interface Gauges {
  user_id: string;
  c_score: number;
  h_score: number;
  o_score: number;
  i_score: number;
  x_score: number;
  c_count: number;
  h_count: number;
  o_count: number;
  i_count: number;
  x_count: number;
  updated_at: string;
}

export interface FinalVerse {
  user_id: string;
  lettre_faible: Lettre;
  verset_ref: string;
  verset_texte: string;
  conseil: string;
  explication: string;
  created_at: string;
}

export interface ConferenceState {
  id: true;
  is_finished: boolean;
  current_question_id: string | null;
  gauges_unlocked: boolean;
  secret_friends_revealed: boolean;
  secret_reveal_at: string | null;
  updated_at: string;
}

export interface Sermon {
  id: string;
  titre: string;
  intervenant: string;
  theme: string;
  description: string | null;
  debut_at: string;
  fin_at: string;
  faq_offset_minutes: number;
  manual_open: boolean;
  created_at: string;
}

export interface FaqQuestion {
  id: string;
  sermon_id: string;
  user_id: string;
  prenom: string | null; // toujours null désormais — anonymisation forcée par trigger
  texte: string;
  is_pinned: boolean;
  is_answered: boolean;
  created_at: string;
}

export type QuizPhase = 'before' | 'after';

export interface SermonQuiz {
  id: string;
  sermon_id: string;
  question: string;
  lettre: Lettre;
  before_open: boolean;
  after_open: boolean;
  created_at: string;
}

export interface SermonQuizOption {
  id: string;
  quiz_id: string;
  texte: string;
  ordre: number;
  is_positive: boolean;
  score: number; // 0-5
  created_at: string;
}

export interface SermonQuizVote {
  id: string;
  quiz_id: string;
  user_id: string;
  phase: QuizPhase;
  option_id: string;
  created_at: string;
  updated_at: string;
}

export interface SecretFriend {
  giver_id: string;
  receiver_id: string;
  created_at: string;
}

export interface Photo {
  id: string;
  user_id: string;
  url: string;
  storage_path: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface PhotoLike {
  photo_id: string;
  user_id: string;
  created_at: string;
}

export interface FaqLike {
  question_id: string;
  user_id: string;
  created_at: string;
}

export interface SecretMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  contenu: string;
  read_at: string | null;
  reaction: string | null;
  created_at: string;
}

export interface ProgramItem {
  id: string;
  heure_debut: string;
  heure_fin: string;
  titre: string;
  intervenant: string | null;
  description: string | null;
  ordre: number;
}

export interface Chant {
  id: string;
  titre: string;
  url: string;
  ordre: number;
  created_by: string | null;
  created_at: string;
}

// Le client supabase-js exige que chaque table expose Row/Insert/Update/Relationships,
// et que le schéma expose Tables/Views/Functions ; il faut surtout que chaque Row soit
// assignable à `Record<string, unknown>`. Une `interface` brute NE l'est PAS (pas de
// signature d'index implicite), contrairement à un type mappé — d'où `Flatten<>`.
// Sans ça, supabase-js dégrade silencieusement tout le schéma en `never`.
type Flatten<T> = { [K in keyof T]: T[K] };

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Flatten<Profile>; Insert: Partial<Profile> & { id: string; email: string; prenom: string }; Update: Partial<Profile>; Relationships: [] };
      push_tokens: { Row: Flatten<PushToken>; Insert: Omit<PushToken, 'id' | 'created_at'>; Update: Partial<PushToken>; Relationships: [] };
      questions: { Row: Flatten<Question>; Insert: Omit<Question, 'id' | 'created_at'>; Update: Partial<Question>; Relationships: [] };
      question_deliveries: { Row: Flatten<QuestionDelivery>; Insert: Omit<QuestionDelivery, 'id' | 'sent_at'> & { sent_at?: string }; Update: Partial<QuestionDelivery>; Relationships: [] };
      responses: { Row: Flatten<ResponseRow>; Insert: Omit<ResponseRow, 'id' | 'created_at'>; Update: Partial<ResponseRow>; Relationships: [] };
      gauges: { Row: Flatten<Gauges>; Insert: never; Update: never; Relationships: [] };
      final_verse: { Row: Flatten<FinalVerse>; Insert: Omit<FinalVerse, 'created_at'>; Update: Partial<FinalVerse>; Relationships: [] };
      conference_state: { Row: Flatten<ConferenceState>; Insert: never; Update: Partial<ConferenceState>; Relationships: [] };
      program: { Row: Flatten<ProgramItem>; Insert: Omit<ProgramItem, 'id'>; Update: Partial<ProgramItem>; Relationships: [] };
      program_favorites: { Row: { user_id: string; program_id: string; created_at: string }; Insert: { user_id: string; program_id: string }; Update: never; Relationships: [] };
      chants: { Row: Flatten<Chant>; Insert: Omit<Chant, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<Chant>; Relationships: [] };
      sermons: { Row: Flatten<Sermon>; Insert: Omit<Sermon, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<Sermon>; Relationships: [] };
      faq_questions: { Row: Flatten<FaqQuestion>; Insert: Omit<FaqQuestion, 'id' | 'created_at' | 'is_pinned' | 'is_answered'> & { id?: string; created_at?: string; is_pinned?: boolean; is_answered?: boolean }; Update: Partial<FaqQuestion>; Relationships: [] };
      faq_likes: { Row: Flatten<FaqLike>; Insert: Omit<FaqLike, 'created_at'> & { created_at?: string }; Update: Partial<FaqLike>; Relationships: [] };
      photos: { Row: Flatten<Photo>; Insert: Omit<Photo, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<Photo>; Relationships: [] };
      photo_likes: { Row: Flatten<PhotoLike>; Insert: Omit<PhotoLike, 'created_at'> & { created_at?: string }; Update: Partial<PhotoLike>; Relationships: [] };
      secret_messages: { Row: Flatten<SecretMessage>; Insert: Omit<SecretMessage, 'id' | 'created_at' | 'read_at' | 'reaction'> & { id?: string; created_at?: string; read_at?: string | null; reaction?: string | null }; Update: Partial<SecretMessage>; Relationships: [] };
      secret_friends: { Row: Flatten<SecretFriend>; Insert: Omit<SecretFriend, 'created_at'> & { created_at?: string }; Update: Partial<SecretFriend>; Relationships: [] };
      blocked_users: { Row: Flatten<BlockedUser>; Insert: Omit<BlockedUser, 'created_at'> & { created_at?: string }; Update: Partial<BlockedUser>; Relationships: [] };
      content_reports: { Row: Flatten<ContentReport>; Insert: Omit<ContentReport, 'id' | 'created_at' | 'status' | 'resolution' | 'resolved_by' | 'resolved_at'> & { id?: string; created_at?: string }; Update: Partial<ContentReport>; Relationships: [] };
      sermon_quiz: { Row: Flatten<SermonQuiz>; Insert: Omit<SermonQuiz, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<SermonQuiz>; Relationships: [] };
      sermon_quiz_options: { Row: Flatten<SermonQuizOption>; Insert: Omit<SermonQuizOption, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<SermonQuizOption>; Relationships: [] };
      sermon_quiz_votes: { Row: Flatten<SermonQuizVote>; Insert: Omit<SermonQuizVote, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }; Update: Partial<SermonQuizVote>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
