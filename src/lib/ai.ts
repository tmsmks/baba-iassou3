import { supabase } from './supabase';
import type { Lettre, FinalVerse } from '@/types/database';

export interface ChatRespondResult {
  response_id: string;
  message: string;
  score: number;
  lettre: Lettre;
}

export async function postChatResponse(
  deliveryId: string,
  contenu: string,
): Promise<ChatRespondResult> {
  const { data, error } = await supabase.functions.invoke<ChatRespondResult>('chat-respond', {
    body: { delivery_id: deliveryId, contenu },
  });
  if (error) throw error;
  if (!data) throw new Error('Réponse IA vide');
  return data;
}

export async function fetchFinalVerse(): Promise<FinalVerse> {
  const { data, error } = await supabase.functions.invoke<FinalVerse>('final-verse', {
    body: {},
  });
  if (error) throw error;
  if (!data) throw new Error('Verset vide');
  return data;
}

export interface SendQuestionPayload {
  question_id?: string;
  lettre?: Lettre;
  texte?: string;
}

export async function sendQuestion(payload: SendQuestionPayload): Promise<{
  question_id: string;
  users_targeted: number;
  devices_pushed: number;
  devices_failed: number;
}> {
  const { data, error } = await supabase.functions.invoke('send-question', { body: payload });
  if (error) throw error;
  return data as never;
}
