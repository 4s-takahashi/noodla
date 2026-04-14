export type AIFeatureId = 'chat' | 'summarize' | 'translate' | 'draft';

export interface AIFeature {
  id: AIFeatureId;
  name: string;
  description: string;
  pointCost: number;
  icon: string;
  color: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isProcessing?: boolean;
}

export interface AIUsage {
  feature: AIFeatureId;
  pointsUsed: number;
  timestamp: string;
}
