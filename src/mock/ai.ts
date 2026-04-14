import { AIFeature, ChatMessage } from '../types/ai';

export const mockAIFeatures: AIFeature[] = [
  {
    id: 'chat',
    name: 'AIチャット',
    description: 'なんでも聞いてみよう。Noodlaネットワークが答えます。',
    pointCost: 30,
    icon: 'chatbubbles',
    color: '#00d2ff',
  },
  {
    id: 'summarize',
    name: '文章要約',
    description: '長い文章をスマートに要約します。',
    pointCost: 20,
    icon: 'document-text',
    color: '#7c3aed',
  },
  {
    id: 'translate',
    name: '翻訳',
    description: '多言語対応の高精度翻訳。',
    pointCost: 15,
    icon: 'language',
    color: '#22c55e',
  },
  {
    id: 'draft',
    name: '文章生成',
    description: 'テーマとトーンを指定して文章を生成します。',
    pointCost: 25,
    icon: 'create',
    color: '#f59e0b',
  },
];

export const mockChatHistory: ChatMessage[] = [
  {
    id: 'msg-001',
    role: 'assistant',
    content: 'こんにちは！Noodla AIアシスタントです。何でもお気軽にご質問ください。Noodlaネットワークの分散AIがお答えします。',
    timestamp: '2026-04-13T14:00:00',
  },
  {
    id: 'msg-002',
    role: 'user',
    content: '分散AIネットワークってどういう仕組みですか？',
    timestamp: '2026-04-13T14:01:00',
  },
  {
    id: 'msg-003',
    role: 'assistant',
    content: '分散AIネットワークとは、多数のデバイスが協力してAI処理を分担する仕組みです。Noodlaでは、参加者のスマートフォンが小さな計算タスクを処理し、それらを組み合わせることで大きなAI処理を実現しています。これにより、中央サーバーへの依存を減らし、よりプライバシーに配慮したAIサービスが可能になります。',
    timestamp: '2026-04-13T14:01:30',
  },
];

export const mockSummarizeResult = `このドキュメントの要点は以下の通りです：

1. **主要な課題**: 現代のAIシステムは大規模なサーバーインフラに依存しており、コストとプライバシーの問題があります。

2. **解決アプローチ**: 分散型ネットワークを活用することで、計算リソースを民主化し、誰もが参加できるAIエコシステムを構築します。

3. **将来展望**: 2026年末までに100,000ノードの達成を目指しており、これにより大規模な言語モデルの分散処理が可能になります。

— Noodlaネットワークで処理されました`;

export const mockTranslateResult = 'This document covers the latest developments in distributed artificial intelligence networks. Based on blockchain technology, this system allows participants to earn rewards while contributing computing resources.';

export const mockDraftResult = `件名：新しいAIの時代への参加のご案内

拝啓 田中太郎様

この度は、Noodlaネットワークへのご参加ありがとうございます。

私たちは、分散型AIの力で、テクノロジーの未来を皆さんと一緒に作り上げたいと考えています。あなたのスマートフォンが、世界中の人々のためのAIサービスを支える一部となります。

今後ともNoodlaをよろしくお願い申し上げます。

敬具
Noodlaチーム`;
