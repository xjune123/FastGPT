import { LLMModelUsageEnum } from '@/constants/model';

export type LLMModelItemType = {
  model: string;
  name: string;
  maxToken: number;
  price: number;
};
export type ChatModelItemType = LLMModelItemType & {
  quoteMaxToken: number;
  maxTemperature: number;
  censor?: boolean;
  defaultSystemChatPrompt?: string;
};

export type FunctionModelItemType = LLMModelItemType & {
  functionCall: boolean;
  functionPrompt: string;
};

export type VectorModelItemType = {
  model: string;
  name: string;
  defaultToken: number;
  price: number;
  maxToken: number;
};

export type TokenInfoType = {
  client_id: string;
  client_secret: string;
  grant_type: string;
  token_url: string;
  user_info_url: string;
};
