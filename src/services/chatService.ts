import { supabase, UserProfile } from './supabaseService';
import { RealtimeChannel } from '@supabase/supabase-js';

// ============ ТИПИ ============

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  participants?: ConversationParticipant[];
  last_message?: Message;
}

export interface ConversationParticipant {
  conversation_id: string;
  user_id: string;
  joined_at: string;
  profile?: UserProfile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_profile?: UserProfile;
}

export interface ConversationWithOtherUser extends Conversation {
  other_user?: UserProfile;
}

// ============ CONVERSATIONS ============

/**
 * Get or create a 1-to-1 conversation with another user
 */
export async function getOrCreateConversation(otherUserId: string): Promise<Conversation> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Don't allow chat with self
  if (otherUserId === user.id) {
    throw new Error('Cannot start a conversation with yourself');
  }

  // Check if conversation already exists between these two users
  const { data: existing } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', user.id);

  if (existing && existing.length > 0) {
    const convIds = existing.map((p) => p.conversation_id);

    const { data: otherUserConv } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', otherUserId)
      .in('conversation_id', convIds)
      .single();

    if (otherUserConv) {
      const { data: conv, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', otherUserConv.conversation_id)
        .single();

      if (error) throw error;
      return conv as Conversation;
    }
  }

  // Create new conversation without RETURNING.
  // RLS can block selecting the row before participants are inserted.
  const newConversationId = crypto.randomUUID();

  const { error: convError } = await supabase
    .from('conversations')
    .insert({ id: newConversationId });

  if (convError) throw convError;

  // Add both participants (current user first for RLS)
  const { error: p1Error } = await supabase
    .from('conversation_participants')
    .insert({ conversation_id: newConversationId, user_id: user.id });

  if (p1Error) throw p1Error;

  const { error: p2Error } = await supabase
    .from('conversation_participants')
    .insert({ conversation_id: newConversationId, user_id: otherUserId });

  if (p2Error) throw p2Error;

  const { data: createdConv, error: createdConvError } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', newConversationId)
    .single();

  if (createdConvError) throw createdConvError;

  return createdConv as Conversation;
}

/**
 * Get all conversations for the current user
 */
export async function getConversations(): Promise<ConversationWithOtherUser[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: participations, error: partError } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', user.id);

  if (partError) throw partError;
  if (!participations || participations.length === 0) return [];

  const convIds = participations.map((p) => p.conversation_id);

  const { data: convs, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .in('id', convIds)
    .order('updated_at', { ascending: false });

  if (convError) throw convError;
  if (!convs) return [];

  // For each conversation, get the other participant and last message
  const result: ConversationWithOtherUser[] = [];

  for (const conv of convs) {
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conv.id)
      .neq('user_id', user.id);

    const otherUserId = participants?.[0]?.user_id;

    // Get other user profile
    let otherUser: UserProfile | undefined;
    if (otherUserId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', otherUserId)
        .single();
      otherUser = profile as UserProfile;
    }

    // Get last message
    const { data: lastMsg } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    result.push({
      ...conv,
      other_user: otherUser,
      last_message: lastMsg as Message | null,
    });
  }

  return result;
}

// ============ MESSAGES ============

/**
 * Get messages for a conversation
 */
export async function getMessages(
  conversationId: string,
  limit = 50,
  before?: string
): Promise<Message[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Enrich with sender profiles
  const profiles = new Map<string, UserProfile>();
  const senderIds = [...new Set((data || []).map((m) => m.sender_id))];

  for (const senderId of senderIds) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', senderId)
      .single();
    if (profile) profiles.set(senderId, profile as UserProfile);
  }

  return (data || []).map((m) => ({
    ...m,
    sender_profile: profiles.get(m.sender_id),
  })) as Message[];
}

/**
 * Send a message
 */
export async function sendMessage(conversationId: string, content: string): Promise<Message> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const trimmed = content.trim();
  if (!trimmed) throw new Error('Message cannot be empty');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: trimmed,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Message;
}

// ============ REALTIME ============

/**
 * Subscribe to new messages in a conversation
 */
export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: Message) => void
): RealtimeChannel {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      async (payload) => {
        const msg = payload.new as Message;
        // Fetch sender profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', msg.sender_id)
          .single();
        onMessage({ ...msg, sender_profile: profile as UserProfile });
      }
    )
    .subscribe();
}

/**
 * Unsubscribe from a channel
 */
export function unsubscribeFromChannel(channel: RealtimeChannel) {
  supabase.removeChannel(channel);
}
