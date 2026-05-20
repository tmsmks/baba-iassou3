// Types Supabase — régénérables avec `npm run db:types` une fois le projet linké.
// Ces types sont écrits à la main pour rester fonctionnels sans l'étape de génération.

export type Lettre = 'C' | 'H' | 'O' | 'I' | 'X';
export type AuthProvider = 'email' | 'google' | 'apple';

export interface Profile {
  id: string;
  email: string;
  prenom: string;
  provider: AuthProvider;
  is_admin: boolean;
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
  updated_at: string;
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

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & { id: string; email: string; prenom: string }; Update: Partial<Profile> };
      push_tokens: { Row: PushToken; Insert: Omit<PushToken, 'id' | 'created_at'>; Update: Partial<PushToken> };
      questions: { Row: Question; Insert: Omit<Question, 'id' | 'created_at'>; Update: Partial<Question> };
      question_deliveries: { Row: QuestionDelivery; Insert: Omit<QuestionDelivery, 'id' | 'sent_at'> & { sent_at?: string }; Update: Partial<QuestionDelivery> };
      responses: { Row: ResponseRow; Insert: Omit<ResponseRow, 'id' | 'created_at'>; Update: Partial<ResponseRow> };
      gauges: { Row: Gauges; Insert: never; Update: never };
      final_verse: { Row: FinalVerse; Insert: Omit<FinalVerse, 'created_at'>; Update: Partial<FinalVerse> };
      conference_state: { Row: ConferenceState; Insert: never; Update: Partial<ConferenceState> };
      program: { Row: ProgramItem; Insert: Omit<ProgramItem, 'id'>; Update: Partial<ProgramItem> };
      program_favorites: { Row: { user_id: string; program_id: string; created_at: string }; Insert: { user_id: string; program_id: string }; Update: never };
    };
  };
}
