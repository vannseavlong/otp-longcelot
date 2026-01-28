export type User = {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TelegramCredentials = {
  id: number;
  user_id: number;
  telegram_chat_id: string | null;
  telegram_username: string | null;
  is_verified: boolean;
  linked_at: string | null;
};

export type OTPRequest = {
  id: number;
  user_id: number;
  otp_hash: string;
  expires_at: string;
  used: boolean;
  context: 'login' | 'sensitive' | 'telegram_change';
  created_at: string;
};

export type RecoveryCode = {
  id: number;
  user_id: number;
  code_hash: string;
  used: boolean;
  created_at: string;
};

export type LinkToken = {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
  used: boolean;
  created_at: string;
};
